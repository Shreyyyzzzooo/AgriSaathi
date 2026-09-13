"""Route handlers for Chatbot in AgriSaathi.

Provides:
- Legacy /api/chat endpoint for backward compatibility.
- Full persistent conversation management:
  - GET    /api/chat/conversations
  - POST   /api/chat/conversations
  - GET    /api/chat/conversations/{id}
  - POST   /api/chat/conversations/{id}/messages
  - DELETE /api/chat/conversations/{id}
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth_deps import get_current_user
from app.llm.chat_agent import generate_chat_response
from app.models.schemas import (
    ChatConversationDetail,
    ChatConversationItem,
    ChatMessageItem,
    ChatRequest,
    ChatResponse,
    CreateConversationRequest,
    SendMessageRequest,
)
from app.session_store import (
    add_chat_message,
    create_conversation,
    delete_conversation,
    get_conversation,
    get_conversation_messages,
    get_farmer_profile,
    get_session,
    get_user_conversations,
    update_conversation_title,
)

router = APIRouter(prefix="/api", tags=["chat"])


# ── Legacy Chat Endpoint ──────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """Handle incoming chat messages and generate response via Gemini (legacy)."""
    session_data = get_session(req.session_id)
    if not session_data:
        session_data = {
            "budget_inr": "Unknown",
            "location": "Unknown",
            "plot_size_ha": "Unknown",
            "soil_type": "Unknown",
            "water_availability": "Unknown",
        }

    formatted_history = [msg.model_dump() for msg in req.history]

    try:
        reply = generate_chat_response(session_data, req.message, formatted_history)
        return ChatResponse(reply_text=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {e}")


# ── Persistent Conversation Endpoints ─────────────────────────────────────────

@router.get("/chat/conversations", response_model=List[ChatConversationItem])
def list_conversations(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[ChatConversationItem]:
    """Retrieve all chat conversations belonging to the authenticated user."""
    convs = get_user_conversations(current_user["id"])
    return [ChatConversationItem(**c) for c in convs]


@router.post(
    "/chat/conversations",
    response_model=ChatConversationItem,
    status_code=status.HTTP_201_CREATED,
)
def create_new_conversation(
    body: CreateConversationRequest = None,  # type: ignore
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatConversationItem:
    """Create a new conversation for the authenticated user."""
    title = (body.title if body and body.title else "New Conversation").strip()
    conv = create_conversation(current_user["id"], title or "New Conversation")
    return ChatConversationItem(**conv)


@router.get("/chat/conversations/{conversation_id}", response_model=ChatConversationDetail)
def get_conversation_detail(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatConversationDetail:
    """Retrieve a conversation and all its messages."""
    conv = get_conversation(current_user["id"], conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or unauthorized",
        )

    messages_raw = get_conversation_messages(conversation_id)
    messages = [ChatMessageItem(**m) for m in messages_raw]
    return ChatConversationDetail(
        conversation=ChatConversationItem(**conv, message_count=len(messages)),
        messages=messages,
    )


@router.post(
    "/chat/conversations/{conversation_id}/messages",
    response_model=ChatMessageItem,
)
def post_message(
    conversation_id: str,
    body: SendMessageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ChatMessageItem:
    """Post a user message to a conversation and get back the assistant's reply."""
    conv = get_conversation(current_user["id"], conversation_id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or unauthorized",
        )

    user_text = body.text.strip()
    if not user_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message text cannot be empty",
        )

    # 1. Store user message in database
    add_chat_message(conversation_id, "user", user_text)

    # 2. Update conversation title from first message if it's default
    if conv["title"] in ("New Conversation", "", None):
        new_title = user_text[:40].strip()
        if len(user_text) > 40:
            new_title += "..."
        update_conversation_title(conversation_id, new_title)

    # 3. Retrieve conversation history for LLM context
    history_records = get_conversation_messages(conversation_id)
    # The last message is the user message we just inserted
    formatted_history = [
        {
            "role": "user" if m["sender"] == "user" else "assistant",
            "content": m["text"],
        }
        for m in history_records[:-1]
    ]

    # 4. Fetch context: try session_id first, then user's saved farm profile
    session_data = None
    if body.session_id:
        session_data = get_session(body.session_id)
    if not session_data:
        profile = get_farmer_profile(current_user["id"])
        if profile:
            session_data = {
                "location": profile.get("location") or f"{profile.get('district', '')}, {profile.get('state', '')}".strip(", ") or "Unknown",
                "plot_size_ha": profile.get("area_acres", 1.0) / 2.471 if profile.get("area_acres") else "Unknown",
                "soil_type": profile.get("soil_type", "Unknown"),
                "water_availability": profile.get("irrigation_type", "Unknown"),
                "budget_inr": profile.get("budget_inr", "Unknown"),
            }
        else:
            session_data = {
                "budget_inr": "Unknown",
                "location": "Unknown",
                "plot_size_ha": "Unknown",
                "soil_type": "Unknown",
                "water_availability": "Unknown",
            }

    # 5. Generate assistant reply
    try:
        reply_text = generate_chat_response(session_data, user_text, formatted_history)
    except Exception as e:
        reply_text = f"I encountered an error generating advice: {e}"

    # 6. Store assistant response in database
    bot_msg = add_chat_message(conversation_id, "bot", reply_text)
    return ChatMessageItem(**bot_msg)


@router.delete("/chat/conversations/{conversation_id}")
def remove_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    """Delete a conversation and its messages."""
    success = delete_conversation(current_user["id"], conversation_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or unauthorized",
        )
    return {"status": "deleted", "id": conversation_id}
