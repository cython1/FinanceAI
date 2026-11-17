"""Worker settings, loaded from environment variables.

Variable names come from ``shared/.env.example``, the single list shared with node-api.
Locally they are read from the repo-root ``.env``; in a container they come from the
environment. Real environment variables override the file.

Required values have no defaults (see shared/README.md): a missing or unfilled
``<placeholder>`` value stops the worker at startup with a list of what to set.
Keys, the storage connection string and the SQL login are optional; when empty the
worker uses DefaultAzureCredential instead.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import PositiveInt, SecretStr, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# python-worker/src/financeai_worker/config.py -> repo root
REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class SettingsError(RuntimeError):
    """Raised when required configuration is missing or invalid."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT_ENV,
        env_file_encoding="utf-8",
        env_ignore_empty=True,  # "KEY=" in .env counts as not set
        extra="ignore",  # .env also holds node-api and frontend variables
        frozen=True,
    )

    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: SecretStr | None = None
    azure_openai_api_version: str
    azure_openai_embedding_deployment: str
    azure_openai_embedding_dimensions: PositiveInt
    azure_openai_chat_deployment: str

    # Azure AI Document Intelligence
    azure_document_intelligence_endpoint: str
    azure_document_intelligence_api_key: SecretStr | None = None

    # Azure AI Search
    azure_search_endpoint: str
    azure_search_api_key: SecretStr | None = None
    azure_search_index_name: str

    # Azure Storage: connection string (e.g. Azurite) or both endpoints
    azure_storage_connection_string: SecretStr | None = None
    azure_storage_blob_endpoint: str | None = None
    azure_storage_queue_endpoint: str | None = None
    azure_storage_blob_container: str
    azure_storage_queue_name: str

    # Azure SQL: user + password, or both empty for Entra ID
    azure_sql_server: str
    azure_sql_port: PositiveInt = 1433
    azure_sql_database: str
    azure_sql_user: str | None = None
    azure_sql_password: SecretStr | None = None
    azure_sql_encrypt: bool = True
    azure_sql_trust_server_certificate: bool = False

    @field_validator("*", mode="before")
    @classmethod
    def _reject_placeholders(cls, value: Any) -> Any:
        if isinstance(value, str) and "<" in value and ">" in value:
            raise ValueError(f"still has a placeholder from .env.example: {value!r}")
        return value

    @model_validator(mode="after")
    def _check_combinations(self) -> Settings:
        if self.azure_storage_connection_string is None and not (
            self.azure_storage_blob_endpoint and self.azure_storage_queue_endpoint
        ):
            raise ValueError(
                "set AZURE_STORAGE_CONNECTION_STRING, or both AZURE_STORAGE_BLOB_ENDPOINT "
                "and AZURE_STORAGE_QUEUE_ENDPOINT"
            )
        if (self.azure_sql_user is None) != (self.azure_sql_password is None):
            raise ValueError(
                "set both AZURE_SQL_USER and AZURE_SQL_PASSWORD, or neither (Entra ID)"
            )
        return self


def _describe(error: ValidationError) -> str:
    lines = []
    for item in error.errors():
        name = "_".join(str(part) for part in item["loc"]).upper() or "settings"
        reason = "missing" if item["type"] == "missing" else item["msg"]
        lines.append(f"  - {name}: {reason}")
    return "\n".join(lines)


def load_settings(**overrides: Any) -> Settings:
    """Build settings, turning validation errors into one readable message."""
    try:
        return Settings(**overrides)
    except ValidationError as error:
        raise SettingsError(
            "Worker configuration is incomplete. Set these in .env (see shared/.env.example):\n"
            + _describe(error)
        ) from None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Settings for the running process, loaded once."""
    return load_settings()


__all__ = ["Settings", "SettingsError", "get_settings", "load_settings"]
