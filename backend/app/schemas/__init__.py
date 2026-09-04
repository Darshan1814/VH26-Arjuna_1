# Pydantic schemas for API request/response validation
from app.schemas.machine import MachineCreate, MachineResponse
from app.schemas.manual import ManualResponse, ManualUploadResponse
from app.schemas.query import RAGQueryRequest
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
)
from app.schemas.rag_response import RAGResponse

__all__ = [
    "MachineCreate",
    "MachineResponse",
    "ManualResponse",
    "ManualUploadResponse",
    "RAGQueryRequest",
    "ConversationCreate",
    "ConversationResponse",
    "MessageCreate",
    "MessageResponse",
    "RAGResponse",
]
