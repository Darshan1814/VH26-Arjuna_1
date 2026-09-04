"""Prompt templates for the troubleshooting RAG system.

The system prompt strictly restricts the LLM to only use
information from retrieved document chunks. This is the primary
hallucination control mechanism.
"""

from app.services.retrieval.hybrid_retriever import RetrievedChunk


def build_system_prompt() -> str:
    """Build the system prompt that restricts the LLM to retrieved evidence."""
    return """You are a machine troubleshooting assistant. You help engineers diagnose and fix machine problems using ONLY the information from provided service manuals.

CRITICAL RULES:
1. ONLY use information from the provided document chunks below. Do NOT use your general knowledge.
2. If the provided chunks do not contain enough information to answer, say so clearly. Do NOT guess or invent procedures.
3. Always cite which manual, section, and page your answer comes from.
4. If an error code appears in multiple machine manuals with different meanings, clearly state which machine you are answering for.
5. Provide structured troubleshooting steps when applicable.
6. Be precise about safety warnings and procedures from the manuals.

You MUST respond in valid JSON format with the following structure:
{
    "answer": "Your detailed troubleshooting answer based on the manual evidence",
    "probable_causes": ["cause 1", "cause 2"],
    "corrective_steps": ["step 1", "step 2", "step 3"],
    "confidence": 0.0 to 1.0 based on how well the evidence supports your answer,
    "safety_warnings": ["any safety warnings from the manual"]
}

If you cannot find relevant information in the provided chunks:
{
    "answer": "I could not find sufficient evidence in the available manuals to answer this question. I will not recommend a repair based on unsupported information.",
    "probable_causes": [],
    "corrective_steps": [],
    "confidence": 0.0,
    "safety_warnings": []
}"""


def build_user_prompt(
    query: str,
    chunks: list[RetrievedChunk],
) -> str:
    """Build the user prompt with the query and retrieved context.

    Formats each chunk with its source metadata so the LLM can
    produce accurate citations.
    """
    context_parts: list[str] = []

    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"--- Document Chunk {i} ---\n"
            f"Manual: {chunk.manual_title or chunk.manual_id}\n"
            f"Machine: {chunk.machine_model or chunk.machine_id}\n"
            f"Section: {chunk.section}\n"
            f"Page: {chunk.page_number}\n"
            f"Error Codes: {', '.join(chunk.error_codes) if chunk.error_codes else 'None'}\n"
            f"Content:\n{chunk.content}\n"
        )

    context = "\n".join(context_parts)

    if not context_parts:
        context = "NO RELEVANT DOCUMENT CHUNKS WERE FOUND. You must indicate that you have insufficient information."

    return f"""RETRIEVED DOCUMENT CONTEXT:
{context}

USER QUESTION: {query}

Based ONLY on the document context above, provide a structured troubleshooting response in JSON format."""
