# NVIDIA NIM API Client — OpenAI-compatible interface
import os
import logging
from typing import Optional
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize the NIM client using OpenAI-compatible API
_client: Optional[OpenAI] = None

def get_nim_client() -> OpenAI:
    """Get or create the NVIDIA NIM client singleton."""
    global _client
    if _client is None:
        api_key = settings.NVIDIA_API_KEY
        if not api_key:
            logger.warning("NVIDIA_API_KEY not set — NIM features will be unavailable")
            api_key = "dummy-key"
        _client = OpenAI(
            base_url=settings.NIM_BASE_URL,
            api_key=api_key,
        )
    return _client

def chat_completion(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    stream: bool = False,
) -> str:
    """Send a chat completion request to NVIDIA NIM and return the response text."""
    if not settings.NVIDIA_API_KEY or settings.NVIDIA_API_KEY == "dummy-key":
        logger.warning("NVIDIA_API_KEY not set — using local mock response")
        return "NVIDIA NIM offline fallback: I found some relevant cases for you in our local search."

    client = get_nim_client()
    model = model or settings.NIM_MODEL

    try:
        if stream:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            full_response = ""
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    full_response += chunk.choices[0].delta.content
            return full_response
        else:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False,
            )
            return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"Error in NIM chat completion: {e}")
        return "An error occurred while calling the NVIDIA NIM API. Please check your API key and connection."