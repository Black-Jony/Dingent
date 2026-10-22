from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

RESPONSE_LANGUAGES = {
    "en": "English",
    "zh-CN": "Simplified Chinese",
    "fr": "French",
    "ja": "Japanese",
    "ru": "Russian",
    "ar": "Arabic",
    "es": "Spanish",
}


def normalize_response_locale(value: Any) -> str | None:
    return value if isinstance(value, str) and value in RESPONSE_LANGUAGES else None


def with_response_language_hint(message: HumanMessage, locale: str) -> HumanMessage:
    hint = f"Response language: {RESPONSE_LANGUAGES[locale]} ({locale}). Answer in this language only."
    content = message.content
    updated_content = f"{content}\n\n{hint}" if isinstance(content, str) else [*content, {"type": "text", "text": hint}]
    return message.model_copy(update={"content": updated_content})


def with_response_language(system_message: SystemMessage | None, locale: str) -> SystemMessage:
    language = RESPONSE_LANGUAGES[locale]
    instruction = (
        f"Current response language: {language} ({locale}). "
        f"Write all newly generated user-facing answers, explanations, headings, and progress text in {language}. "
        "Use this language even when the user's question, earlier conversation, agent instructions, "
        "retrieved knowledge, or tool results are in another language. "
        "Translate explanatory prose while preserving the meaning and the agent's other task and safety constraints. "
        "Keep gene names, variant identifiers, accession numbers, URLs, file paths, code, and original data values unchanged. "
        "Do not rewrite earlier conversation messages."
    )
    if system_message is None:
        return SystemMessage(content=instruction)

    content = system_message.content
    updated_content = f"{content}\n\n{instruction}" if isinstance(content, str) else [*content, {"type": "text", "text": instruction}]
    return system_message.model_copy(update={"content": updated_content})
