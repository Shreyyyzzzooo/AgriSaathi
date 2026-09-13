import logging
import os
import json
from typing import Any, Dict

try:
    from google import genai
    from google.genai import types
    _HAS_GENAI = True
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore
    _HAS_GENAI = False

logger = logging.getLogger(__name__)

_client: Any = None


def get_client() -> Any:
    global _client

    if not _HAS_GENAI or genai is None:
        raise RuntimeError("google-genai package is not installed.")

    if _client is None:
        # Fallback to GEMINI_API_KEY if AGRONOMY_API_KEY is not provided
        api_key = os.environ.get("AGRONOMY_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY or AGRONOMY_API_KEY is not set in the environment.")

        _client = genai.Client(api_key=api_key)

    return _client


def generate_agronomy_plan(session_data: Dict[str, Any], crop_name: str, lang: str) -> Dict[str, Any]:
    """Generate a structured agronomy plan using Gemini."""
    budget = session_data.get("budget_inr", "Unknown")
    location = session_data.get("location", "Unknown")
    soil = session_data.get("soil_type", "Unknown")
    water = session_data.get("water_availability", "Unknown")

    prompt = f"""You are an expert Indian Agronomist. 
Generate a fertilizer and pesticide recommendation plan for {crop_name} being grown in {location}.
The farmer's soil type is {soil}, water availability is {water}, and their budget is ₹{budget}.
Please provide the response in the language corresponding to this language code: '{lang}' (e.g., 'en' for English, 'hi' for Hindi, etc.).

You MUST return the output strictly as a JSON object with the following schema, and NO markdown formatting or backticks around it:
{{
  "fertilizers": [
    {{
      "name": "Name of fertilizer (e.g. Urea, DAP)",
      "timing": "When to apply (e.g. Basal, 30 days after sowing)",
      "dosage": "Amount per hectare",
      "reasoning": "Why this is recommended based on soil/crop"
    }}
  ],
  "pesticides": [
    {{
      "name": "Generic chemical name (e.g. Imidacloprid)",
      "target": "Target pest or disease",
      "dosage": "Amount per hectare",
      "reasoning": "Why this is recommended"
    }}
  ],
  "general_advice": "One paragraph of general agronomic advice for this crop and location."
}}
"""

    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        
        text = response.text
        # Strip potential markdown code blocks if the model ignored the instruction
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())

    except Exception as e:
        logger.exception("Gemini API error during agronomy plan generation")
        raise RuntimeError(f"Failed to generate agronomy plan: {e}")
