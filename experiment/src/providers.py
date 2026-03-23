"""
LLM provider abstraction layer.
Supports OpenAI, Anthropic, and Google with unified interface.
"""

import json
import time
from dataclasses import dataclass

import openai
import anthropic
from google import genai
from google.genai import types as genai_types


@dataclass
class LLMResponse:
    """Standardized response from any LLM provider."""

    content: str
    input_tokens: int
    output_tokens: int
    latency_ms: float
    model: str
    provider: str


def call_openai(
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    timeout: int = 120,
) -> LLMResponse:
    """Call OpenAI API (GPT-5.4, GPT-5.4-mini, etc.)."""
    client = openai.OpenAI(api_key=api_key)

    start = time.perf_counter()

    # o-series models use different params
    is_reasoning = model_name.startswith("o")
    if is_reasoning:
        response = client.responses.create(
            model=model_name,
            input=[
                {"role": "developer", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            timeout=timeout,
        )
        latency = (time.perf_counter() - start) * 1000
        return LLMResponse(
            content=response.output_text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            latency_ms=latency,
            model=model_name,
            provider="openai",
        )
    else:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"},
            timeout=timeout,
        )
        latency = (time.perf_counter() - start) * 1000
        return LLMResponse(
            content=response.choices[0].message.content or "",
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            latency_ms=latency,
            model=model_name,
            provider="openai",
        )


def call_anthropic(
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    timeout: int = 120,
) -> LLMResponse:
    """Call Anthropic API (Claude Opus 4.6, Sonnet 4.6, etc.)."""
    client = anthropic.Anthropic(api_key=api_key)

    start = time.perf_counter()
    response = client.messages.create(
        model=model_name,
        max_tokens=2000,
        temperature=0.2,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
        timeout=timeout,
    )
    latency = (time.perf_counter() - start) * 1000

    content = response.content[0].text if response.content else ""
    return LLMResponse(
        content=content,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        latency_ms=latency,
        model=model_name,
        provider="anthropic",
    )


def call_google(
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    timeout: int = 120,
) -> LLMResponse:
    """Call Google Generative AI API (Gemini models) via google-genai SDK."""
    client = genai.Client(api_key=api_key)

    start = time.perf_counter()
    response = client.models.generate_content(
        model=model_name,
        contents=user_prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
            max_output_tokens=2000,
            response_mime_type="application/json",
        ),
    )
    latency = (time.perf_counter() - start) * 1000

    input_tokens = response.usage_metadata.prompt_token_count or 0
    output_tokens = response.usage_metadata.candidates_token_count or 0

    return LLMResponse(
        content=response.text or "",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency,
        model=model_name,
        provider="google",
    )


PROVIDER_MAP = {
    "openai": call_openai,
    "anthropic": call_anthropic,
    "google": call_google,
}


def call_model(
    provider: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    api_key: str = "",
    timeout: int = 120,
    **kwargs,
) -> LLMResponse:
    """Unified interface to call any supported LLM provider."""
    fn = PROVIDER_MAP.get(provider)
    if not fn:
        raise ValueError(f"Unknown provider: {provider}")

    return fn(
        model_name=model_name,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        api_key=api_key,
        timeout=timeout,
    )


def parse_grade_response(content: str) -> dict | None:
    """Parse JSON grade response from LLM output, handling common formatting issues."""
    # Strip markdown code fences if present
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (fences)
        lines = [l for l in lines[1:] if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        parsed = json.loads(text)
        # Validate required fields
        if "grade" not in parsed or "rubric_scores" not in parsed:
            return None
        return parsed
    except json.JSONDecodeError:
        # Try to extract JSON from mixed content
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                return None
        return None
