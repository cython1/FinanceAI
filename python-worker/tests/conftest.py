"""Shared test fixtures. Tests never read a developer's real .env and never call Azure."""

import pytest

from financeai_worker.config import Settings, load_settings

VALID_ENV = {
    "AZURE_OPENAI_ENDPOINT": "https://fai-openai-test.openai.azure.com/",
    "AZURE_OPENAI_API_VERSION": "2024-10-21",
    "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": "text-embedding-3-small",
    "AZURE_OPENAI_EMBEDDING_DIMENSIONS": "1536",
    "AZURE_OPENAI_CHAT_DEPLOYMENT": "gpt-5-mini",
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://fai-docintel-test.cognitiveservices.azure.com/",
    "AZURE_SEARCH_ENDPOINT": "https://fai-search-test.search.windows.net",
    "AZURE_SEARCH_INDEX_NAME": "financial-reports",
    "AZURE_STORAGE_BLOB_ENDPOINT": "https://faisttest.blob.core.windows.net",
    "AZURE_STORAGE_QUEUE_ENDPOINT": "https://faisttest.queue.core.windows.net",
    "AZURE_STORAGE_BLOB_CONTAINER": "raw-pdfs",
    "AZURE_STORAGE_QUEUE_NAME": "ingestion-jobs",
    "AZURE_SQL_SERVER": "fai-sql-test.database.windows.net",
    "AZURE_SQL_DATABASE": "financeai",
}


@pytest.fixture
def env(monkeypatch):
    """Start from a clean environment with every required variable set."""
    for name in Settings.model_fields:
        monkeypatch.delenv(name.upper(), raising=False)
    for name, value in VALID_ENV.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


@pytest.fixture
def settings(env):
    """Settings built from VALID_ENV only."""
    return load_settings(_env_file=None)
