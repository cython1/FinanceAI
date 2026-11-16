# 0001: Database for KPIs and jobs

**Decision:** Azure SQL Database, serverless free offer. **Status:** Accepted. **Date:** 2026-11-16. **Ticket:** FAI-003.

## Need

The database holds two kinds of data, each with different writers:

| Data | Fields | Created by | Updated by | Read by |
| --- | --- | --- | --- | --- |
| KPI records | company, fiscal year, metric, value, currency, source page | Python worker | Python worker (upsert on re-ingest) | Node API: dashboard, comparison |
| Job records | status (queued, processing, done, failed), timestamps, attempts, error message | Node API, on upload | Python worker | Node API: job status polling |

Without it there is no dashboard (FAI-022), no comparison (FAI-023) and no job status (FAI-021).

## Options

| Option | Fit |
| --- | --- |
| **Azure SQL Database, serverless free offer** | Filters, sorts and aggregates across rows natively; `MERGE` for upserts; mature drivers for Node (`mssql`) and Python (`pyodbc`) |
| Cosmos DB, free tier | Schema-free documents and fast point reads; the comparison chart becomes a cross-partition query if partitioned by company |
| Local SQL Server container only (FAI-004) | $0, but the deployed app would still need a cloud database |

## Access patterns

- **Comparison chart** (main feature): filter by companies and metric, sort by year, across companies.

  ```sql
  SELECT company, fiscal_year, value, source_page
  FROM kpis
  WHERE company IN ('AAPL', 'MSFT') AND metric = 'revenue'
  ORDER BY company, fiscal_year;
  ```

- **Dashboard:** filter by one company, all metrics.
- **Job status:** read one job by ID (primary-key lookup), polled every few seconds.

## Cost

- **$0 a month.** The free offer covers a monthly allowance of serverless compute and 32 GB storage; our data is a few hundred rows.
- **Auto-pause** after 60 idle minutes keeps compute at $0 when nobody uses the app.
- **Safety net:** when the free allowance is used up, the database pauses instead of billing (`freeLimitExhaustionBehavior: AutoPause`).

## Recommendation and why

I chose Azure SQL Database because our main access patterns, the comparison chart and the dashboard, filter and sort KPI rows across companies and years, which SQL does natively; in Cosmos DB the comparison would be a cross-partition query. The KPI shape is fixed by our shared contract (`shared/schemas/kpi-record.schema.json`), and a row-per-metric table means new KPIs need no schema change. Job status by ID is a primary-key lookup, fast in either database.

I gave up schema-free nesting for drill-down data (for example revenue by segment), which in SQL needs a small migration or a JSON column, and I accept a cold start of up to about a minute after idle periods.

I would revisit if we need deeply nested, per-company data with no common fields, or millions of documents with global, low-latency point reads.

## Risks and limits

- **Cold start:** the first request after a pause takes up to about a minute. Mitigation: retry the first connection with a longer timeout, show a waking-up message in the UI, warm it up before demos.
- **Stuck jobs:** a worker that crashes mid-processing leaves a job in `processing` forever. Mitigation: a heartbeat timestamp, queue re-delivery with an attempt count, and `failed` with an error message after three attempts.
- **Firewall:** blocks everything by default; the rules allow Azure services and the developer's public IP, which must be updated when it changes.
- **Credentials:** SQL login with a password for now, stored as a Pulumi secret, per the keys-first phase.
- **Python driver:** `pyodbc` needs Microsoft ODBC Driver 18 installed.
- **Region capacity:** if East US 2 is full, create both server and database in Central US.

## Production upgrade

- Paid serverless or provisioned tier sized to load.
- Entra ID-only login with managed identities; no passwords.
- Private endpoint with public access disabled, replacing IP firewall rules.
- Longer backup retention and a separate database per environment.

## Follow-ups

- [ ] FAI-013: add `updated_at`, `attempts` and `error_message` to the jobs table
- [ ] FAI-015: heartbeat while processing; stale-job handling; poison messages marked `failed` after three attempts
- [ ] FAI-019: retry and longer timeout on the first SQL connection for cold starts
- [ ] FAI-033: show a waking-up message while the first request is slow
- [ ] FAI-003 step 5: build the server, database and firewall rules in Pulumi
