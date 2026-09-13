from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.models.schemas import ChatRequest, ChatResponse
from app.session_store import get_session
from app.llm.chat_agent import generate_chat_response

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """
    Handle incoming chat messages and generate response via Gemini.
    """
    # 1. Fetch farmer session data to build context
    session_data = get_session(req.session_id)
    if not session_data:
        # If no session, provide minimal empty dict or handle error
        session_data = {"budget_inr": "Unknown", "location": "Unknown", "plot_size_ha": "Unknown", "soil_type": "Unknown", "water_availability": "Unknown"}
        
    # 2. Format history for our LLM agent
    # History comes in as [{"role": "user", "content": "hello"}, ...]
    formatted_history = [msg.model_dump() for msg in req.history]
    
    # 3. Call the agent
    try:
        reply = generate_chat_response(session_data, req.message, formatted_history)
        return ChatResponse(reply_text=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {e}")
