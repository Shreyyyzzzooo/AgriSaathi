import logging
import os
from typing import Any, Dict, List

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
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set in the environment.")

        _client = genai.Client(api_key=api_key)

    return _client


def build_system_prompt(session_data: Dict[str, Any]) -> str:
    """Build a system prompt with the farmer's session state."""
    budget = session_data.get("budget_inr", "Unknown")
    location = session_data.get("location", "Unknown")
    plot_size = session_data.get("plot_size_ha", "Unknown")
    soil = session_data.get("soil_type", "Unknown")
    water = session_data.get("water_availability", "Unknown")

    return f"""You are an intelligent, friendly agronomic assistant for the AgriSaathi platform.

Your job is to answer the farmer's questions about crop selection, risk, budgeting, and farming practices.

The current farmer's context is:
- Location: {location}
- Plot Size: {plot_size} hectares
- Soil Type: {soil}
- Water Availability: {water}
- Budget: ₹{budget}

Guidelines:
1. Be helpful, concise, and professional.
2. If the user asks in a regional language, respond in that same language natively.
3. Use the provided context to give tailored advice.
4. Do not invent data. Explain general agronomic principles when needed.
5. Keep answers practical and actionable.
"""


def generate_chat_response(
    session_data: Dict[str, Any],
    message: str,
    history: List[Dict[str, str]],
) -> str:
    """Generate a chat response using Gemini."""
    try:
        client = get_client()
        contents = [
            types.Content(
                role="user" if item["role"] == "user" else "model",
                parts=[types.Part.from_text(text=item["content"])],
            )
            for item in history
        ]
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=message)],
            )
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=build_system_prompt(session_data),
                temperature=0.7,
            ),
        )
        return response.text or "I could not generate a response."

    except Exception:
        logger.exception("Gemini API error")
        return (
            "I apologize, but I am having trouble connecting to my brain "
            "right now. Please try again in a moment!"
        )