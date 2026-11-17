from __future__ import annotations

import asyncio
import re
from collections.abc import Awaitable, Callable

from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain.agents.middleware.types import ModelCallResult
from langchain.tools import BaseTool
from langchain_core.messages import HumanMessage
from loguru import logger

TRANSLATION_PLUGIN_ID = "ngdc-input-translation"
TRANSLATION_TOOL_NAME = "translate_to_english"
_PROTECTED = re.compile(r"(```[\s\S]*?```|`[^`\n]+`|https?://[^\s<>]+)")


class InputTranslationError(ValueError):
    """The input translation service could not translate a user message."""


class InputTranslationMiddleware(AgentMiddleware):
    def __init__(self, tool: BaseTool) -> None:
        self._tool = tool
        self._cache: dict[str, str] = {}

    async def _translate_text(self, text: str) -> str:
        parts = _PROTECTED.split(text)
        for index in range(0, len(parts), 2):
            part = parts[index]
            body = part.strip()
            if not body:
                continue
            if body not in self._cache:
                result = await self._tool.ainvoke({"text": body})
                if isinstance(result, list):
                    result = "".join(block["text"] for block in result if isinstance(block, dict) and block.get("type") == "text")
                if not isinstance(result, str) or not result.strip():
                    raise ValueError("The translation tool returned no text.")
                self._cache[body] = result.strip()
            parts[index] = part[: len(part) - len(part.lstrip())] + self._cache[body] + part[len(part.rstrip()) :]
        return "".join(parts)

    async def _translate_message(self, message: HumanMessage) -> HumanMessage:
        if isinstance(message.content, str):
            content = await self._translate_text(message.content)
        else:
            content = [
                {**block, "text": await self._translate_text(block["text"])}
                if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str)
                else await self._translate_text(block)
                if isinstance(block, str)
                else block
                for block in message.content
            ]
        return message.model_copy(update={"content": content})

    async def awrap_model_call(self, request: ModelRequest, handler: Callable[[ModelRequest], Awaitable[ModelResponse]]) -> ModelCallResult:
        try:
            async with asyncio.timeout(30):
                messages = [await self._translate_message(message) if isinstance(message, HumanMessage) else message for message in request.messages]
        except Exception as exc:
            logger.warning("NGDC context translation failed: {}", type(exc).__name__)
            raise InputTranslationError("Could not translate the question. Please try again.") from None
        return await handler(request.override(messages=messages))
