# 🧠 IP-SAKTI Sahayak — RAG Engine

> **Standalone FastAPI Retrieval-Augmented Generation service for evidence-grounded IP, AYUSH and regulatory guidance.**

The `ip_sakti_rag` service is the knowledge and reasoning layer of IP-SAKTI Sahayak. It receives RAG-backed requests from the application backend, retrieves relevant indexed evidence, enriches the context with graph information when enabled, generates a grounded result, and exposes citations/confidence-related information to the application layer.

---

## ✨ Start Here

<p align="center">
  <strong>Retrieve authoritative evidence before generating an answer.</strong><br/>
  Hybrid retrieval • Qdrant • BM25 • Neo4j • Grounded generation • Safety handling
</p>

### 🔗 Service Relationship

```text
React Frontend
      │
      ▼
FastAPI Backend
      │
      ▼
ip_sakti_rag
      │
      ├── Qdrant
      ├── BM25
      ├── Neo4j
      ├── embedding service
      └── configured LLM
```

The RAG service is normally **not called directly by the browser**. The backend acts as the application gateway.

---

## 🎯 Responsibilities

The service handles the RAG-backed parts of the application, including:

- conversational evidence retrieval
- jurisdiction-aware scope handling
- hybrid semantic + lexical retrieval
- graph-context enrichment
- grounded response generation
- confidence/safety handling
- citation-oriented response data
- product analysis
- IPR analysis
- Traditional Knowledge / ABS analysis
- research/document search
- attachment context extraction
- RAG telemetry

---

## 🏗️ Current Architecture

```text
                       Query
                         │
                         ▼
               Language / Scope Boundary
                         │
                         ▼
                  Scope Guard
                         │
                         ▼
              Hybrid Retrieval Layer
                 ┌───────┴────────┐
                 │                │
              Qdrant            BM25
            semantic             lexical
                 │                │
                 └───────┬────────┘
                         ▼
                   Score Fusion
                         │
                         ▼
                  Graph Enrichment
                       Neo4j
                         │
                         ▼
                 Grounded Generator
                         │
                         ▼
               Citation / Confidence
                         │
              ┌──────────┴──────────┐
              │                     │
          Answer                    Safe handling
              │                     │
              ▼                     ▼
          Backend               Expert workflow
```

---

## 🔎 Hybrid Retrieval

The current retrieval implementation combines:

### Qdrant semantic retrieval

Queries are embedded into the same **384-dimensional vector space** used by the indexed corpus.

The deployed service can use a remote embedding service so that the RAG process does not need to load the local embedding model into its Render runtime.

Configuration:

```env
EMBEDDING_SERVICE_URL=
EMBEDDING_SERVICE_TOKEN=
```

### BM25 lexical retrieval

The service also builds an in-memory BM25 index from processed chunks.

This provides lexical matching for exact statutory terms, sections, named authorities and other wording-sensitive queries.

### Score fusion

The retrieval layer combines semantic and lexical relevance before final ordering.

The current implementation uses a weighted fusion with semantic relevance weighted above lexical relevance.

---

## 🕸️ Neo4j Graph Context

Neo4j can enrich retrieved evidence with graph relationships.

Configuration:

```env
NEO4J_ENABLED=true
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
```

If graph configuration is unavailable, the rest of the RAG pipeline can continue without graph enrichment.

---

## 🧠 Generation

The generation layer is provider-configurable.

Relevant settings:

```env
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

The code supports Gemini and Groq paths, with a deterministic evidence-based fallback when a live generation provider is unavailable.

The configured Render deployment can use Groq for generation.

### Offline fallback

If live LLM generation is unavailable, the service can construct a deterministic evidence summary from retrieved chunks rather than returning an empty response.

This is intended as a resilience mechanism, not as a substitute for validating a real legal/regulatory opinion.

---

## 🌐 Bhashini Language Boundary

The RAG pipeline supports multilingual language handling through Bhashini.

For a non-English selected language, the intended flow is:

```text
Selected-language query
          ↓
     Bhashini → English
          ↓
 Scope / retrieval / generation
          ↓
      English result
          ↓
 Bhashini → selected language
          ↓
Localized answer
```

The service configuration uses:

```env
TRANSLATION_PROVIDER=bhashini
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=
```

The legacy `BHASHINI_ULCA_API_KEY` variable remains accepted for compatibility.

Citation markers are handled so that translation does not unintentionally alter their numbering.

---

## 🛡️ Safety Pipeline

The RAG service includes safety-oriented components under:

```text
app/safety/
```

These include:

- scope guarding
- abstention handling
- confidence calculation
- citation validation

The scope guard considers the selected jurisdiction and can reject queries that are outside the intended scope or contain unsafe instruction patterns.

The service can return a low-confidence/safe response when indexed evidence is insufficient.

---

## 📚 Knowledge Corpus

The repository includes a document corpus under:

```text
data/documents/
```

Representative sources include:

- IP India Patents
- IP India Trade Marks
- Designs
- Copyright
- GI
- CDSCO Drugs and Cosmetics material
- New Drugs and Clinical Trials
- Cosmetics Rules
- FSSAI Ayurveda-Aahar
- National Biodiversity Authority material
- PPV&FR material
- WIPO treaties
- CBD / Nagoya Protocol
- DPDP material
- other indexed regulatory documents

Processed artifacts are stored under:

```text
data/processed/
```

Important files include:

```text
chunks.jsonl
documents.jsonl
embedding_progress.json
ingestion_progress.json
ingestion_state.json
```

---

## 🗃️ Document Ingestion

The ingestion code is located under:

```text
scripts/
```

and:

```text
app/ingestion/
```

Typical ingestion workflow:

```text
PDF / source document
       ↓
Text extraction
       ↓
Chunking
       ↓
Metadata assignment
       ↓
Embedding
       ↓
Qdrant indexing
       ↓
Processed JSONL artifacts
       ↓
BM25 index at service startup
```

Before re-ingesting or replacing the corpus, make sure the embedding model/vector dimension remains compatible with the existing Qdrant collection.

---

## 📎 Attachment Context

The service exposes:

```text
POST /api/attachment/context
```

Supported input types include:

- PDF
- DOCX
- TXT
- MD
- CSV
- JSON
- common images

### Text documents

PDF and DOCX text is extracted locally.

### Images

When the configured Groq multimodal path is available, image content can be interpreted to extract relevant:

- readable text
- labels
- ingredients
- claims
- dates
- numbers
- tables
- other visible facts

The image analyzer is instructed not to invent unreadable details.

---

## 🔌 API Endpoints

### Health

```text
GET /api/health
```

### Chat

```text
POST /api/chat
```

### Attachments

```text
POST /api/attachment/context
```

### Analysis

```text
POST /api/products/analyze
POST /api/ipr/analyze
POST /api/abs/analyze
POST /api/tk-abs/analyze
```

### Research

```text
GET /api/research/search
GET /api/rag/documents
```

### Documents

```text
GET /api/documents/{document_id}
GET /api/documents/{document_id}/source
```

### Telemetry

```text
GET /api/rag/telemetry
```

### Conversation support

```text
DELETE /api/conversations/{conversation_id}
POST   /api/conversations/{conversation_id}/feedback
```

---

## 📁 Project Structure

```text
ip_sakti_rag/
│
├── main.py
├── README.md
├── requirements.txt
├── requirements-server.txt
├── .env.example
│
├── app/
│   ├── classification.py
│   ├── config.py
│   ├── embeddings.py
│   ├── jurisdiction.py
│   ├── language.py
│   ├── pipeline.py
│   ├── schemas.py
│   │
│   ├── database/
│   │   └── mongo.py
│   │
│   ├── generation/
│   │   ├── grounded_generator.py
│   │   ├── llm_client.py
│   │   └── prompts.py
│   │
│   ├── ingestion/
│   │   ├── chunker.py
│   │   ├── embed_and_index.py
│   │   ├── extract.py
│   │   └── metadata.py
│   │
│   ├── retrieval/
│   │   ├── graph.py
│   │   ├── hybrid.py
│   │   ├── reranker.py
│   │   ├── tkdl_connector.py
│   │   └── vector_index.py
│   │
│   ├── safety/
│   │   ├── abstention.py
│   │   ├── citation_validator.py
│   │   ├── confidence.py
│   │   └── scope_guard.py
│   │
│   └── translation/
│       └── bhashini_client.py
│
├── data/
│   ├── documents/
│   └── processed/
│
├── scripts/
│   ├── ingest.py
│   ├── download_static_sources.py
│   ├── ingestion_report.py
│   └── test_queries.py
│
├── docs/
│   └── SOURCE_ACQUISITION_GUIDE.md
│
└── tests/
    └── sample_queries.json
```

---

## ⚙️ Configuration

Copy:

```text
ip_sakti_rag/.env.example → ip_sakti_rag/.env
```

### LLM

```env
LLM_PROVIDER=groq
LLM_API_KEY=
LLM_MODEL=
```

The provider is configurable; use the model appropriate for the selected provider.

### Embedding service

```env
EMBEDDING_SERVICE_URL=
EMBEDDING_SERVICE_TOKEN=
EMBEDDING_SERVICE_TIMEOUT=120
```

### Qdrant

```env
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=ip_sakti_chunks
```

### Neo4j

```env
NEO4J_ENABLED=true
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
```

### Bhashini

```env
TRANSLATION_PROVIDER=bhashini
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=
```

### Service protection

```env
RAG_SERVICE_SHARED_SECRET=
```

If configured, callers must send the matching internal secret.

### TKDL

The current configuration keeps:

```env
TKDL_ENABLED=false
```

Do not enable it without an authorized access mechanism.

---

## 🛠️ Local Development

### Prerequisites

- Python 3.12+
- Qdrant
- configured embedding service
- configured LLM provider
- Neo4j if graph enrichment is required
- Bhashini credentials if multilingual live translation is required

### Install

```bash
cd ip_sakti_rag

python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the full local environment:

```bash
pip install -r requirements.txt
```

### Run

```bash
uvicorn main:app --reload --port 8001
```

Health:

```text
http://localhost:8001/api/health
```

---

## 🚀 Render / Production Runtime

The production-oriented dependency file is:

```text
requirements-server.txt
```

The service can be started with:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

The production runtime intentionally avoids unnecessary local ML/ingestion dependencies where possible.

For Render, configure the environment variables in the service dashboard rather than committing `.env`.

---

## 🔒 Internal Service Protection

The RAG service supports:

```env
RAG_SERVICE_SHARED_SECRET=
```

When set, protected endpoints require the matching internal header from the backend.

The health endpoint remains available for service health checks.

---

## 📊 Telemetry

The service exposes:

```text
GET /api/rag/telemetry
```

Telemetry can be used to inspect RAG pipeline behavior and retrieval-related runtime information without exposing internal secrets.

---

## 🧪 Testing & Query Validation

Test utilities are located in:

```text
tests/
scripts/test_queries.py
```

Use the service health endpoint first, then test representative queries across:

- IP
- AYUSH regulation
- Traditional Knowledge
- biodiversity/ABS
- jurisdiction boundaries
- low-confidence cases
- multilingual requests

---

## ⚠️ Operational Notes

### Qdrant compatibility

The indexed Qdrant collection and live query embedding service must use the same vector dimension/model space.

### Corpus persistence

The processed corpus is stored in:

```text
data/processed/
```

Production deployments should ensure required processed artifacts are available to the deployed service.

### Neo4j

Graph enrichment is optional. Missing graph configuration should not prevent the core retrieval pipeline from operating.

### Bhashini

Live multilingual translation depends on valid Bhashini credentials and provider availability. The backend/frontend translation path also has local dictionary behavior for supported UI content.

### LLM availability

If the configured live provider fails, the service can fall back to deterministic evidence-based synthesis.

### Legal use

The generated output is decision-support information. Always verify the current official legal/regulatory text before using an answer for filing, compliance or commercial action.

---

## 🔗 Related Documentation

- Root project: `../README.md`
- Backend: `../backend/README.md`
- Frontend: `../frontend/README.md`
- Setup: `../setup_steps.md`
- Deployment: `../DEPLOYMENT.md`
- Source acquisition: `docs/SOURCE_ACQUISITION_GUIDE.md`
