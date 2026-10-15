"""Metadata must never download or initialize a sentence-transformer model."""

import sys
from types import ModuleType
from unittest.mock import Mock

import pytest

from backend import rag


@pytest.fixture
def vector_store(monkeypatch):
    chroma = ModuleType("chromadb")
    utils = ModuleType("chromadb.utils")
    embeddings = ModuleType("chromadb.utils.embedding_functions")
    errors = ModuleType("chromadb.errors")
    errors.NotFoundError = type("NotFoundError", (Exception,), {})
    embeddings.SentenceTransformerEmbeddingFunction = Mock(return_value=object())
    utils.embedding_functions = embeddings
    chroma.errors = errors
    client = Mock()
    collection = Mock()
    collection.count.return_value = 3
    collection.get.return_value = {
        "metadatas": [
            {"class_level": "8", "subject": "Math", "chapter": "Fractions", "source": "Synthetic"},
            {"class_level": "8", "subject": "Math", "chapter": "Fractions", "source": "Synthetic"},
            {"class_level": "9", "subject": "Science", "source": "Synthetic"},
        ]
    }
    client.get_collection.return_value = collection
    client.get_or_create_collection.return_value = collection
    chroma.PersistentClient = Mock(return_value=client)
    for name, module in [
        ("chromadb", chroma),
        ("chromadb.utils", utils),
        ("chromadb.utils.embedding_functions", embeddings),
        ("chromadb.errors", errors),
    ]:
        monkeypatch.setitem(sys.modules, name, module)
    rag.reset_collection()
    yield chroma, client, collection, embeddings.SentenceTransformerEmbeddingFunction
    rag.reset_collection()


def test_stats_reads_real_count_without_loading_embeddings(vector_store):
    _, client, _, model = vector_store
    assert rag.get_rag_stats()["chunk_count"] == 3
    model.assert_not_called()
    client.get_collection.assert_called_with(name=rag.COLLECTION_NAME, embedding_function=None)
    client.get_or_create_collection.assert_not_called()


def test_catalog_reads_and_caches_metadata_without_loading_embeddings(vector_store):
    _, _, collection, model = vector_store
    catalog = rag.get_rag_catalog()
    assert catalog["classes"] == [{"label": "8", "count": 2}, {"label": "9", "count": 1}]
    assert catalog["subjects"] == [{"label": "Math", "count": 2}, {"label": "Science", "count": 1}]
    assert rag.get_rag_catalog() == catalog
    assert collection.get.call_count == 1
    model.assert_not_called()


def test_readiness_does_not_load_embeddings(vector_store):
    *_, model = vector_store
    assert rag.is_rag_ready()
    model.assert_not_called()


def test_missing_index_is_empty_without_creating_one(vector_store):
    chroma, client, _, model = vector_store
    client.get_collection.side_effect = chroma.errors.NotFoundError()
    assert rag.get_rag_stats()["chunk_count"] == 0
    assert rag.get_rag_catalog()["ready"] is False
    assert not rag.is_rag_ready()
    client.get_or_create_collection.assert_not_called()
    model.assert_not_called()


def test_retrieval_still_initializes_configured_model_once(vector_store):
    _, client, collection, model = vector_store
    assert rag.get_collection() is collection
    assert rag.get_collection() is collection
    model.assert_called_once_with(model_name=rag.settings.embedding_model)
    assert client.get_or_create_collection.call_args.kwargs["embedding_function"] is model.return_value
