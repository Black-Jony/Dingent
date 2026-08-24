# GenBase RAG plugin

This MCP plugin gives a Dingent workflow evidence-backed answers from the curated GenBase QA workbook. It uses a multilingual MiniLM ONNX model through FastEmbed in a local Chroma index and combines vector ranking with lexical ranking for error codes, accessions, and field names.

## Build the knowledge index

From this directory:

```powershell
uv sync --extra dev
uv run genbase-rag-ingest `
  --source "D:\StudyFiles\MasterStage\研二\260817讨论\问答知识库（向量库）GenBase汇总QA20251218.xlsx" `
  --output-dir data `
  --version 2025-12-18
```

The source workbook, normalized JSONL, Chroma index, model cache, and virtual environment are intentionally excluded from Git. Keep them in the deployed instance's persistent data volume.

Index builds use a staging directory and only replace the active Chroma directory after the new entry count has been verified. QA identifiers are derived from normalized question-answer content, so reordering workbook rows does not change citations.

## Install into a Dingent instance

Copy this directory to:

```text
<DINGENT_HOME>/plugins/GenBaseRAG
```

Build the index in that copied directory, restart Dingent, and add `GenBase Knowledge Base` to the GenBase assistant or workflow.

For local development, `start_genbase_backend.bat` uses a dedicated Dingent home at `D:\StudyFiles\MasterStage\work\Agent\dingent_genbase_rag`, backend port `8002`, and a persistent FastEmbed cache. It creates a directory junction from that instance's `plugins\GenBaseRAG` directory to this extension, keeping the Resource instance's database, logs, plugins, and cache separate.

Recommended workflow instruction:

```text
For every GenBase-specific question, first call search_genbase_knowledge. When knowledge_base_hit is true, use the returned QA entries as the factual basis of the answer without exposing internal knowledge IDs, retrieval scores, or retrieval metadata. When knowledge_base_hit is false and fallback_allowed is true, answer using general model knowledge. For screenshots, extract the visible error code and relevant text before searching. Answer in the user's language while preserving official field names and error codes.
```

## Runtime configuration

- `GENBASE_RAG_DATA_DIR`: directory containing `genbase_qa.jsonl` and `chroma/`.
- `GENBASE_EMBEDDING_MODEL`: FastEmbed model name. Defaults to `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (about 0.22 GB, multilingual).
- `GENBASE_RAG_MIN_VECTOR_SCORE`: minimum cosine similarity. Defaults to `0.65` and should be calibrated with the evaluation questions.
- `GENBASE_RAG_MIN_LEXICAL_SCORE`: minimum lexical overlap. Defaults to `0.18`.
- `FASTEMBED_CACHE_PATH`: persistent model cache directory, recommended for offline deployments.

## Tests

```powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
```
