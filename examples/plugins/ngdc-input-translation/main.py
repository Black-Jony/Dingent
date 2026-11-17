from __future__ import annotations

import aiohttp
from fastmcp import FastMCP

mcp = FastMCP("ngdc-input-translation")
TRANSLATION_URL = "https://ngdc.cncb.ac.cn/translation/translate/translate"


@mcp.tool()
async def translate_to_english(text: str) -> str:
    """Translate text to English using the NGDC translation service."""
    if not text.strip():
        return text
    async with (
        aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session,
        session.post(
            TRANSLATION_URL,
            json={"sourceLang": "auto", "targetLang": "en_XX", "text": text},
            headers={"Accept": "application/json", "X-Requested-With": "XMLHttpRequest", "Referer": "https://ngdc.cncb.ac.cn/translation/"},
            allow_redirects=False,
        ) as response,
    ):
        response.raise_for_status()
        payload = await response.json()
    translation = payload.get("translatedText") if isinstance(payload, dict) else None
    if not isinstance(translation, str) or not translation.strip():
        raise ValueError("NGDC did not return translatedText.")
    return translation


if __name__ == "__main__":
    mcp.run()
