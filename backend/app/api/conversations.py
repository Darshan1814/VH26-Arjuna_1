"""Conversation and message endpoints for chat history."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.database import get_supabase_client
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(data: ConversationCreate):
    """Start a new troubleshooting conversation."""
    try:
        client = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()
        conv_data = {
            "machine_id": data.machine_id,
            "title": data.title or "New Conversation",
            "created_at": now,
            "updated_at": now,
        }
        result = client.table("conversations").insert(conv_data).execute()
        return result.data[0]
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        raise HTTPException(status_code=500, detail="Failed to create conversation")


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str):
    """Get conversation details."""
    try:
        client = get_supabase_client()
        result = (
            client.table("conversations")
            .select("*")
            .eq("id", conversation_id)
            .single()
            .execute()
        )
        return result.data
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to fetch conversation: {e}")
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(conversation_id: str):
    """Get all messages in a conversation, ordered chronologically."""
    try:
        client = get_supabase_client()
        result = (
            client.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        return result.data
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to fetch messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
async def create_message(conversation_id: str, data: MessageCreate):
    """Add a message to a conversation."""
    if data.role not in ("user", "assistant"):
        raise HTTPException(
            status_code=400,
            detail="Role must be 'user' or 'assistant'",
        )

    try:
        client = get_supabase_client()
        msg_data = {
            "conversation_id": conversation_id,
            "role": data.role,
            "content": data.content,
        }
        result = client.table("messages").insert(msg_data).execute()

        # Update conversation timestamp
        client.table("conversations").update(
            {"updated_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", conversation_id).execute()

        return result.data[0]
    except ValueError:
        raise HTTPException(status_code=503, detail="Database not configured")
    except Exception as e:
        logger.error(f"Failed to create message: {e}")
        raise HTTPException(status_code=500, detail="Failed to create message")
