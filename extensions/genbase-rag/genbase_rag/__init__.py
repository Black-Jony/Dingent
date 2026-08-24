"""GenBase knowledge retrieval plugin."""

from genbase_rag.models import KnowledgeEntry, SearchResult
from genbase_rag.retrieval import GenBaseRetriever

__all__ = ["GenBaseRetriever", "KnowledgeEntry", "SearchResult"]
