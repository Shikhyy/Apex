"""LLM failover utility: Groq primary -> Groq secondary -> Gemini."""

import logging
import os
from typing import Any

import httpx
from langchain_groq import ChatGroq

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "rate limit" in msg
        or "rate_limit_exceeded" in msg
        or "429" in msg
        or "tokens per day" in msg
        or "tpm" in msg
    )


def _normalize_messages(messages: list[Any]) -> list[tuple[str, str]]:
    normalized: list[tuple[str, str]] = []
    for item in messages:
        if isinstance(item, tuple) and len(item) == 2:
            role = str(item[0]).strip().lower()
            text = str(item[1])
            normalized.append((role, text))
            continue

        if isinstance(item, dict):
            role = str(item.get("role", "human")).strip().lower()
            text = str(item.get("content", ""))
            normalized.append((role, text))
            continue

        role = "human"
        cls_name = item.__class__.__name__.lower()
        if "system" in cls_name:
            role = "system"
        text = str(getattr(item, "content", ""))
        normalized.append((role, text))

    return normalized


def _invoke_groq(messages: list[tuple[str, str]], api_key: str, temperature: float) -> str:
    llm = ChatGroq(
        model=DEFAULT_MODEL,
        temperature=temperature,
        api_key=api_key,
        max_retries=1,
    )
    response = llm.invoke(messages)
    content = response.content
    return content if isinstance(content, str) else str(content)


def _invoke_gemini(messages: list[tuple[str, str]], api_key: str, temperature: float) -> str:
    system_parts = [text for role, text in messages if role == "system" and text]
    user_parts = [text for role, text in messages if role != "system" and text]

    prompt = ""
    if system_parts:
        prompt += "System instructions:\n" + "\n\n".join(system_parts) + "\n\n"
    prompt += "User request:\n" + "\n\n".join(user_parts)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {data}")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError(f"Gemini returned empty content: {data}")

    text = parts[0].get("text", "")
    if not text:
        raise RuntimeError(f"Gemini returned no text: {data}")
    return text


def invoke_with_fallback(messages: list[Any], temperature: float = 0.1) -> str:
    """Invoke LLM with provider failover.

    Order:
    1) GROQ_API_KEY
    2) GROQ_API_KEY_FALLBACK
    3) GEMINI_API_KEY
    """
    normalized = _normalize_messages(messages)

    primary = os.environ.get("GROQ_API_KEY", "").strip()
    secondary = os.environ.get("GROQ_API_KEY_FALLBACK", "").strip()
    gemini = os.environ.get("GEMINI_API_KEY", "").strip()

    errors: list[str] = []

    for idx, key in enumerate([primary, secondary], start=1):
        if not key:
            continue
        try:
            text = _invoke_groq(normalized, key, temperature)
            if idx == 2:
                logger.info("LLM failover in use: GROQ_API_KEY_FALLBACK")
            return text
        except Exception as exc:
            errors.append(f"groq_{idx}: {exc}")
            if _is_rate_limit_error(exc):
                logger.warning("Groq key #%d rate-limited, trying next provider", idx)
            else:
                logger.warning("Groq key #%d failed, trying next provider: %s", idx, exc)

    if gemini:
        try:
            logger.info("LLM failover in use: Gemini")
            return _invoke_gemini(normalized, gemini, temperature)
        except Exception as exc:
            errors.append(f"gemini: {exc}")

    if not primary and not secondary and not gemini:
        raise RuntimeError("No LLM API keys configured (GROQ_API_KEY, GROQ_API_KEY_FALLBACK, GEMINI_API_KEY)")

    raise RuntimeError("All LLM providers failed: " + " | ".join(errors))
