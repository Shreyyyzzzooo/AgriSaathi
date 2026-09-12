"""Language routing layer for AgriTwin explanations.

Provides a single ``translate()`` entry point that routes to the correct
prompt template (English or Hindi) and assembles the final ExplainResponse
dict, with independent fallback handling for each language.

Supported values for *lang*:
    "en"   → text_en populated, text_hi = None
    "hi"   → text_hi populated, text_en = None
    "kn"   → text_kn populated
    "all"  → all populated
"""

from __future__ import annotations

import logging
from typing import Any

from app.llm.explanation_generator import generate_explanation

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────────

def explain_crop(
    simulation_result: dict[str, Any],
    lang: str,
    extra_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate and return a bilingual (or single-language) explanation.

    This is the single entry point for all callers.  It:
        1. Validates *lang* (defaults to "en" on unknown value).
        2. Delegates to ``generate_explanation()`` which handles both live
           IBM Granite calls and the offline f-string fallback.
        3. Guarantees that ``reasoning_bullets`` is always a non-empty list.

    Args:
        simulation_result: CropResult dict (crop_id, stats, weather_by_day).
        lang: "en" | "hi" | "kn" | "all".
        extra_context: Optional dict with budget_inr, soil_type,
            loss_probability, market_crash_risk, etc.

    Returns:
        Dict matching ExplainResponse schema:
            crop_id, text_en, text_hi, reasoning_bullets
    """
    safe_lang = lang if lang in ("en", "hi", "kn", "mr", "bn", "ta", "te", "gu", "pa", "ml", "all") else "en"
    if safe_lang != lang:
        logger.warning("Unknown lang='%s' — defaulting to 'en'.", lang)

    result = generate_explanation(
        simulation_result=simulation_result,
        lang=safe_lang,
        extra_context=extra_context or {},
    )

    # Guarantee reasoning_bullets is non-empty (3+ items)
    if not result.get("reasoning_bullets"):
        result["reasoning_bullets"] = _fallback_bullets(simulation_result)

    return result


# ── Language helpers (public, for testing) ────────────────────────────────────

def is_hindi(text: str) -> bool:
    """Return True if *text* contains Devanagari characters."""
    return any("\u0900" <= ch <= "\u097F" for ch in text)


def language_label(lang: str) -> str:
    """Human-readable label for a lang code."""
    return {"en": "English", "hi": "Hindi", "kn": "Kannada", "all": "All Languages"}.get(
        lang, lang
    )


# ── Internal ──────────────────────────────────────────────────────────────────

def _fallback_bullets(sim: dict[str, Any]) -> list[str]:
    stats = sim.get("stats", {})
    return [
        f"Mean profit: ₹{stats.get('mean', 0):,.0f}/ha (Monte Carlo simulation)",
        f"Risk range: ₹{stats.get('p10', 0):,.0f} (p10) to ₹{stats.get('p90', 0):,.0f} (p90)/ha",
        "Grounded in NASA POWER weather, Agmarknet prices, and ICAR benchmarks",
    ]
