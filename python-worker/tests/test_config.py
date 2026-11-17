import pytest

from financeai_worker.config import SettingsError, load_settings


def load():
    # _env_file=None keeps a developer's real .env out of the tests
    return load_settings(_env_file=None)


def test_loads_required_values_and_types(env):
    settings = load()
    assert settings.azure_openai_embedding_deployment == "text-embedding-3-small"
    assert settings.azure_openai_embedding_dimensions == 1536
    assert settings.azure_sql_port == 1433
    assert settings.azure_sql_encrypt is True


def test_optional_keys_default_to_none_for_default_azure_credential(env):
    env.setenv("AZURE_OPENAI_API_KEY", "")  # "KEY=" in .env means not set
    settings = load()
    assert settings.azure_openai_api_key is None
    assert settings.azure_search_api_key is None
    assert settings.azure_sql_user is None


def test_secrets_are_hidden_when_printed(env):
    env.setenv("AZURE_SEARCH_API_KEY", "super-secret")
    settings = load()
    assert "super-secret" not in repr(settings)
    assert settings.azure_search_api_key.get_secret_value() == "super-secret"


def test_missing_values_fail_fast_with_every_name_listed(env):
    env.delenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
    env.delenv("AZURE_SEARCH_INDEX_NAME")
    with pytest.raises(SettingsError) as error:
        load()
    message = str(error.value)
    assert "AZURE_OPENAI_EMBEDDING_DEPLOYMENT: missing" in message
    assert "AZURE_SEARCH_INDEX_NAME: missing" in message


def test_unfilled_placeholder_is_rejected(env):
    env.setenv("AZURE_SEARCH_INDEX_NAME", "<index-name>")
    with pytest.raises(SettingsError, match="AZURE_SEARCH_INDEX_NAME"):
        load()


def test_dimensions_must_be_a_positive_integer(env):
    env.setenv("AZURE_OPENAI_EMBEDDING_DIMENSIONS", "not-a-number")
    with pytest.raises(SettingsError, match="AZURE_OPENAI_EMBEDDING_DIMENSIONS"):
        load()


def test_storage_accepts_a_connection_string_instead_of_endpoints(env):
    env.delenv("AZURE_STORAGE_BLOB_ENDPOINT")
    env.delenv("AZURE_STORAGE_QUEUE_ENDPOINT")
    env.setenv("AZURE_STORAGE_CONNECTION_STRING", "UseDevelopmentStorage=true")
    assert load().azure_storage_connection_string is not None


def test_storage_needs_a_connection_string_or_both_endpoints(env):
    env.delenv("AZURE_STORAGE_QUEUE_ENDPOINT")
    with pytest.raises(SettingsError, match="AZURE_STORAGE_CONNECTION_STRING"):
        load()


def test_sql_user_and_password_must_be_set_together(env):
    env.setenv("AZURE_SQL_USER", "faiadmin")
    with pytest.raises(SettingsError, match="AZURE_SQL_USER and AZURE_SQL_PASSWORD"):
        load()


def test_real_environment_overrides_the_env_file(env, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("AZURE_SEARCH_INDEX_NAME=from-file\n")
    env.setenv("AZURE_SEARCH_INDEX_NAME", "from-environment")
    assert load_settings(_env_file=env_file).azure_search_index_name == "from-environment"
