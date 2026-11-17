import os
from types import SimpleNamespace

import pytest

from financeai_worker.config import load_settings
from financeai_worker.llm import azure_openai
from financeai_worker.llm.azure_openai import (
    EMBEDDING_BATCH_SIZE,
    chat,
    create_langchain_embeddings,
    create_openai_client,
    embed_texts,
)


class FakeEmbeddings:
    """Stands in for client.embeddings; returns vectors of a chosen size, out of order."""

    def __init__(self, size):
        self.size = size
        self.calls = []

    def create(self, *, model, input, dimensions):
        self.calls.append({"model": model, "input": list(input), "dimensions": dimensions})
        data = [
            SimpleNamespace(index=i, embedding=[float(len(text))] * self.size)
            for i, text in enumerate(input)
        ]
        return SimpleNamespace(data=list(reversed(data)))


def fake_client(embedding_size=1536, reply="ok"):
    chat_calls = []

    def create_chat(**kwargs):
        chat_calls.append(kwargs)
        message = SimpleNamespace(content=reply)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    client = SimpleNamespace(
        embeddings=FakeEmbeddings(embedding_size),
        chat=SimpleNamespace(completions=SimpleNamespace(create=create_chat)),
    )
    return client, chat_calls


def test_client_uses_api_key_when_set(env, mocker):
    env.setenv("AZURE_OPENAI_API_KEY", "test-key")
    constructor = mocker.patch.object(azure_openai, "AzureOpenAI")
    create_openai_client(load_settings(_env_file=None))
    kwargs = constructor.call_args.kwargs
    assert kwargs["api_key"] == "test-key"
    assert "azure_ad_token_provider" not in kwargs
    assert kwargs["azure_endpoint"] == "https://fai-openai-test.openai.azure.com/"
    assert kwargs["api_version"] == "2024-10-21"


def test_client_uses_entra_id_when_no_key(settings, mocker):
    constructor = mocker.patch.object(azure_openai, "AzureOpenAI")
    provider = mocker.patch.object(azure_openai, "_entra_token_provider", return_value="provider")
    create_openai_client(settings)
    kwargs = constructor.call_args.kwargs
    assert kwargs["azure_ad_token_provider"] == "provider"
    assert "api_key" not in kwargs
    provider.assert_called_once()


def test_langchain_embeddings_use_the_shared_deployment_and_dimensions(env):
    env.setenv("AZURE_OPENAI_API_KEY", "test-key")
    embeddings = create_langchain_embeddings(load_settings(_env_file=None))
    assert embeddings.deployment == "text-embedding-3-small"
    assert embeddings.dimensions == 1536


def test_embed_texts_batches_and_keeps_input_order(settings):
    client, _ = fake_client()
    texts = [f"chunk {'x' * i}" for i in range(EMBEDDING_BATCH_SIZE + 3)]
    vectors = embed_texts(texts, client=client, settings=settings)
    assert len(vectors) == len(texts)
    assert [v[0] for v in vectors] == [float(len(t)) for t in texts]
    assert [len(c["input"]) for c in client.embeddings.calls] == [EMBEDDING_BATCH_SIZE, 3]
    assert all(c["model"] == "text-embedding-3-small" for c in client.embeddings.calls)
    assert all(c["dimensions"] == 1536 for c in client.embeddings.calls)


def test_embed_texts_rejects_vectors_of_the_wrong_size(settings):
    client, _ = fake_client(embedding_size=3072)
    with pytest.raises(ValueError, match="AZURE_OPENAI_EMBEDDING_DIMENSIONS"):
        embed_texts(["text"], client=client, settings=settings)


def test_embed_texts_with_no_input_makes_no_calls(settings):
    client, _ = fake_client()
    assert embed_texts([], client=client, settings=settings) == []
    assert client.embeddings.calls == []


def test_chat_uses_the_chat_deployment_and_completion_token_limit(settings):
    client, calls = fake_client(reply="FinanceAI chat OK")
    reply = chat([{"role": "user", "content": "hi"}], client=client, settings=settings)
    assert reply == "FinanceAI chat OK"
    assert calls[0]["model"] == "gpt-5-mini"
    assert calls[0]["max_completion_tokens"] == 1024
    assert "max_tokens" not in calls[0]
    assert "temperature" not in calls[0]


@pytest.mark.azure
@pytest.mark.skipif(os.environ.get("RUN_AZURE_TESTS") != "1", reason="set RUN_AZURE_TESTS=1")
def test_live_embedding_and_chat():
    settings = load_settings()
    [vector] = embed_texts(["Apple reported total net sales."], settings=settings)
    assert len(vector) == settings.azure_openai_embedding_dimensions
    assert chat([{"role": "user", "content": "Reply with OK"}], settings=settings)
