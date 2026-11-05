# FinanceAI

FinanceAI is a monorepo built on a hybrid architecture: a Node.js API and a Python worker sit behind a web frontend, and all of them live in one repository.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`python-worker/`](python-worker/) | Python worker service |
| [`node-api/`](node-api/) | Node.js API service |
| [`frontend/`](frontend/) | Web client |
| [`infra/`](infra/) | Infrastructure and deployment configuration |
| [`shared/`](shared/) | Code and contracts shared across services |
| [`docs/`](docs/) | Project documentation |

## Architecture

> **TODO:** still to be decided. Fill in the following before merging FAI-001:
>
> - **frontend:** framework, and how it calls `node-api`
> - **node-api:** framework and responsibilities
> - **python-worker:** responsibilities and key libraries
> - **node-api ↔ python-worker:** communication mechanism (HTTP / gRPC / message queue: which one)
> - **Data stores:** database(s), cache
> - **infra:** tooling (containers, orchestration, IaC, cloud provider)
> - **shared/:** what it contains (schemas, API contracts, constants)

## Conventions

- Editor settings are defined in [`.editorconfig`](.editorconfig).
- Ignored files are defined in [`.gitignore`](.gitignore).
