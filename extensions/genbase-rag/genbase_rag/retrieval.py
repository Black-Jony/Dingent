from __future__ import annotations

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from genbase_rag.embedding import create_text_embedding
from genbase_rag.ingest import DEFAULT_COLLECTION, DEFAULT_EMBEDDING_MODEL
from genbase_rag.models import KnowledgeEntry, SearchResult
from genbase_rag.text import has_exact_technical_identifiers, rank_lexically


class TextEmbedder(Protocol):
    def encode_query(self, query: str) -> list[float]: ...


class FastEmbedder:
    def __init__(self, model_name: str = DEFAULT_EMBEDDING_MODEL) -> None:
        self._model = create_text_embedding(model_name)

    def encode_query(self, query: str) -> list[float]:
        return next(self._model.query_embed(query)).tolist()


def load_entries(source: Path) -> list[KnowledgeEntry]:
    with source.open(encoding="utf-8") as stream:
        return [KnowledgeEntry.from_dict(json.loads(line)) for line in stream if line.strip()]


def fuse_rankings(
    entries: Sequence[KnowledgeEntry],
    vector_results: Sequence[tuple[str, float]],
    lexical_results: Sequence[tuple[str, float]],
    limit: int,
    rank_constant: int = 60,
    priority_ids: set[str] | None = None,
) -> list[SearchResult]:
    entries_by_id = {entry.id: entry for entry in entries}
    vector_scores = dict(vector_results)
    lexical_scores = dict(lexical_results)
    fused_scores: dict[str, float] = {}
    for ranking in (vector_results, lexical_results):
        for rank, (entry_id, _) in enumerate(ranking, start=1):
            if entry_id in entries_by_id:
                fused_scores[entry_id] = fused_scores.get(entry_id, 0.0) + 1 / (rank_constant + rank)
    for entry_id in priority_ids or set():
        if entry_id in fused_scores:
            fused_scores[entry_id] += 1.0

    ordered = sorted(fused_scores, key=lambda entry_id: (-fused_scores[entry_id], entry_id))[:limit]
    maximum = max((fused_scores[entry_id] for entry_id in ordered), default=1.0)
    return [
        SearchResult(
            entry=entries_by_id[entry_id],
            score=fused_scores[entry_id] / maximum,
            vector_score=vector_scores.get(entry_id, 0.0),
            lexical_score=lexical_scores.get(entry_id, 0.0),
        )
        for entry_id in ordered
    ]


class GenBaseRetriever:
    def __init__(
        self,
        entries_path: Path,
        chroma_path: Path,
        model_name: str = DEFAULT_EMBEDDING_MODEL,
        collection_name: str = DEFAULT_COLLECTION,
        embedder: TextEmbedder | None = None,
        minimum_vector_score: float = 0.65,
        minimum_lexical_score: float = 0.18,
    ) -> None:
        import chromadb

        self._entries = load_entries(entries_path)
        self._client = chromadb.PersistentClient(path=str(chroma_path))
        self._collection = self._client.get_collection(collection_name)
        self._embedder = embedder or FastEmbedder(model_name)
        self._minimum_vector_score = minimum_vector_score
        self._minimum_lexical_score = minimum_lexical_score

    def close(self) -> None:
        self._client.close()

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        if not query.strip():
            return []
        candidate_count = min(max(top_k * 4, 12), len(self._entries))
        response = self._collection.query(
            query_embeddings=[self._embedder.encode_query(query)],
            n_results=candidate_count,
            include=["distances"],
        )
        ids = response.get("ids", [[]])[0]
        distances = response.get("distances", [[]])[0]
        vector_results = [(entry_id, max(0.0, 1.0 - float(distance))) for entry_id, distance in zip(ids, distances, strict=True)]
        lexical_results = rank_lexically(query, self._entries, candidate_count)
        relevant_ids = {entry_id for entry_id, score in vector_results if score >= self._minimum_vector_score} | {
            entry_id for entry_id, score in lexical_results if score >= self._minimum_lexical_score
        }
        if not relevant_ids:
            return []
        relevant_vector_results = [item for item in vector_results if item[0] in relevant_ids]
        relevant_lexical_results = [item for item in lexical_results if item[0] in relevant_ids]
        priority_ids = {entry.id for entry in self._entries if entry.id in relevant_ids and has_exact_technical_identifiers(query, entry)}
        return fuse_rankings(self._entries, relevant_vector_results, relevant_lexical_results, top_k, priority_ids=priority_ids)
