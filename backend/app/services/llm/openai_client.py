"""Centralized OpenAI client wrapper supporting both OpenAI and Azure OpenAI."""

import json
import logging
from typing import Any, Optional

from openai import AzureOpenAI, OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Centralized client for OpenAI completions, vision, and embeddings."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self._is_azure: bool = False

    @property
    def client(self) -> Any:
        """Lazy initialization of the client from environment configuration."""
        if self._client is None:
            if settings.GROQ_API_KEY:
                self._client = OpenAI(
                    base_url="https://api.groq.com/openai/v1",
                    api_key=settings.GROQ_API_KEY,
                )
                self._is_azure = False
                logger.info(f"Initialized ultra-fast Groq LLM client (model: {settings.GROQ_MODEL})")
            elif settings.OPENAI_API_KEY:
                self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
                self._is_azure = False
                logger.info(f"Initialized direct OpenAI client (model: {settings.OPENAI_MODEL})")
            elif settings.AZURE_OPENAI_KEY and settings.AZURE_OPENAI_ENDPOINT:
                self._client = AzureOpenAI(
                    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                    api_key=settings.AZURE_OPENAI_KEY,
                    api_version=settings.AZURE_OPENAI_VERSION,
                )
                self._is_azure = True
                logger.info(
                    f"Initialized Azure OpenAI client (deployment: {settings.AZURE_OPENAI_DEPLOYMENT or settings.MODEL_GEN})"
                )
            else:
                raise ValueError(
                    "Neither GROQ_API_KEY, OPENAI_API_KEY, nor AZURE_OPENAI_KEY/ENDPOINT is configured."
                )
        return self._client

    @property
    def model_name(self) -> str:
        """Returns the configured model name / deployment."""
        if settings.GROQ_API_KEY:
            return settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        return "gpt-5.5"

    def chat_completion(
        self,
        messages: list[dict[str, Any]],
        response_format: Optional[dict[str, str]] = None,
        temperature: float = 0.1,
        max_tokens: int = 2500,
    ) -> str:
        """Execute a chat completion with model fallback, optimized for Groq and OpenAI."""
        if settings.GROQ_API_KEY:
            # Verified best Groq model supporting structured JSON outputs & sub-second latency
            candidate_models = ["qwen/qwen3.8-27b"]
        else:
            candidate_models = ["gpt-5.5"]
            for fallback in [settings.MODEL_GEN, settings.AZURE_OPENAI_DEPLOYMENT, "gpt-5.4", "gpt-5-mini", "gpt-4o"]:
                if fallback and fallback not in candidate_models:
                    candidate_models.append(fallback)

        last_err = None
        for model in candidate_models:
            is_reasoning_or_5 = any(prefix in model.lower() for prefix in ["gpt-5", "o1", "o3", "o4"])

            kwargs: dict[str, Any] = {
                "model": model,
                "messages": messages,
            }
            if response_format:
                kwargs["response_format"] = response_format

            if is_reasoning_or_5:
                # gpt-5.5 requires max_completion_tokens (budgeting for reasoning + content)
                kwargs["max_completion_tokens"] = max(max_tokens or 2500, 2500)
            else:
                kwargs["max_tokens"] = max_tokens or 2048
                kwargs["temperature"] = temperature

            for attempt in range(4):
                try:
                    response = self.client.chat.completions.create(**kwargs)
                    return response.choices[0].message.content or ""
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "rate limit" in err_str:
                        wait_s = 2.5 * (attempt + 1)
                        logger.info(f"Groq rate limit notice. Backing off {wait_s}s before retry ({attempt + 1}/4)...")
                        import time
                        time.sleep(wait_s)
                        continue

                    # Dynamic parameter recovery
                    if "max_tokens" in err_str and "max_completion_tokens" in err_str:
                        try:
                            token_val = kwargs.pop("max_tokens", 2500)
                            kwargs["max_completion_tokens"] = max(token_val, 2500)
                            kwargs.pop("temperature", None)
                            response = self.client.chat.completions.create(**kwargs)
                            return response.choices[0].message.content or ""
                        except Exception as retry_err:
                            e = retry_err
                    elif "temperature" in err_str and "default" in err_str:
                        try:
                            kwargs.pop("temperature", None)
                            response = self.client.chat.completions.create(**kwargs)
                            return response.choices[0].message.content or ""
                        except Exception as retry_err:
                            e = retry_err

                    last_err = e
                    logger.warning(f"Chat completion with model '{model}' failed: {e}")
                    break

        logger.error(f"All model candidates failed. Last error: {last_err}")
        raise last_err

    def json_completion(
        self,
        messages: list[dict[str, Any]],
        temperature: float = 0.1,
    ) -> dict[str, Any]:
        """Execute chat completion and parse JSON with automatic cleanup."""
        raw_text = self.chat_completion(
            messages=messages,
            response_format={"type": "json_object"},
            temperature=temperature,
        )
        cleaned = self._clean_json_text(raw_text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as err:
            logger.error(f"Failed to parse JSON response: {err} | Raw: {raw_text[:200]}")
            return {"raw_response": raw_text, "error": str(err)}

    def vision_completion(
        self,
        prompt: str,
        image_base64: str,
        mime_type: str = "image/png",
    ) -> str:
        """Analyze an image using multimodal vision capability."""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}"
                        },
                    },
                ],
            }
        ]
        return self.chat_completion(messages=messages, temperature=0.1)

    def create_embedding(self, text: str) -> list[float]:
        """Generate vector embedding for text using configured embedding model."""
        model = settings.OPENAI_EMBEDDING_MODEL or "text-embedding-3-small"
        response = self.client.embeddings.create(input=[text], model=model)
        return response.data[0].embedding

    @staticmethod
    def _clean_json_text(text: str) -> str:
        stripped = text.strip()
        if stripped.startswith("```json"):
            stripped = stripped[7:]
        elif stripped.startswith("```"):
            stripped = stripped[3:]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
        return stripped.strip()


_openai_client: Optional[OpenAIClient] = None


def get_openai_client() -> OpenAIClient:
    """Singleton getter for OpenAIClient."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client
