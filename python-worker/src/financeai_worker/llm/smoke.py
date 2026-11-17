"""Smoke test against the real Azure OpenAI deployments.

Run from python-worker/ after filling in the repo-root .env:

    python -m financeai_worker.llm.smoke

Makes one embedding call and one chat call (a fraction of a cent) and prints what came back.
"""

from __future__ import annotations

from financeai_worker.config import get_settings
from financeai_worker.llm.azure_openai import chat, embed_texts


def main() -> None:
    settings = get_settings()
    print(f"Endpoint:   {settings.azure_openai_endpoint}")
    print(f"Auth:       {'API key' if settings.azure_openai_api_key else 'Entra ID (az login)'}")

    [vector] = embed_texts(["Apple reported total net sales for fiscal 2024."])
    print(f"Embedding:  {settings.azure_openai_embedding_deployment} -> {len(vector)} dimensions")

    reply = chat(
        [{"role": "user", "content": "Reply with exactly: FinanceAI chat OK"}],
        max_completion_tokens=256,
    )
    print(f"Chat:       {settings.azure_openai_chat_deployment} -> {reply.strip()!r}")


if __name__ == "__main__":
    main()
