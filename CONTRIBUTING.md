# Contributing to FinanceAI

Welcome. This page gets a new developer (human or AI agent) productive quickly. The full conventions live in [AGENTS.md](AGENTS.md).

## 1. Get oriented
1. Read [AGENTS.md](AGENTS.md) — architecture, rules and commands.
2. Look at [docs/architecture.md](docs/architecture.md) for how the pieces connect.
3. Browse the [issues](../../issues) and [milestones](../../milestones). Each milestone is an epic; issue #N is task FAI-N.

## 2. Pick a task
- Choose an open issue whose "Depends on" tasks have had their implementation PRs merged into `main`. A closed issue is not enough on its own, since issues can also be closed as duplicates or abandoned.
- Assign it to yourself so nobody else picks it up, or hand it to an agent: add the `claude` label for Claude, or assign it to Copilot. See the agents table in [AGENTS.md](AGENTS.md).

## 3. Work on a branch
```bash
git checkout main && git pull
git checkout -b feature/FAI-XXX-short-name   # name is in the issue
git commit -m "FAI-XXX: what you did"
git push -u origin feature/FAI-XXX-short-name
```

## 4. Open a PR
- Title `FAI-XXX <issue title>`, body includes `Closes #XXX` (the PR template fills in the rest).
- One issue per PR. Squash merge into `main` after review.

## Local setup
You will need Python 3.12, Node 20, Docker and the Azure CLI. Copy `shared/.env.example` to `.env` and ask the project owner for Azure dev credentials. Never commit `.env`.
