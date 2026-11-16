# Design decisions

Each infrastructure or system design decision is recorded here before code is written. The owner drives the discussion; an engineering manager guides it with questions, then reviews and approves the record.

## Records

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-database-azure-sql.md) | Database for KPIs and jobs: Azure SQL Database (serverless free offer) | Accepted | 2026-11-16 |

## How each decision runs

1. **Kickoff.** Context, requirements and constraints (budget, timeline, scale); the owner is assigned.
2. **Discovery rounds.** Two or three questions at a time, in this order:
    1. **Requirements:** what it must do, who or what uses it, how often
    2. **Data and access patterns:** what is stored, how it is read and written, how much
    3. **Options:** at least two ways to solve it
    4. **Trade-offs:** cost, operational effort, scale, security, lock-in
    5. **Failure modes:** what breaks and what happens when it does
    6. **Production path:** what changes for real users
3. **Feedback.** After each answer: what is solid, what is missing, where the reasoning has a gap.
4. **Decision record.** The owner writes it with the template below; once approved, code starts.

## Template

Copy this into `NNNN-short-name.md`:

```markdown
# NNNN: <decision title>

**Decision:** <the choice>. **Status:** Proposed | Accepted | Superseded by NNNN. **Date:** YYYY-MM-DD.

## Need
What it is for, which FAI tickets depend on it, what breaks without it.

## Options
Two or three realistic alternatives, including "don't use it" or "run it locally".

## Cost
Monthly cost at our scale, free-tier limits, what triggers charges, the safety net.

## Recommendation and why
The choice and the trade-offs accepted. "I chose X because ...; I gave up ...; I would revisit if ..."

## Risks and limits
Quotas, regions, security, lock-in, gotchas, and their mitigations.

## Production upgrade
What would change for a real deployment.

## Follow-ups
Ticket changes this decision creates.
```
