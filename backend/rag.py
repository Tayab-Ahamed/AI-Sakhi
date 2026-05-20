"""
RAG pipeline for AI Sakhi.
Handles retrieval from ChromaDB using sentence-transformers embeddings.
"""
from backend.config import CHROMA_PATH

# Lazy-loaded globals
_collection = None


def get_collection():
    """Lazy-load ChromaDB collection."""
    global _collection
    if _collection is None:
        import chromadb
        from chromadb.utils import embedding_functions

        client = chromadb.PersistentClient(path=CHROMA_PATH)
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        _collection = client.get_or_create_collection(
            name="ncert_chunks",
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def retrieve_context(query: str, n_results: int = 3) -> str:
    """Retrieve relevant NCERT chunks for a query. Returns empty string if RAG not ready."""
    try:
        col = get_collection()
        if col.count() == 0:
            return ""
        results = col.query(
            query_texts=[query],
            n_results=min(n_results, col.count()),
        )
        if results and results["documents"] and results["documents"][0]:
            return "\n\n---\n\n".join(results["documents"][0])
        return ""
    except Exception as e:
        print(f"[RAG] Retrieval error: {e}")
        return ""


def is_rag_ready() -> bool:
    """Returns True if ChromaDB has indexed documents."""
    try:
        return get_collection().count() > 0
    except Exception:
        return False


def get_rag_stats() -> dict:
    """Return stats about the RAG index."""
    try:
        count = get_collection().count()
        return {"chunk_count": count, "ready": count > 0}
    except Exception:
        return {"chunk_count": 0, "ready": False}


def get_rag_catalog() -> dict:
    """Return the catalog of available classes, subjects, chapters, and sources in the RAG index."""
    try:
        col = get_collection()
        count = col.count()
        if count == 0:
            return {"ready": False, "classes": [], "subjects": [], "chapters": [], "sources": []}

        # Fetch all metadata (up to 10,000 items — adjust if corpus is larger)
        result = col.get(limit=min(count, 10000), include=["metadatas"])
        metadatas = result.get("metadatas") or []

        classes_map: dict[str, int] = {}
        subjects_map: dict[str, int] = {}
        chapters_map: dict[str, int] = {}
        sources_map: dict[str, int] = {}

        for meta in metadatas:
            if not meta:
                continue
            for key, mapping in [
                ("class_level", classes_map),
                ("subject", subjects_map),
                ("chapter", chapters_map),
                ("source", sources_map),
            ]:
                val = str(meta.get(key, "")).strip()
                if val:
                    mapping[val] = mapping.get(val, 0) + 1

        def to_list(m: dict) -> list:
            return sorted([{"label": k, "count": v} for k, v in m.items()], key=lambda x: x["label"])

        return {
            "ready": True,
            "classes": to_list(classes_map),
            "subjects": to_list(subjects_map),
            "chapters": to_list(chapters_map),
            "sources": to_list(sources_map),
        }
    except Exception as exc:
        print(f"[RAG] Catalog error: {exc}")
        return {"ready": False, "classes": [], "subjects": [], "chapters": [], "sources": []}
