"""Azure OpenAI configuration and clients, in one place.

Every embedding and chat call in the worker goes through this module, so the deployment
names, API version and authentication come only from settings (shared/.env.example).

Authentication: AZURE_OPENAI_API_KEY when set; otherwise Microsoft Entra ID through
DefaultAzureCredential (``az login`` locally, a managed identity in Azure).
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from functools import lru_cache

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from langchain_openai import AzureOpenAIEmbeddings
from openai import AzureOpenAI

from financeai_worker.config import Settings, get_settings

COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"
EMBEDDING_BATCH_SIZE = 64  # inputs per embeddings request
MAX_RETRIES = 5  # the SDK backs off on 429 (rate limit) and 5xx


@lru_cache(maxsize=1)
def _entra_token_provider() -> Callable[[], str]:
    return get_bearer_token_provider(DefaultAzureCredential(), COGNITIVE_SERVICES_SCOPE)


def _auth(settings: Settings) -> dict:
    if settings.azure_openai_api_key is not None:
        return {"api_key": settings.azure_openai_api_key.get_secret_value()}
    return {"azure_ad_token_provider": _entra_token_provider()}


def create_openai_client(settings: Settings | None = None) -> AzureOpenAI:
    """An AzureOpenAI client for both embeddings and chat."""
    settings = settings or get_settings()
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        max_retries=MAX_RETRIES,
        **_auth(settings),
    )


@lru_cache(maxsize=1)
def get_openai_client() -> AzureOpenAI:
    """The process-wide client, built from the environment once."""
    return create_openai_client()


def create_langchain_embeddings(settings: Settings | None = None) -> AzureOpenAIEmbeddings:
    """LangChain embeddings on the same deployment, for SemanticChunker (FAI-009)."""
    settings = settings or get_settings()
    return AzureOpenAIEmbeddings(
        azure_endpoint=settings.azure_openai_endpoint,
        azure_deployment=settings.azure_openai_embedding_deployment,
        openai_api_version=settings.azure_openai_api_version,
        dimensions=settings.azure_openai_embedding_dimensions,
        chunk_size=EMBEDDING_BATCH_SIZE,
        max_retries=MAX_RETRIES,
        **_auth(settings),
    )


def embed_texts(
    texts: Sequence[str],
    *,
    client: AzureOpenAI | None = None,
    settings: Settings | None = None,
) -> list[list[float]]:
    """Embed texts in batches, returning one vector per input, in order.

    Every vector must have AZURE_OPENAI_EMBEDDING_DIMENSIONS values, because the AI Search
    vector field is created with that size; a mismatch raises instead of indexing bad data.
    """
    settings = settings or get_settings()
    client = client or get_openai_client()
    expected = settings.azure_openai_embedding_dimensions
    vectors: list[list[float]] = []
    for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
        batch = list(texts[start : start + EMBEDDING_BATCH_SIZE])
        response = client.embeddings.create(
            model=settings.azure_openai_embedding_deployment,
            input=batch,
            dimensions=expected,
        )
        for item in sorted(response.data, key=lambda d: d.index):
            if len(item.embedding) != expected:
                raise ValueError(
                    f"embedding has {len(item.embedding)} values, expected {expected} "
                    "(check AZURE_OPENAI_EMBEDDING_DIMENSIONS)"
                )
            vectors.append(item.embedding)
    return vectors


def chat(
    messages: list[dict],
    *,
    max_completion_tokens: int = 1024,
    client: AzureOpenAI | None = None,
    settings: Settings | None = None,
) -> str:
    """One chat completion on the chat deployment, returning the reply text.

    The deployment is a reasoning model (gpt-5 family): it takes max_completion_tokens,
    not max_tokens, and only the default temperature.
    """
    settings = settings or get_settings()
    client = client or get_openai_client()
    response = client.chat.completions.create(
        model=settings.azure_openai_chat_deployment,
        messages=messages,
        max_completion_tokens=max_completion_tokens,
    )
    return response.choices[0].message.content or ""
