from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class KnowledgeEntry:
    id: str
    question: str
    answer: str
    category: str = "Uncategorized"
    keywords: tuple[str, ...] = field(default_factory=tuple)
    source_url: str = ""
    language: str = "zh-CN"
    version: str = ""

    @property
    def document_text(self) -> str:
        return f"Question: {self.question}\nAnswer: {self.answer}"

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["keywords"] = list(self.keywords)
        return payload

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> KnowledgeEntry:
        return cls(
            id=str(payload["id"]),
            question=str(payload["question"]),
            answer=str(payload["answer"]),
            category=str(payload.get("category") or "Uncategorized"),
            keywords=tuple(str(value) for value in payload.get("keywords") or ()),
            source_url=str(payload.get("source_url") or ""),
            language=str(payload.get("language") or "zh-CN"),
            version=str(payload.get("version") or ""),
        )


@dataclass(frozen=True, slots=True)
class SearchResult:
    entry: KnowledgeEntry
    score: float
    vector_score: float
    lexical_score: float

    def to_dict(self) -> dict[str, Any]:
        return {
            **self.entry.to_dict(),
            "score": round(self.score, 6),
            "vector_score": round(self.vector_score, 6),
            "lexical_score": round(self.lexical_score, 6),
        }
