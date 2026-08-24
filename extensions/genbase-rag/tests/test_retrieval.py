import json
from pathlib import Path

import numpy as np
import pytest

from genbase_rag.ingest import create_entry_id, rebuild_vector_index, write_jsonl
from genbase_rag.models import KnowledgeEntry
from genbase_rag.retrieval import GenBaseRetriever, fuse_rankings
from genbase_rag.server import build_payload
from genbase_rag.text import extract_urls, has_exact_technical_identifiers, lexical_score, normalize_text


def _entry(entry_id: str, question: str, answer: str) -> KnowledgeEntry:
    return KnowledgeEntry(id=entry_id, question=question, answer=answer)


def test_normalize_text_removes_invisible_spacing() -> None:
    assert normalize_text(" GenBase\u00a0  submission\r\n\r\n data ") == "GenBase submission\ndata"


def test_extract_urls_preserves_first_seen_order() -> None:
    text = "See https://ngdc.cncb.ac.cn/genbase/qc and https://ngdc.cncb.ac.cn/genbase/filespec."
    assert extract_urls(text) == ("https://ngdc.cncb.ac.cn/genbase/qc", "https://ngdc.cncb.ac.cn/genbase/filespec")


def test_lexical_score_prefers_matching_error_code() -> None:
    matching = _entry("GBQA-0001", "SEQ_FEAT.InternalStop error", "Check the genetic code and partial gene annotation.")
    unrelated = _entry("GBQA-0002", "How to submit data", "Upload a FASTA file.")
    query = "How do I fix SEQ_FEAT.InternalStop?"
    assert lexical_score(query, matching) > lexical_score(query, unrelated)


def test_exact_technical_identifier_requires_the_full_identifier() -> None:
    matching = _entry("GBQA-0001", "SEQ_FEAT.InternalStop error", "Check the annotation.")
    partial = _entry("GBQA-0002", "SEQ_FEAT.SeqFeatXrefNotReciprocal error", "Compare this with SEQ_FEAT.InternalStop.")
    query = "How do I fix SEQ_FEAT.InternalStop?"
    assert has_exact_technical_identifiers(query, matching)
    assert not has_exact_technical_identifiers(query, partial)


def test_fuse_rankings_uses_both_retrievers() -> None:
    entries = [
        _entry("A", "Question A", "Answer A"),
        _entry("B", "Question B", "Answer B"),
        _entry("C", "Question C", "Answer C"),
    ]
    results = fuse_rankings(entries, [("A", 0.9), ("B", 0.8)], [("B", 1.0), ("C", 0.7)], limit=3)
    assert [result.entry.id for result in results] == ["B", "A", "C"]
    assert results[0].score == 1.0


def test_fuse_rankings_promotes_an_exact_identifier_match() -> None:
    entries = [
        _entry("A", "Similar vector result", "Answer A"),
        _entry("B", "SEQ_FEAT.InternalStop error", "Answer B"),
    ]
    results = fuse_rankings(entries, [("A", 0.9)], [("A", 0.7), ("B", 0.65)], limit=2, priority_ids={"B"})
    assert [result.entry.id for result in results] == ["B", "A"]
    assert results[0].score == 1.0


def test_empty_knowledge_result_allows_model_fallback() -> None:
    payload = build_payload("An uncovered question", [])
    assert payload["knowledge_base_hit"] is False
    assert payload["fallback_allowed"] is True
    assert payload["results"] == []
    assert "display" not in payload
    assert "using general model knowledge" in payload["model_text"]


def test_knowledge_result_is_text_only() -> None:
    entry = _entry("GBQA-0001", "How do I submit data?", "Use the portal.")
    result = fuse_rankings([entry], [(entry.id, 0.9)], [(entry.id, 1.0)], limit=1)
    payload = build_payload("How do I submit data?", result)

    assert payload["knowledge_base_hit"] is True
    assert "GBQA-0001" not in payload["model_text"]
    assert "Do not mention internal knowledge IDs" in payload["model_text"]
    assert payload["results"] == []
    assert "GBQA-0001" not in json.dumps(payload)
    assert "display" not in payload


def test_entry_id_does_not_depend_on_workbook_row_order() -> None:
    first = create_entry_id("How do I submit data?", "Use the submission portal.")
    second = create_entry_id("How do I submit data?", "Use the submission portal.")
    changed_answer = create_entry_id("How do I submit data?", "Use the updated submission portal.")

    assert first == second
    assert first.startswith("GBQA-")
    assert first != changed_answer


def test_failed_vector_rebuild_preserves_existing_index(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    destination = tmp_path / "chroma"
    destination.mkdir()
    sentinel = destination / "existing-index.txt"
    sentinel.write_text("keep", encoding="utf-8")

    def fail_to_load_model(_model_name: str) -> None:
        raise RuntimeError("model unavailable")

    monkeypatch.setattr("genbase_rag.ingest.create_text_embedding", fail_to_load_model)
    with pytest.raises(RuntimeError, match="model unavailable"):
        rebuild_vector_index([_entry("A", "Question", "Answer")], destination, "test-model")

    assert sentinel.read_text(encoding="utf-8") == "keep"
    assert not list(tmp_path.glob(".chroma-*"))


class _FixedEmbeddingModel:
    def embed(self, documents: list[str]):
        for _document in documents:
            yield np.array([1.0, 0.0])


def test_successful_vector_rebuild_replaces_existing_index(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import chromadb

    destination = tmp_path / "chroma"
    destination.mkdir()
    sentinel = destination / "existing-index.txt"
    sentinel.write_text("replace", encoding="utf-8")
    monkeypatch.setattr("genbase_rag.ingest.create_text_embedding", lambda _model_name: _FixedEmbeddingModel())

    rebuild_vector_index([_entry("A", "Question", "Answer")], destination, "test-model")

    client = chromadb.PersistentClient(path=str(destination))
    collection = client.get_collection("genbase_qa")
    assert collection.count() == 1
    assert not sentinel.exists()
    assert not (tmp_path / ".chroma.backup").exists()
    client.close()


class _FixedEmbedder:
    def encode_query(self, _query: str) -> list[float]:
        return [1.0, 0.0]


@pytest.mark.parametrize(
    "query",
    [
        "如何向 GenBase 提交序列数据？",
        "How do I submit sequence data to GenBase?",
        "GenBase に配列データを提出するにはどうすればよいですか？",
    ],
)
def test_chroma_retriever_handles_multilingual_queries(tmp_path: Path, query: str) -> None:
    import chromadb

    entries = [
        _entry("GBQA-SUBMIT", "How to submit sequence data", "Use the GenBase submission portal."),
        _entry("GBQA-OTHER", "How to reset a password", "Use account settings."),
    ]
    entries_path = tmp_path / "genbase_qa.jsonl"
    chroma_path = tmp_path / "chroma"
    write_jsonl(entries, entries_path)
    client = chromadb.PersistentClient(path=str(chroma_path))
    collection = client.create_collection("genbase_qa", metadata={"hnsw:space": "cosine"})
    collection.add(
        ids=[entry.id for entry in entries],
        documents=[entry.document_text for entry in entries],
        embeddings=[[1.0, 0.0], [0.0, 1.0]],
    )
    client.close()

    retriever = GenBaseRetriever(
        entries_path,
        chroma_path,
        embedder=_FixedEmbedder(),
        minimum_vector_score=0.65,
        minimum_lexical_score=1.0,
    )
    results = retriever.search(query, top_k=1)

    assert [result.entry.id for result in results] == ["GBQA-SUBMIT"]
    retriever.close()
