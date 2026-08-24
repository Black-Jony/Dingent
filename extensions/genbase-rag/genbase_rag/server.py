from __future__ import annotations

import argparse
import asyncio
import json
import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from genbase_rag.ingest import DEFAULT_EMBEDDING_MODEL
from genbase_rag.retrieval import GenBaseRetriever


def build_payload(query: str, results: list[Any]) -> dict[str, Any]:
    if not results:
        return {
            "knowledge_base_hit": False,
            "fallback_allowed": True,
            "model_text": "The GenBase QA knowledge base did not return supporting evidence. Answer the user using general model knowledge.",
            "results": [],
        }

    evidence = []
    for result in results:
        entry = result.entry
        evidence.append(f"Question: {entry.question}\nAnswer: {entry.answer}\nSource: {entry.source_url or 'curated GenBase QA'}")

    return {
        "knowledge_base_hit": True,
        "fallback_allowed": False,
        "model_text": f"Use only the following GenBase evidence to answer the user query '{query}'. Do not mention internal knowledge IDs, retrieval scores, or retrieval metadata in the user-visible answer.\n\n" + "\n\n".join(evidence),
        "results": [],
    }


def create_server(retriever: GenBaseRetriever) -> Server:
    server = Server("genbase-rag")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="search_genbase_knowledge",
                description="Search the curated GenBase submission and annotation QA knowledge base. Call this before answering any GenBase-specific question.",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The user's GenBase question or text extracted from a screenshot or voice transcript."},
                        "top_k": {"type": "integer", "minimum": 1, "maximum": 10, "default": 5},
                    },
                    "required": ["query"],
                },
            )
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        if name != "search_genbase_knowledge":
            raise ValueError(f"Unknown tool: {name}")
        query = str(arguments.get("query") or "").strip()
        top_k = min(max(int(arguments.get("top_k", 5)), 1), 10)
        results = await asyncio.to_thread(retriever.search, query, top_k)
        return [TextContent(type="text", text=json.dumps(build_payload(query, results), ensure_ascii=False))]

    return server


def parse_args(args: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the GenBase RAG MCP server.")
    plugin_root = Path(__file__).resolve().parents[1]
    parser.add_argument("--data-dir", type=Path, default=Path(os.getenv("GENBASE_RAG_DATA_DIR", plugin_root / "data")))
    parser.add_argument("--model", default=os.getenv("GENBASE_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL))
    parser.add_argument("--minimum-vector-score", type=float, default=float(os.getenv("GENBASE_RAG_MIN_VECTOR_SCORE", "0.65")))
    parser.add_argument("--minimum-lexical-score", type=float, default=float(os.getenv("GENBASE_RAG_MIN_LEXICAL_SCORE", "0.18")))
    return parser.parse_args(args)


async def run(args: Sequence[str] | None = None) -> None:
    options = parse_args(args)
    retriever = GenBaseRetriever(
        options.data_dir / "genbase_qa.jsonl",
        options.data_dir / "chroma",
        model_name=options.model,
        minimum_vector_score=options.minimum_vector_score,
        minimum_lexical_score=options.minimum_lexical_score,
    )
    server = create_server(retriever)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()
