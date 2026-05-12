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
