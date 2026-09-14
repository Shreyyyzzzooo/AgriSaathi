"""IBM watsonx.ai Llama 3.3 70B explanation generator.

Fills the prompt templates in prompts/explain_en.txt and prompts/explain_hi.txt
with actual simulation metrics, calls the Llama foundation model via watsonx,
and parses the 3-bullet response.

Model:
    meta-llama/llama-3-3-70b-instruct

Credentials (from environment, loaded via python-dotenv in main.py):
    WATSONX_APIKEY      — IBM Cloud API key (also accepts WATSONX_API_KEY)
    WATSONX_PROJECT_ID  — watsonx.ai project ID
    WATSONX_URL         — regional endpoint  (default: us-south)

Offline / error fallback:
    When WATSONX_APIKEY is missing OR the API call raises any exception,
    ``generate_explanation()`` returns a deterministic, fully-grounded
    f-string explanation built directly from the simulation metrics.
    The fallback is structurally identical to the live response —
    same keys, same 3-bullet format — so the frontend never sees a 500.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_PROJECT_ID_ENV = "WATSONX_PROJECT_ID"
_URL_ENV = "WATSONX_URL"

# ── Prompt template paths ─────────────────────────────────────────────────────
_PROMPTS_DIR = Path(__file__).parent / "prompts"

# ── Model IDs (in preference order) ──────────────────────────────────────────
_MODEL_PREFERENCES = [
    "meta-llama/llama-3-3-70b-instruct",
]
# ── Generation parameters ─────────────────────────────────────────────────────
_GEN_PARAMS = {
    "max_new_tokens": 400,
    "temperature":    0.2,
    "stop_sequences": ["###", "\n\n\n"],
}


# ── Public API ────────────────────────────────────────────────────────────────

def generate_explanation(
    simulation_result: dict[str, Any],
    lang: str,
    extra_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a plain-language explanation for *simulation_result*.

    Args:
        simulation_result: CropResult dict with crop_id, stats, weather_by_day.
        lang: "en" | "hi" | "kn" | "all".
        extra_context: Optional dict containing keys that override template
            variables (e.g. budget, soil_type, diversification_status).

    Returns:
        Dict with keys: crop_id, text_en, text_hi, reasoning_bullets.
        Never raises — falls back to offline template on any error.
    """
    ctx = _build_context(simulation_result, extra_context or {})

    api_key = os.getenv("WATSONX_APIKEY") or os.getenv("WATSONX_API_KEY")
    if api_key is None:
        logger.warning(
            "WATSONX_APIKEY not set — using offline f-string explanation."
        )
        return _offline_explain(ctx, lang)

    try:
        return _live_explain(ctx, lang)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        logger.warning(
            "Llama API call failed (%s) — falling back to offline explanation.",
            exc,
        )
        return _offline_explain(ctx, lang)


# ── Context builder ───────────────────────────────────────────────────────────

def _build_context(
    sim: dict[str, Any],
    extra: dict[str, Any],
) -> dict[str, Any]:
    """Extract and format all template variables from simulation result."""
    crop_id = sim.get("crop_id", "unknown")
    stats   = sim.get("stats", {})
    weather = sim.get("weather_by_day", [])

    mean_p = float(stats.get("mean", 0))
    p10_p  = float(stats.get("p10",  0))
    p90_p  = float(stats.get("p90",  0))

    # loss_probability may come from extra context (simulation engine result)
    loss_prob = float(extra.get("loss_probability", 0.0)) * 100

    # Summarise weather array
    conditions = [
        (d.get("condition") if isinstance(d, dict) else getattr(d, "condition", "sunny"))
        for d in weather
    ]
    dominant = max(set(conditions), key=conditions.count) if conditions else "sunny"
    avg_rain = (
        sum(
            (d.get("rainfall_mm") if isinstance(d, dict) else getattr(d, "rainfall_mm", 0))
            for d in weather
        ) / max(len(weather), 1)
    )
    weather_summary = (
        f"{dominant} conditions, avg {avg_rain:.1f} mm/day rainfall"
        if weather else "data unavailable"
    )

    # Diversification / crash risk
    crash_risk = extra.get("market_crash_risk", False)
    diversification_status = (
        "HIGH RISK — over 45% of district peers planting same crop; price depression likely"
        if crash_risk
        else "Normal — no market saturation detected in this district"
    )

    # Budget and soil
    budget   = extra.get("budget_inr",  "not specified")
    soil_type = extra.get("soil_type",  "not specified")

    crop_name = crop_id.replace("_", " ").title()

    def inr(v: float) -> str:
        if abs(v) >= 100_000:
            return f"₹{v / 100_000:.1f} lakh/ha"
        return f"₹{v:,.0f}/ha"

    return {
        "crop_id":                crop_id,
        "crop_name":              crop_name,
        "mean_profit":            inr(mean_p),
        "p10_profit":             inr(p10_p),
        "p90_profit":             inr(p90_p),
        "loss_prob":              f"{loss_prob:.1f}",
        "weather_summary":        weather_summary,
        "diversification_status": diversification_status,
        "budget":                 f"₹{int(budget):,}" if isinstance(budget, (int, float)) else str(budget),
        "soil_type":              soil_type,
        # Raw floats for fallback f-strings
        "_mean":  mean_p,
        "_p10":   p10_p,
        "_p90":   p90_p,
        "_loss":  loss_prob,
        "_crash": crash_risk,
    }


# ── Live Llama call ─────────────────────────────────────────────────────────

def _live_explain(ctx: dict[str, Any], lang: str) -> dict[str, Any]:
    """Fill prompt template(s) and call Llama via watsonx."""
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as Params

    api_key = os.getenv("WATSONX_APIKEY") or os.getenv("WATSONX_API_KEY")
    project_id = os.getenv(_PROJECT_ID_ENV) or "74233da1-9359-465b-bec2-aa4f97bc7bb0"
    url = os.getenv(_URL_ENV, "https://us-south.ml.cloud.ibm.com")

    creds = Credentials(api_key=api_key, url=url)
    model: ModelInference | None = None

    for model_id in _MODEL_PREFERENCES:
        try:
            model = ModelInference(
                model_id=model_id,
                credentials=creds,
                project_id=project_id,
                params={
                    Params.MAX_NEW_TOKENS: _GEN_PARAMS["max_new_tokens"],
                    Params.TEMPERATURE:    _GEN_PARAMS["temperature"],
                    Params.STOP_SEQUENCES: _GEN_PARAMS["stop_sequences"],
                },
            )
            break
        except Exception:
            continue

    if model is None:
        raise RuntimeError("No Llama model variant available.")

    prompt_path = _PROMPTS_DIR / f"explain_{lang}.txt"
    if not prompt_path.exists():
        prompt_path = _PROMPTS_DIR / "explain_en.txt"

    prompt = _load_template(prompt_path).format(**_template_vars(ctx))
    raw_text = model.generate_text(prompt=prompt)
    text, bullets = _parse_bullets(raw_text)

    response = {
        "crop_id": ctx["crop_id"],
        "reasoning_bullets": bullets or _offline_bullets(ctx),
    }
    response[f"text_{lang}"] = text
    return response


# ── Offline fallback ──────────────────────────────────────────────────────────

def _offline_explain(ctx: dict[str, Any], lang: str) -> dict[str, Any]:
    """Generate a fully-grounded explanation using f-strings — never fails."""
    mean_p = ctx["_mean"]
    p10_p  = ctx["_p10"]
    p90_p  = ctx["_p90"]
    loss   = ctx["_loss"]
    name   = ctx["crop_name"]
    budget = ctx["budget"]
    soil   = ctx["soil_type"]
    crash  = ctx["_crash"]

    def inr(v: float) -> str:
        if abs(v) >= 100_000:
            return f"₹{v / 100_000:.1f} lakh/ha"
        return f"₹{v:,.0f}/ha"

    text_en = (
        f"{name} is projected to deliver a mean profit of {inr(mean_p)} "
        f"based on 500 Monte Carlo simulations. "
        f"Even in the worst 10% of weather and price scenarios, profit holds at "
        f"{inr(p10_p)}, while the best 10% of outcomes reach {inr(p90_p)}. "
        f"{'⚠ Note: Market saturation detected — prices may be depressed. ' if crash else ''}"
        f"At a {budget} budget on {soil} soil, this crop offers "
        f"{'acceptable' if loss < 20 else 'elevated'} downside risk "
        f"({loss:.1f}% probability of loss)."
    )

    text_hi = (
        f"{name} फसल से 500 Monte Carlo सिमुलेशन के आधार पर "
        f"औसत लाभ {inr(mean_p)} का अनुमान है। "
        f"सबसे खराब 10% परिदृश्यों में भी लाभ {inr(p10_p)} बना रहता है, "
        f"जबकि सर्वोत्तम 10% परिदृश्यों में {inr(p90_p)} तक पहुँच सकता है। "
        f"{'⚠ चेतावनी: जिले में इस फसल की अधिक बुआई है — कीमतें दबाव में हो सकती हैं। ' if crash else ''}"
        f"{budget} बजट और {soil} मिट्टी पर इस फसल में "
        f"{'स्वीकार्य' if loss < 20 else 'उच्च'} जोखिम है "
        f"(नुकसान की संभावना {loss:.1f}%)।"
    )
        
    text_kn = (
        f"500 Monte Carlo ಸಿಮ್ಯುಲೇಶನ್‌ಗಳ ಆಧಾರದ ಮೇಲೆ {name} ಬೆಳೆಯು ಸರಾಸರಿ {inr(mean_p)} ಲಾಭವನ್ನು ನೀಡುವ ನಿರೀಕ್ಷೆಯಿದೆ. "
        f"ಅತ್ಯಂತ ಕೆಟ್ಟ 10% ಸನ್ನಿವೇಶಗಳಲ್ಲಿಯೂ, ಲಾಭವು {inr(p10_p)} ನಲ್ಲಿ ಉಳಿಯುತ್ತದೆ, ಮತ್ತು ಉತ್ತಮ 10% ಸನ್ನಿವೇಶಗಳಲ್ಲಿ {inr(p90_p)} ತಲುಪುತ್ತದೆ. "
        f"{'⚠ ಎಚ್ಚರಿಕೆ: ಮಾರುಕಟ್ಟೆ ಸ್ಯಾಚುರೇಶನ್ ಕಂಡುಬಂದಿದೆ — ಬೆಲೆಗಳು ಕಡಿಮೆಯಾಗಬಹುದು. ' if crash else ''}"
        f"{budget} ಬಜೆಟ್ ಮತ್ತು {soil} ಮಣ್ಣಿನಲ್ಲಿ, ಈ ಬೆಳೆಯು "
        f"{'ಸ್ವೀಕಾರಾರ್ಹ' if loss < 20 else 'ಹೆಚ್ಚಿನ'} ಅಪಾಯವನ್ನು ಹೊಂದಿದೆ ({loss:.1f}% ನಷ್ಟದ ಸಾಧ್ಯತೆ)."
    )

    text_mr = (
        f"500 मॉन्टे कार्लो सिम्युलेशनच्या आधारे {name} पासून सरासरी {inr(mean_p)} नफा मिळण्याचा अंदाज आहे. "
        f"खराब हवामान आणि किमतीच्या १०% परिस्थितीतही नफा {inr(p10_p)} राहतो, तर सर्वोत्तम १०% परिस्थितीत तो {inr(p90_p)} पर्यंत पोहोचतो. "
        f"{'⚠ नोंद: बाजारात जास्त आवक — किमती घसरण्याची शक्यता आहे. ' if crash else ''}"
        f"{budget} बजेट आणि {soil} माती असलेल्या शेतकऱ्यासाठी, या पिकात "
        f"{'स्वीकार्य' if loss < 20 else 'जास्त'} धोका आहे (तोटा होण्याची शक्यता {loss:.1f}%)."
    )

    text_bn = (
        f"৫০০টি মন্টে কার্লো সিমুলেশনের ভিত্তিতে {name} থেকে গড় {inr(mean_p)} লাভের পূর্বাভাস দেওয়া হয়েছে। "
        f"সবচেয়ে খারাপ ১০% আবহাওয়া ও দামের পরিস্থিতিতেও লাভ {inr(p10_p)} থাকে, যেখানে সেরা ১০% ক্ষেত্রে এটি {inr(p90_p)} পর্যন্ত পৌঁছায়। "
        f"{'⚠ সতর্কতা: বাজারে অতিরিক্ত সরবরাহ — দাম কম হতে পারে। ' if crash else ''}"
        f"{budget} বাজেট এবং {soil} মাটির জন্য, এই ফসলে "
        f"{'গ্রহণযোগ্য' if loss < 20 else 'উচ্চ'} ঝুঁকি রয়েছে (ক্ষতির সম্ভাবনা {loss:.1f}%)।"
    )

    text_ta = (
        f"500 மான்டே கார்லோ உருவகப்படுத்துதல்களின் அடிப்படையில் {name} சராசரியாக {inr(mean_p)} லாபத்தை வழங்கும் என எதிர்பார்க்கப்படுகிறது. "
        f"மிக மோசமான 10% வானிலை மற்றும் விலை சூழ்நிலைகளில் கூட லாபம் {inr(p10_p)} ஆக இருக்கும், அதேசமயம் சிறந்த 10% முடிவுகள் {inr(p90_p)} ஐ எட்டும். "
        f"{'⚠ குறிப்பு: சந்தை செறிவு கண்டறியப்பட்டுள்ளது — விலைகள் குறையலாம். ' if crash else ''}"
        f"{budget} பட்ஜெட் மற்றும் {soil} மண்ணில், இந்தப் பயிர் "
        f"{'ஏற்றுக்கொள்ளக்கூடிய' if loss < 20 else 'அதிக'} ஆபத்தைக் கொண்டுள்ளது (நஷ்டத்திற்கான வாய்ப்பு {loss:.1f}%)."
    )

    text_te = (
        f"500 మోంటే కార్లో అనుకరణల ఆధారంగా {name} సగటున {inr(mean_p)} లాభాన్ని ఇస్తుందని అంచనా వేయబడింది. "
        f"వాతావరణం మరియు ధరల యొక్క అత్యంత చెత్త 10% పరిస్థితులలో కూడా లాభం {inr(p10_p)} గా ఉంటుంది, అయితే ఉత్తమ 10% ఫలితాలు {inr(p90_p)} కి చేరుకుంటాయి. "
        f"{'⚠ గమనిక: మార్కెట్ సంతృప్తత కనుగొనబడింది — ధరలు తగ్గవచ్చు. ' if crash else ''}"
        f"{budget} బడ్జెట్ మరియు {soil} నేల ఉన్న రైతుకు, ఈ పంటలో "
        f"{'ఆమోదయోగ్యమైన' if loss < 20 else 'ఎక్కువ'} ప్రమాదం ఉంది (నష్టం సంభవించే అవకాశం {loss:.1f}%)."
    )

    text_gu = (
        f"500 મોન્ટે કાર્લો સિમ્યુલેશનના આધારે {name} સરેરાશ {inr(mean_p)} નફો આપે તેવી ધારણા છે. "
        f"સૌથી ખરાબ 10% હવામાન અને ભાવની પરિસ્થિતિઓમાં પણ નફો {inr(p10_p)} રહે છે, જ્યારે શ્રેષ્ઠ 10% પરિણામો {inr(p90_p)} સુધી પહોંચે છે. "
        f"{'⚠ નોંધ: બજારમાં વધુ પુરવઠો — ભાવ ઘટી શકે છે. ' if crash else ''}"
        f"{budget} બજેટ અને {soil} માટી પર, આ પાકમાં "
        f"{'સ્વીકાર્ય' if loss < 20 else 'વધુ'} જોખમ છે (નુકસાનની સંભાવના {loss:.1f}%)."
    )

    text_pa = (
        f"500 ਮੋਂਟੇ ਕਾਰਲੋ ਸਿਮੂਲੇਸ਼ਨਾਂ ਦੇ ਆਧਾਰ 'ਤੇ {name} ਤੋਂ ਔਸਤਨ {inr(mean_p)} ਮੁਨਾਫ਼ਾ ਹੋਣ ਦੀ ਉਮੀਦ ਹੈ। "
        f"ਸਭ ਤੋਂ ਖਰਾਬ 10% ਮੌਸਮ ਅਤੇ ਕੀਮਤ ਦੀਆਂ ਸਥਿਤੀਆਂ ਵਿੱਚ ਵੀ ਮੁਨਾਫ਼ਾ {inr(p10_p)} ਰਹਿੰਦਾ ਹੈ, ਜਦੋਂ ਕਿ ਸਭ ਤੋਂ ਵਧੀਆ 10% ਨਤੀਜੇ {inr(p90_p)} ਤੱਕ ਪਹੁੰਚਦੇ ਹਨ। "
        f"{'⚠ ਨੋਟ: ਬਾਜ਼ਾਰ ਵਿੱਚ ਵੱਧ ਸਪਲਾਈ — ਕੀਮਤਾਂ ਘੱਟ ਸਕਦੀਆਂ ਹਨ। ' if crash else ''}"
        f"{budget} ਬਜਟ ਅਤੇ {soil} ਮਿੱਟੀ ਦੇ ਨਾਲ, ਇਸ ਫਸਲ ਵਿੱਚ "
        f"{'ਸਵੀਕਾਰਯੋਗ' if loss < 20 else 'ਵੱਧ'} ਖਤਰਾ ਹੈ (ਨੁਕਸਾਨ ਦੀ ਸੰਭਾਵਨਾ {loss:.1f}%)।"
    )

    text_ml = (
        f"500 മോണ്ടെ കാർലോ സിമുലേഷനുകളുടെ അടിസ്ഥാനത്തിൽ {name} ശരാശരി {inr(mean_p)} ലാഭം നൽകുമെന്ന് പ്രതീക്ഷിക്കുന്നു. "
        f"ഏറ്റവും മോശമായ 10% കാലാവസ്ഥയിലും വിലയിലും പോലും ലാഭം {inr(p10_p)} ആയി തുടരുന്നു, മികച്ച 10% സാഹചര്യങ്ങളിൽ ഇത് {inr(p90_p)} വരെ എത്തുന്നു. "
        f"{'⚠ ശ്രദ്ധിക്കുക: വിപണിയിൽ കൂടുതൽ വിതരണം — വില കുറഞ്ഞേക്കാം. ' if crash else ''}"
        f"{budget} ബജറ്റും {soil} മണ്ണും ഉള്ള കർഷകന്, ഈ വിളയിൽ "
        f"{'സ്വീകാര്യമായ' if loss < 20 else 'കൂടുതൽ'} അപകടസാധ്യതയുണ്ട് (നഷ്ടപ്പെടാനുള്ള സാധ്യത {loss:.1f}%)."
    )

    response = {
        "crop_id": ctx["crop_id"],
        "reasoning_bullets": _offline_bullets(ctx),
    }

    translations = {
        "en": text_en,
        "hi": text_hi,
        "kn": text_kn,
        "mr": text_mr,
        "bn": text_bn,
        "ta": text_ta,
        "te": text_te,
        "gu": text_gu,
        "pa": text_pa,
        "ml": text_ml
    }

    response[f"text_{lang}"] = translations.get(lang, text_en)
        
    return response


def _offline_bullets(ctx: dict[str, Any]) -> list[str]:
    """Three grounded bullets derived strictly from simulation metrics."""
    mean_p = ctx["_mean"]
    p10_p  = ctx["_p10"]
    p90_p  = ctx["_p90"]
    loss   = ctx["_loss"]
    crash  = ctx["_crash"]

    spread = p90_p - p10_p
    risk   = "low" if loss < 10 else "moderate" if loss < 25 else "high"

    def inr(v: float) -> str:
        if abs(v) >= 100_000:
            return f"₹{v / 100_000:.1f} lakh/ha"
        return f"₹{v:,.0f}/ha"

    bullets = [
        f"Expected profit {inr(mean_p)} with a p10–p90 spread of {inr(p10_p)} to {inr(p90_p)} ({risk} risk profile)",
        f"Probability of loss: {loss:.1f}% — based on lognormal Mandi price sampling and NASA POWER weather",
        f"District saturation: {'over 45% peers planting same crop — price depression factor applied' if crash else 'no saturation — full modal price assumed'}",
    ]
    return bullets


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_template(path: Path) -> str:
    """Load a prompt template file. Cached in module dict after first read."""
    cache_key = str(path)
    if cache_key not in _TEMPLATE_CACHE:
        _TEMPLATE_CACHE[cache_key] = path.read_text(encoding="utf-8")
    return _TEMPLATE_CACHE[cache_key]


_TEMPLATE_CACHE: dict[str, str] = {}


def _template_vars(ctx: dict[str, Any]) -> dict[str, str]:
    """Extract only the public string keys for str.format()."""
    return {k: v for k, v in ctx.items() if not k.startswith("_")}


def _parse_bullets(text: str) -> tuple[str, list[str]]:
    """Parse Llama response into (paragraph_text, bullet_list)."""
    lines = text.strip().splitlines()
    bullets = [
        ln.lstrip("-•").strip()
        for ln in lines
        if ln.strip().startswith(("-", "•")) and ln.strip().lstrip("-•").strip()
    ]
    non_bullet = " ".join(
        ln.strip() for ln in lines
        if ln.strip() and not ln.strip().startswith(("-", "•"))
    )
    return non_bullet or text.strip(), bullets[:5]
