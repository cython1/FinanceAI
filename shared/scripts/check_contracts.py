"""Check the shared contracts in shared/.

Run from the repo root:
    pip install -r shared/scripts/requirements.txt
    python shared/scripts/check_contracts.py

Checks:
  1. Every JSON Schema in shared/schemas/ is a valid draft 2020-12 schema.
  2. Every file in shared/examples/valid/ passes its schema, and every file in
     shared/examples/invalid/ fails it. The schema is picked by file-name prefix,
     e.g. kpi-record.*.json -> kpi-record.schema.json.
  3. shared/search/index-fields.json matches its schema, has exactly one key field,
     every field it references exists, and every ${VAR} it uses is defined in
     shared/.env.example.
  4. shared/.env.example defines each variable exactly once, including the
     variables that must be shared by both services.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

SHARED = Path(__file__).resolve().parent.parent
SCHEMAS = SHARED / "schemas"
EXAMPLES = SHARED / "examples"
INDEX_FIELDS = SHARED / "search" / "index-fields.json"
ENV_EXAMPLE = SHARED / ".env.example"

# Variables both services must read from the single definition in .env.example.
REQUIRED_SHARED_VARS = {
    "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
    "AZURE_OPENAI_EMBEDDING_DIMENSIONS",
    "AZURE_SEARCH_INDEX_NAME",
    "AZURE_STORAGE_BLOB_CONTAINER",
    "AZURE_STORAGE_QUEUE_NAME",
}

ENV_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=")
ENV_REF = re.compile(r"^\$\{([A-Z][A-Z0-9_]*)\}$")

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def rel(path: Path) -> str:
    return path.relative_to(SHARED.parent).as_posix()


def load_json(path: Path) -> object:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def validator_for(schema_path: Path) -> Draft202012Validator:
    return Draft202012Validator(load_json(schema_path), format_checker=FormatChecker())


def check_schemas() -> dict[str, Path]:
    schemas: dict[str, Path] = {}
    for path in sorted(SCHEMAS.glob("*.schema.json")):
        try:
            Draft202012Validator.check_schema(load_json(path))
        except Exception as exc:  # noqa: BLE001 - report every problem, keep going
            fail(f"{rel(path)}: not a valid JSON Schema: {exc}")
            continue
        schemas[path.name.removesuffix(".schema.json")] = path
    if not schemas:
        fail(f"{rel(SCHEMAS)}: no *.schema.json files found")
    return schemas


def schema_for_example(path: Path, schemas: dict[str, Path]) -> Path | None:
    for name, schema_path in schemas.items():
        if path.name == f"{name}.json" or path.name.startswith(f"{name}."):
            return schema_path
    fail(f"{rel(path)}: no schema matches this file name")
    return None


def check_examples(schemas: dict[str, Path]) -> None:
    for expect_valid, folder in ((True, EXAMPLES / "valid"), (False, EXAMPLES / "invalid")):
        files = sorted(folder.glob("*.json"))
        if not files:
            fail(f"{rel(folder)}: no examples found")
        for path in files:
            schema_path = schema_for_example(path, schemas)
            if schema_path is None:
                continue
            problems = list(validator_for(schema_path).iter_errors(load_json(path)))
            if expect_valid and problems:
                for problem in problems:
                    where = "/".join(map(str, problem.absolute_path)) or "<root>"
                    fail(f"{rel(path)}: {where}: {problem.message}")
            elif not expect_valid and not problems:
                fail(f"{rel(path)}: expected to FAIL {schema_path.name}, but it passed")


def read_env_example() -> set[str]:
    seen: dict[str, int] = {}
    for number, line in enumerate(ENV_EXAMPLE.read_text(encoding="utf-8").splitlines(), 1):
        match = ENV_LINE.match(line)
        if not match:
            continue
        name = match.group(1)
        if name in seen:
            fail(f"{rel(ENV_EXAMPLE)}:{number}: {name} is already defined on line {seen[name]}")
        else:
            seen[name] = number
    for name in sorted(REQUIRED_SHARED_VARS - seen.keys()):
        fail(f"{rel(ENV_EXAMPLE)}: required shared variable {name} is missing")
    return set(seen)


def env_refs(value: object) -> set[str]:
    """Names of env vars used as whole values (e.g. "${AZURE_X}") anywhere in a JSON document."""
    if isinstance(value, str):
        match = ENV_REF.match(value)
        return {match.group(1)} if match else set()
    if isinstance(value, dict):
        return set().union(*(env_refs(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(*(env_refs(v) for v in value))
    return set()


def check_index_fields(schemas: dict[str, Path], env_vars: set[str]) -> None:
    schema_path = schemas.get("search-index-fields")
    if schema_path is None:
        fail("schemas/search-index-fields.schema.json is missing")
        return
    data = load_json(INDEX_FIELDS)
    problems = list(validator_for(schema_path).iter_errors(data))
    for problem in problems:
        where = "/".join(map(str, problem.absolute_path)) or "<root>"
        fail(f"{rel(INDEX_FIELDS)}: {where}: {problem.message}")
    if problems:
        return

    assert isinstance(data, dict)
    fields = data["fields"]
    names = [f["name"] for f in fields]
    for name in {n for n in names if names.count(n) > 1}:
        fail(f"{rel(INDEX_FIELDS)}: field {name} is listed more than once")
    keys = [f["name"] for f in fields if f.get("key")]
    if len(keys) != 1:
        fail(f"{rel(INDEX_FIELDS)}: expected exactly one key field, found {keys}")

    profiles = {p["name"] for p in data["vector_search"]["profiles"]}
    algorithms = {a["name"] for a in data["vector_search"]["algorithms"]}
    for profile in data["vector_search"]["profiles"]:
        if profile["algorithm"] not in algorithms:
            fail(f"{rel(INDEX_FIELDS)}: profile {profile['name']} uses unknown algorithm {profile['algorithm']}")
    for field in fields:
        profile = field.get("vector_search_profile")
        if profile is not None and profile not in profiles:
            fail(f"{rel(INDEX_FIELDS)}: field {field['name']} uses unknown vector profile {profile}")

    semantic = data["semantic"]
    configs = {c["name"] for c in semantic["configurations"]}
    if semantic["default_configuration"] not in configs:
        fail(f"{rel(INDEX_FIELDS)}: default semantic configuration {semantic['default_configuration']} is not defined")
    for config in semantic["configurations"]:
        used = [config.get("title_field"), *config["content_fields"], *config.get("keywords_fields", [])]
        for name in filter(None, used):
            if name not in names:
                fail(f"{rel(INDEX_FIELDS)}: semantic configuration {config['name']} uses unknown field {name}")

    for var in sorted(env_refs(data) - env_vars):
        fail(f"{rel(INDEX_FIELDS)}: ${{{var}}} is not defined in {rel(ENV_EXAMPLE)}")


def main() -> int:
    schemas = check_schemas()
    check_examples(schemas)
    env_vars = read_env_example()
    check_index_fields(schemas, env_vars)

    if errors:
        print(f"Shared contract check FAILED ({len(errors)} problem(s)):")
        for message in errors:
            print(f"  - {message}")
        return 1
    print(
        f"Shared contracts OK: {len(schemas)} schemas, "
        f"{len(list((EXAMPLES / 'valid').glob('*.json')))} valid + "
        f"{len(list((EXAMPLES / 'invalid').glob('*.json')))} invalid examples, "
        f"{len(env_vars)} env vars."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
