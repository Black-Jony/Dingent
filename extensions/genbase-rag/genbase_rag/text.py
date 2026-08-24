from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable

from genbase_rag.models import KnowledgeEntry

URL_PATTERN = re.compile(r"https?://[^\s\]\[()<>\"']+")
ASCII_TERM_PATTERN = re.compile(r"[a-z0-9][a-z0-9_.:/-]*", re.IGNORECASE)
CJK_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]+")
STOP_TERMS = {
    "a",
    "an",
    "and",
    "are",
    "can",
    "could",
    "did",
    "do",
    "does",
    "for",
    "how",
    "i",
    "is",
    "of",
    "or",
    "please",
    "should",
    "the",
    "to",
    "we",
    "what",
    "why",
    "you",
    "一下",
    "什么",
    "可以",
    "如何",
    "怎么",
    "是否",
    "请问",
    "这个",
    "那个",
    "需要",
}


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = text.replace("\u00a0", " ").replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def extract_urls(text: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(match.rstrip(".,;:，。；：") for match in URL_PATTERN.findall(text)))


def _search_terms(text: str) -> set[str]:
    normalized = normalize_text(text).casefold()
    terms = set(ASCII_TERM_PATTERN.findall(normalized))
    for block in CJK_PATTERN.findall(normalized):
        if len(block) == 1:
            terms.add(block)
        else:
            terms.update(block[index : index + 2] for index in range(len(block) - 1))
    return terms - STOP_TERMS


def _is_technical_identifier(term: str) -> bool:
    return any(character.isdigit() or character in "._:/-" for character in term)


def technical_identifiers(text: str) -> set[str]:
    return {term for term in _search_terms(text) if _is_technical_identifier(term)}


def has_exact_technical_identifiers(query: str, entry: KnowledgeEntry) -> bool:
    identifiers = technical_identifiers(query)
    if not identifiers:
        return False
    entry_terms = _search_terms(f"{entry.question}\n{' '.join(entry.keywords)}")
    return identifiers <= entry_terms


def lexical_score(query: str, entry: KnowledgeEntry) -> float:
    normalized_query = normalize_text(query).casefold()
    if not normalized_query:
        return 0.0

    normalized_question = normalize_text(entry.question).casefold()
    normalized_answer = normalize_text(entry.answer).casefold()
    if normalized_query == normalized_question:
        return 1.0

    query_terms = _search_terms(normalized_query)
    if not query_terms:
        return 0.0

    question_terms = _search_terms(normalized_question)
    answer_terms = _search_terms(normalized_answer)
    question_overlap = len(query_terms & question_terms) / len(query_terms)
    answer_overlap = len(query_terms & answer_terms) / len(query_terms)
    identifiers = technical_identifiers(normalized_query)
    identifier_overlap = len(identifiers & (question_terms | answer_terms)) / len(identifiers) if identifiers else 0.0
    containment_bonus = 0.2 if normalized_query in normalized_question or normalized_question in normalized_query else 0.0
    return min(1.0, 0.6 * question_overlap + 0.2 * answer_overlap + 0.3 * identifier_overlap + containment_bonus)


def rank_lexically(query: str, entries: Iterable[KnowledgeEntry], limit: int) -> list[tuple[str, float]]:
    scored = ((entry.id, lexical_score(query, entry)) for entry in entries)
    return sorted((item for item in scored if item[1] > 0), key=lambda item: (-item[1], item[0]))[:limit]
