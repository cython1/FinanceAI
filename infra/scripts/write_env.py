"""Write the repo-root .env from shared/.env.example and the Bicep deployment outputs.

Called by infra/deploy.sh. Can also be run by hand:

    python infra/scripts/write_env.py --outputs outputs.json [--keys keys.json] [--env .env]

- Starts from the existing .env if there is one, otherwise from shared/.env.example,
  so values you set yourself (and comments) are kept.
- Overwrites only the Azure variables the deployment knows, plus local-dev defaults
  for variables that still hold a <placeholder>.
- Keys are written only when --keys is given (FAI_USE_KEYS=1); otherwise they stay
  empty and the services use DefaultAzureCredential.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TEMPLATE = REPO / "shared" / ".env.example"

# Vector size returned by each embedding model. AI Search's vector field uses it.
EMBEDDING_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
}

DEFAULT_OPENAI_API_VERSION = "2024-10-21"

# Used only when the variable still holds a <placeholder>.
LOCAL_DEFAULTS = {
    "AZURE_SEARCH_INDEX_NAME": "financial-reports",
    "CORS_ORIGIN": "http://localhost:5173",
    "UPLOAD_MAX_BYTES": "52428800",
    "VITE_API_BASE_URL": "http://localhost:3000",
}

LINE = re.compile(r"^(?P<key>[A-Z][A-Z0-9_]*)=(?P<value>.*)$")


def output_value(outputs: dict, name: str) -> str:
    try:
        return str(outputs[name]["value"])
    except KeyError:
        sys.exit(f"Deployment output '{name}' is missing; re-run infra/deploy.sh.")


def azure_values(outputs: dict, api_version: str) -> dict[str, str]:
    embedding = output_value(outputs, "embeddingDeploymentName")
    if embedding not in EMBEDDING_DIMENSIONS:
        sys.exit(
            f"Unknown vector size for embedding model '{embedding}'; add it to EMBEDDING_DIMENSIONS."
        )
    return {
        "AZURE_OPENAI_ENDPOINT": output_value(outputs, "openAiEndpoint"),
        "AZURE_OPENAI_API_VERSION": api_version,
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT": embedding,
        "AZURE_OPENAI_EMBEDDING_DIMENSIONS": str(EMBEDDING_DIMENSIONS[embedding]),
        "AZURE_OPENAI_CHAT_DEPLOYMENT": output_value(outputs, "chatDeploymentName"),
        "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT": output_value(
            outputs, "documentIntelligenceEndpoint"
        ),
        "AZURE_SEARCH_ENDPOINT": output_value(outputs, "searchEndpoint"),
        "AZURE_STORAGE_BLOB_ENDPOINT": output_value(
            outputs, "storageBlobEndpoint"
        ).rstrip("/"),
        "AZURE_STORAGE_QUEUE_ENDPOINT": output_value(
            outputs, "storageQueueEndpoint"
        ).rstrip("/"),
        "AZURE_STORAGE_BLOB_CONTAINER": output_value(outputs, "blobContainerName"),
        "AZURE_STORAGE_QUEUE_NAME": output_value(outputs, "queueName"),
        "AZURE_SQL_SERVER": output_value(outputs, "sqlServerFqdn"),
        "AZURE_SQL_DATABASE": output_value(outputs, "sqlDatabaseName"),
        "AZURE_SQL_TRUST_SERVER_CERTIFICATE": "false",
    }


def merge(lines: list[str], updates: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return the new lines and the keys from `updates` that were not in the file."""
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        m = LINE.match(line)
        if not m:
            out.append(line)
            continue
        key, value = m["key"], m["value"]
        seen.add(key)
        if key in updates:
            out.append(f"{key}={updates[key]}")
        elif key in LOCAL_DEFAULTS and value.startswith("<"):
            out.append(f"{key}={LOCAL_DEFAULTS[key]}")
        else:
            out.append(line)
    missing = [k for k in updates if k not in seen]
    return out, missing


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--outputs",
        required=True,
        type=Path,
        help="JSON from 'az deployment group create --query properties.outputs'",
    )
    parser.add_argument(
        "--keys",
        type=Path,
        help='Optional JSON of key variables to write, e.g. {"AZURE_SEARCH_API_KEY": "..."}',
    )
    parser.add_argument(
        "--env",
        type=Path,
        default=REPO / ".env",
        help="File to write (default: repo-root .env)",
    )
    parser.add_argument("--api-version", default=DEFAULT_OPENAI_API_VERSION)
    args = parser.parse_args()

    outputs = json.loads(args.outputs.read_text())
    updates = azure_values(outputs, args.api_version)
    if args.keys:
        updates.update(
            {k: v for k, v in json.loads(args.keys.read_text()).items() if v}
        )

    source = args.env if args.env.exists() else TEMPLATE
    lines, missing = merge(source.read_text().splitlines(), updates)
    if missing:
        lines += ["", "# Added by infra/deploy.sh"] + [
            f"{k}={updates[k]}" for k in missing
        ]
    args.env.write_text("\n".join(lines) + "\n")
    print(
        f"Wrote {args.env.relative_to(REPO) if args.env.is_relative_to(REPO) else args.env} ({len(updates)} Azure values, from {source.name})"
    )


if __name__ == "__main__":
    main()
