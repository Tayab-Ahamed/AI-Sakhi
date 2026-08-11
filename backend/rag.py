"""Evidence-first RAG retrieval with page-level textbook citations.

Design notes:
  * the embedding model is configurable and defaults to a *multilingual* model,
    because learners ask questions in Hindi/Kannada/Tamil as well as English;
  * retrieval returns structured citations that are propagated all the way to
    the UI, so an answer can always be traced back to a textbook page;
  * the catalog scan is cached with a TTL instead of reading 10k metadata rows
    on every request.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

from backend.config import settings

logger = logging.getLogger("sakhi.rag")

_collection: Any = None
_collection_lock = threading.Lock()
_catalog_cache: tuple[float, dict] | None = None

COLLECTION_NAME = "ncert_chunks"


def get_collection():
    """Return the shared Chroma collection, building it on first use."""
    global _collection
    if _collection is not None:
        return _collection
    with _collection_lock:
        if _collection is None:
            import chromadb
            from chromadb.utils import embedding_functions

            client = chromadb.PersistentClient(path=settings.chroma_path)
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.embedding_model
            )
            _collection = client.get_or_create_collection(
                name=COLLECTION_NAME,
                embedding_function=ef,
                metadata={"hnsw:space": "cosine", "embedding_model": settings.embedding_model},
            )
    return _collection


def reset_collection() -> None:
    """Testing hook: drop cached handles."""
    global _collection, _catalog_cache
    _collection = None
    _catalog_cache = None


def _citation_label(meta: dict) -> str:
    parts = [str(meta.get("source") or "Textbook")]
    if meta.get("chapter"):
        parts.append(str(meta["chapter"]))
    if meta.get("page") is not None:
        parts.append(f"p.{meta['page']}")
    return " — ".join(parts)


def retrieve_evidence(query: str, n_results: int = 4, filters: dict | None = None) -> list[dict]:
    """Return attributable evidence, ordered best-first. Never raises."""
    if not (query or "").strip():
        return []
    try:
        col = get_collection()
        count = col.count()
        if not count:
            return []

        where = {k: v for k, v in (filters or {}).items() if v not in (None, "")}
        # Over-fetch then filter by distance so a strict threshold still returns hits.
        wanted = min(max(1, n_results) * settings.rag_candidate_multiplier, count)
        result = col.query(
            query_texts=[query],
            n_results=wanted,
            where=where or None,
            include=["documents", "metadatas", "distances"],
        )
        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]

        evidence: list[dict] = []
        for index, (doc, meta, distance) in enumerate(zip(docs, metas, distances)):
            if distance is not None and float(distance) > settings.rag_max_distance:
                continue
            meta = meta or {}
            item = {
                "id": f"e{len(evidence) + 1}",
                "rank": index + 1,
                "text": doc,
                "source": meta.get("source", "Unknown textbook"),
                "page": meta.get("page_number"),
                "board": meta.get("board"),
                "class_level": meta.get("class_level"),
                "subject": meta.get("subject"),
                "chapter": meta.get("chapter"),
                "distance": round(float(distance), 4) if distance is not None else None,
            }
            item["score"] = round(max(0.0, 1.0 - float(item["distance"] or 0)), 4)
            item["label"] = _citation_label(item)
            evidence.append(item)
            if len(evidence) >= n_results:
                break
        return evidence
    except Exception:
        logger.exception("RAG retrieval failed")
        return []


def to_citations(evidence: list[dict], *, snippet_chars: int = 240) -> list[dict]:
    """Convert evidence into the citation payload returned to the client."""
    citations = []
    for index, item in enumerate(evidence, 1):
        text = (item.get("text") or "").strip().replace("\n", " ")
        citations.append(
            {
                "index": index,
                "label": item.get("label") or _citation_label(item),
                "source": item.get("source"),
                "page": item.get("page"),
                "chapter": item.get("chapter"),
                "subject": item.get("subject"),
                "class_level": item.get("class_level"),
                "board": item.get("board"),
                "score": item.get("score"),
                "snippet": text[:snippet_chars] + ("…" if len(text) > snippet_chars else ""),
            }
        )
    return citations


def format_evidence(evidence: list[dict]) -> str:
    """Format evidence for the model with explicit, numbered source boundaries."""
    blocks = []
    for index, item in enumerate(evidence, 1):
        attrs = [f"Source: {item['source']}"]
        if item.get("page") is not None:
            attrs.append(f"Page: {item['page']}")
        for label, key in (("Board", "board"), ("Class", "class_level"), ("Subject", "subject"), ("Chapter", "chapter")):
            if item.get(key):
                attrs.append(f"{label}: {item[key]}")
        blocks.append(f"[Evidence {index} | {' | '.join(attrs)}]\n{item['text']}")
    return "\n\n---\n\n".join(blocks)


def retrieve_context(query: str, n_results: int = 4, filters: dict | None = None) -> str:
    """Backwards-compatible string form of :func:`format_evidence`."""
    return format_evidence(retrieve_evidence(query, n_results, filters))


def retrieve(query: str, n_results: int = 4, filters: dict | None = None) -> dict:
    """One call returning the prompt block and the citations for the client."""
    evidence = retrieve_evidence(query, n_results, filters)
    return {
        "evidence": evidence,
        "context": format_evidence(evidence),
        "citations": to_citations(evidence),
    }


def is_rag_ready() -> bool:
    try:
        return get_collection().count() > 0
    except Exception:
        return False


def get_rag_stats() -> dict:
    try:
        count = get_collection().count()
    except Exception:
        count = 0
    return {
        "chunk_count": count,
        "ready": count > 0,
        "citation_mode": "page-level",
        "embedding_model": settings.embedding_model,
        "max_distance": settings.rag_max_distance,
    }


def get_rag_catalog() -> dict:
    """Distinct classes/subjects/chapters/sources present in the index (TTL cached)."""
    global _catalog_cache
    empty = {"ready": False, "classes": [], "subjects": [], "chapters": [], "sources": []}

    if _catalog_cache and _catalog_cache[0] > time.time():
        return _catalog_cache[1]

    try:
        col = get_collection()
        count = col.count()
        if not count:
            return empty
        result = col.get(limit=min(count, 10_000), include=["metadatas"])
        maps: dict[str, dict[str, int]] = {"class_level": {}, "subject": {}, "chapter": {}, "source": {}}
        for meta in result.get("metadatas") or []:
            for key, mapping in maps.items():
                value = str((meta or {}).get(key, "")).strip()
                if value:
                    mapping[value] = mapping.get(value, 0) + 1
        names = {"class_level": "classes", "subject": "subjects", "chapter": "chapters", "source": "sources"}
        output: dict[str, Any] = {"ready": True}
        for key, mapping in maps.items():
            output[names[key]] = sorted(
                ({"label": label, "count": total} for label, total in mapping.items()),
                key=lambda entry: entry["label"],
            )
        if settings.rag_catalog_ttl_seconds:
            _catalog_cache = (time.time() + settings.rag_catalog_ttl_seconds, output)
        return output
    except Exception:
        logger.exception("RAG catalog failed")
        return empty
