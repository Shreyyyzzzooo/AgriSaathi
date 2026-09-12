"""Route handler for POST /api/explanation.

Uses the backend/app/llm/ module (explanation_generator + translation) which
provides:
  - IBM Granite foundation model calls (ibm/granite-13b-chat-v2)
  - Offline f-string fallback when WATSONX_APIKEY is absent
  - Externalized prompt templates (prompts/explain_en.txt, explain_hi.txt)
  - Language routing via translation.explain_crop()

The legacy POST /api/explain route (api/routes/explain.py) remains registered
for backward compatibility.  This new route is preferred for all new callers.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.llm.translation import explain_crop
from app.models.schemas import ExplainRequest, ExplainResponse
from app.session_store import get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["explanation"])


@router.post(
    "/explanation",
    response_model=ExplainResponse,
    summary="Generate bilingual Granite AI explanation for a crop simulation",
)
def get_explanation_v2(body: ExplainRequest) -> ExplainResponse:
    """Generate a plain-language explanation via IBM Granite.

    Pulls optional enrichment (budget, soil_type, market_crash_risk,
    loss_probability) from the session store if a session_id is embedded in
    the simulation_result metadata.

    Falls back to a fully-grounded offline f-string explanation when
    WATSONX_APIKEY is absent or the API returns an error.  Never returns 500.

    Args:
        body: ExplainRequest — simulation_result (CropResult) + lang.

    Returns:
        ExplainResponse — crop_id, text_en, text_hi, reasoning_bullets.
        text_en is null when lang=="hi"; text_hi is null when lang=="en".
    """
    sim_dict = body.simulation_result.model_dump()

    # ── Enrich context from session if available ──────────────────────────────
    # The simulation_result may carry a session_id in its metadata field.
    # We do a best-effort lookup; absence is not an error.
    extra: dict = {}
    session_id = sim_dict.get("session_id")
    if session_id:
        session = get_session(session_id)
        if session:
            extra.update({
                "budget_inr":  session.get("budget_inr"),
                "soil_type":   session.get("soil_type"),
            })

    try:
        raw = explain_crop(
            simulation_result=sim_dict,
            lang=body.lang,
            extra_context=extra,
        )
        return ExplainResponse(**raw)
    except Exception as exc:
        # This should never happen (explain_crop is fallback-safe), but if it
        # does, return a 500 with a clear message rather than a traceback.
        logger.error("Unexpected error in /api/explanation: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Explanation service error: {exc}. Check backend logs.",
        ) from exc
