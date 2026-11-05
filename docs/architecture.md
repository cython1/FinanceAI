# Architecture

```mermaid
flowchart LR
  subgraph PY["Python worker"]
    P1[PDF parsing<br/>Document Intelligence] --> P2[Semantic chunking] --> P3[KPI extraction]
  end
  subgraph AZ["Azure"]
    B[(Blob storage<br/>raw PDFs)]
    Q[[Storage Queue<br/>ingestion jobs]]
    O[Azure OpenAI<br/>embeddings + GPT]
    S[(AI Search<br/>vectors + metadata)]
    D[(Azure SQL<br/>KPI tables)]
  end
  subgraph NODE["Node.js API (Fastify)"]
    N1[Upload + jobs] 
    N2[RAG pipeline]
    N3[Dashboard + compare]
  end
  FE[React frontend] --> NODE
  N1 --> B
  N1 --> Q
  Q --> P1
  B --> P1
  P2 --> S
  P3 --> D
  PY -.-> O
  N2 -.-> O
  S --> N2
  D --> N3
```

## Request flows

**Ingestion:** the frontend uploads a PDF → Node API stores it in Blob storage, records a job in Azure SQL and puts a message on the queue → the Python worker picks up the message, parses, chunks, embeds and indexes the report, extracts KPIs, saves them to Azure SQL and marks the job done.

**Dashboard and comparison:** the frontend calls the Node API, which reads KPIs from Azure SQL.

**Research:** the frontend sends a question → Node embeds it, runs a hybrid search in AI Search with company/year filters, builds a grounded prompt, and streams the GPT answer back with citations.

## Deployment

Three containers (`python-worker`, `node-api`, `frontend`) run on AKS. Images are built to Azure Container Registry; secrets come from Key Vault and Azure access uses workload identity.
