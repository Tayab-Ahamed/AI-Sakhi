"""Evidence-first RAG retrieval with page-level textbook citations."""
from __future__ import annotations

import logging
import os
from backend.config import CHROMA_PATH

_collection = None
logger = logging.getLogger("sakhi.rag")


def get_collection():
    global _collection
    if _collection is None:
        import chromadb
        from chromadb.utils import embedding_functions
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        _collection = client.get_or_create_collection(name="ncert_chunks", embedding_function=ef, metadata={"hnsw:space": "cosine"})
    return _collection


def retrieve_evidence(query: str, n_results: int = 4, filters: dict | None = None) -> list[dict]:
    """Return attributable evidence. Low-relevance chunks are excluded."""
    try:
        col = get_collection(); count = col.count()
        if not count: return []
        where = {k: v for k, v in (filters or {}).items() if v not in (None, "")}
        result = col.query(query_texts=[query], n_results=min(max(1, n_results), count), where=where or None, include=["documents", "metadatas", "distances"])
        docs=(result.get("documents") or [[]])[0]; metas=(result.get("metadatas") or [[]])[0]; distances=(result.get("distances") or [[]])[0]
        max_distance=float(os.getenv("RAG_MAX_DISTANCE", "0.72")); evidence=[]
        for doc,meta,distance in zip(docs,metas,distances):
            if distance is not None and float(distance)>max_distance: continue
            meta=meta or {}
            evidence.append({"text":doc,"source":meta.get("source","Unknown textbook"),"page":meta.get("page_number"),"board":meta.get("board"),"class_level":meta.get("class_level"),"subject":meta.get("subject"),"chapter":meta.get("chapter"),"distance":round(float(distance),4) if distance is not None else None})
        return evidence
    except Exception:
        logger.exception("RAG retrieval failed")
        return []


def retrieve_context(query: str, n_results: int = 4, filters: dict | None = None) -> str:
    """Format retrieved evidence for the model with explicit source boundaries."""
    evidence=retrieve_evidence(query,n_results,filters)
    blocks=[]
    for index,item in enumerate(evidence,1):
        attrs=[f"Source: {item['source']}"]
        if item.get("page") is not None: attrs.append(f"Page: {item['page']}")
        for label,key in (("Board","board"),("Class","class_level"),("Subject","subject"),("Chapter","chapter")):
            if item.get(key): attrs.append(f"{label}: {item[key]}")
        blocks.append(f"[Evidence {index} | {' | '.join(attrs)}]\n{item['text']}")
    return "\n\n---\n\n".join(blocks)


def is_rag_ready() -> bool:
    try: return get_collection().count()>0
    except Exception: return False


def get_rag_stats() -> dict:
    try:
        count=get_collection().count(); return {"chunk_count":count,"ready":count>0,"citation_mode":"page-level"}
    except Exception: return {"chunk_count":0,"ready":False,"citation_mode":"page-level"}


def get_rag_catalog() -> dict:
    empty={"ready":False,"classes":[],"subjects":[],"chapters":[],"sources":[]}
    try:
        col=get_collection(); count=col.count()
        if not count: return empty
        result=col.get(limit=min(count,10000),include=["metadatas"]); maps={"class_level":{},"subject":{},"chapter":{},"source":{}}
        for meta in result.get("metadatas") or []:
            for key,mapping in maps.items():
                value=str((meta or {}).get(key,"")).strip()
                if value: mapping[value]=mapping.get(value,0)+1
        output={"ready":True}
        names={"class_level":"classes","subject":"subjects","chapter":"chapters","source":"sources"}
        for key,mapping in maps.items(): output[names[key]]=sorted(({"label":k,"count":v} for k,v in mapping.items()),key=lambda x:x["label"])
        return output
    except Exception:
        logger.exception("RAG catalog failed"); return empty
