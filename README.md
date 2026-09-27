# 🌿 IP-SAKTI Sahayak

> **Multilingual RAG-Based AI Assistant for Intellectual Property, AYUSH & Regulatory Guidance**

<p align="center">
  <strong>Research smarter. Understand regulations clearly. Make evidence-aware decisions.</strong><br/>
  Built for AYUSH researchers, practitioners, startups, MSMEs, institutions and expert reviewers.
</p>

<p align="center">
  <a href="https://ip-sakti-frontend.onrender.com/">🌐 Live Frontend</a> ·
  <a href="https://ip-sakti-backend-dwox.onrender.com/docs">📚 Backend API Docs</a> ·
  <a href="https://ip-sakti-backend-dwox.onrender.com/api/health">❤️ Backend Health</a>
</p>

---

## ✨ What is IP-SAKTI Sahayak?

**IP-SAKTI Sahayak** is a multilingual decision-support platform for navigating Intellectual Property (IP), AYUSH regulations, Traditional Knowledge (TK), biodiversity and Access & Benefit Sharing (ABS) questions.

Instead of treating an AI answer as the final authority, the platform is designed around an **evidence-first workflow**:

**Classify → retrieve authoritative evidence → reason over grounded context → validate citations/confidence → present the result → escalate when human review is appropriate.**

The application combines a React/Vite interface, a FastAPI application backend and a separate FastAPI RAG service. This separation keeps authentication, persistence and user workflows independent from retrieval and reasoning.

> **Important:** IP-SAKTI Sahayak is a decision-support and research-assistance system. It does not replace a qualified patent agent, lawyer, regulatory professional, AYUSH authority or other competent authority.

---

## 🔗 Live Services

| Service | Live Link | Purpose |
|---|---|---|
| **Frontend** | https://ip-sakti-frontend.onrender.com/ | Main user-facing application |
| **Backend API** | https://ip-sakti-backend-dwox.onrender.com/ | Authentication, persistence, application APIs and orchestration |
| **Backend Swagger** | https://ip-sakti-backend-dwox.onrender.com/docs | Interactive FastAPI API documentation |
| **Backend Health** | https://ip-sakti-backend-dwox.onrender.com/api/health | Backend/RAG connectivity check |

The frontend is deployed separately and uses the backend through `/api/*` routing. The backend, in turn, communicates with the dedicated `ip_sakti_rag` service for RAG-backed operations.

---

## 🎯 Core Objectives

- Make IP and AYUSH regulatory information easier to discover and understand.
- Ground answers in an indexed corpus of authoritative legal and regulatory documents.
- Support **India** and **International** jurisdiction modes.
- Provide multilingual interaction through the supported Indian-language workflow and **Bhashini** integration.
- Surface citations, confidence information and relevant considerations instead of presenting unsupported free-form answers.
- Provide a structured route to human expert guidance when an answer requires additional review.
- Keep user conversations, research, analyses, notifications and grievances organized in a persistent workspace.

---

## 🧭 Major Application Areas

### 🤖 Sahayak AI
The main conversational interface for IP, AYUSH, Traditional Knowledge, biodiversity, ABS and regulatory questions.

Key behavior includes:

- jurisdiction-aware querying
- grounded RAG responses
- source citations
- confidence information
- relevant considerations
- recommended next steps
- low-confidence expert escalation
- attachment-aware questioning for supported files/images

### 🧪 Product Analyzer
Structured analysis of an AYUSH/product concept, including:

- likely product category
- regulatory considerations
- IP considerations
- Traditional Knowledge / ABS indicators
- evidence and citations
- recommended next steps

Supported product categories in the current frontend include:

- Classical Ayurvedic Medicine
- Proprietary Ayurvedic Medicine
- New Drug
- Phytopharmaceutical
- Ayurveda-Aahar
- Cosmetic
- Other / Needs Further Review

### 🧭 IPR Navigator
Provides structured IP-oriented analysis across areas represented in the indexed corpus, including patents, trademarks, designs, copyright and related considerations.

### 🌿 TK & ABS
Supports Traditional Knowledge, biological-resource and Access & Benefit Sharing analysis.

The current RAG configuration keeps **TKDL access disabled** unless an authorized access mechanism is actually available.

### 📚 Research
Provides document-backed research and source discovery using the indexed knowledge base.

### 🧑‍⚖️ Expert Guidance
Low-confidence or explicitly escalated cases can be routed to a matching expert type:

- Ayurveda Expert
- Legal / IP Expert
- Regulatory Affairs Expert

Users can track expert guidance from their workspace, while authenticated experts can view requests assigned to them.

### 📨 HelpDesk
Provides:

- Raise a Grievance
- FAQs
- Contact Us
- Terms & Conditions
- Privacy Policy

### 🗂️ My Workspace
Central area for user activity such as:

- conversations/sessions
- saved research
- notifications
- grievances
- expert guidance
- role-specific workspace functions

---

## 🌐 Multilingual Design

The frontend currently defines support for **23 languages**:

| Code | Language |
|---|---|
| `en` | English |
| `as` | Assamese |
| `bn` | Bengali |
| `brx` | Bodo |
| `doi` | Dogri |
| `gu` | Gujarati |
| `hi` | Hindi |
| `kn` | Kannada |
| `ks` | Kashmiri |
| `kok` | Konkani |
| `mai` | Maithili |
| `ml` | Malayalam |
| `mni` | Manipuri |
| `mr` | Marathi |
| `ne` | Nepali |
| `or` | Odia |
| `pa` | Punjabi |
| `sa` | Sanskrit |
| `sat` | Santali |
| `sd` | Sindhi |
| `ta` | Tamil |
| `te` | Telugu |
| `ur` | Urdu |

### Translation flow

The current architecture uses Bhashini as the live translation provider when its credentials are configured.

For RAG chat, the intended language boundary is:

```text
User query in selected language
            ↓
       Bhashini → English
            ↓
 Scope / classification / retrieval / reasoning
            ↓
       Grounded English result
            ↓
 Bhashini → selected language
            ↓
      Localized response
```

The frontend also translates application UI strings through the backend translation endpoint.

Bhashini credentials are supplied through environment variables; **API keys must never be committed to the repository.**

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                 React 19 + Vite + TypeScript               │
│                                                             │
│ Sahayak │ Product │ IPR │ TK/ABS │ Research │ Workspace    │
│ HelpDesk│ Expert Guidance │ Auth │ Notifications            │
└────────────────────────────┬────────────────────────────────┘
                             │ /api/*
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                             │
│                    Python + FastAPI                         │
│                                                             │
│ Auth / RBAC / OTP / MongoDB / Conversations / Workspace    │
│ Notifications / Grievances / Experts / Translation         │
└────────────────────────────┬────────────────────────────────┘
                             │ RAG service API
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       RAG ENGINE                            │
│                 Python + FastAPI                            │
│                                                             │
│ Scope & jurisdiction → Retrieval → Graph context            │
│ → Grounded generation → Citation/confidence handling         │
└──────────────┬───────────────────────┬──────────────────────┘
               │                       │
               ▼                       ▼
       ┌───────────────┐       ┌────────────────┐
       │ Qdrant + BM25 │       │ Neo4j GraphRAG │
       └───────────────┘       └────────────────┘
               │
               ▼
       Indexed legal / regulatory corpus
```

### Service responsibilities

| Service | Responsibility |
|---|---|
| `frontend/` | User interface, routing, language/theme state, chat/workspace views |
| `backend/` | Auth, RBAC, MongoDB persistence, notifications, grievances, expert workflows, translation and RAG orchestration |
| `ip_sakti_rag/` | Retrieval, embeddings, RAG pipeline, graph context, generation, safety and confidence handling |

---

## 🔎 RAG Pipeline

The RAG service is designed around a grounded retrieval flow:

```text
User query
    │
    ├── selected language
    └── jurisdiction
    │
    ▼
Language boundary / scope handling
    │
    ▼
Hybrid retrieval
    ├── Qdrant semantic retrieval
    └── BM25 lexical retrieval
    │
    ▼
Score fusion / reranking
    │
    ▼
Neo4j graph context (when enabled)
    │
    ▼
Grounded generation
    │
    ▼
Citation + confidence handling
    │
    ├── sufficient evidence → grounded response
    └── low confidence / unsafe scope → safe handling + possible expert escalation
```

The deployed RAG service uses a **remote 384-dimensional FastEmbed embedding service** for query embeddings so that the main Render process does not need to load the local embedding model into its RAM.

---

## 📚 Knowledge Base

The repository contains an indexed legal/regulatory corpus covering areas such as:

- Indian Patents
- Copyright
- Designs
- Trade Marks
- GI
- Drugs and Cosmetics
- New Drugs and Clinical Trials
- Cosmetics
- FSSAI Ayurveda-Aahar
- National Biodiversity Authority material
- PPV&FR material
- WIPO treaties
- Nagoya Protocol / CBD
- DPDP material
- other indexed statutory/regulatory sources

The RAG service uses `data/documents/` as the source-document directory and `data/processed/` for processed/indexing artifacts.

`manifest.json` provides document metadata used to associate indexed documents with their source information and citation details.

---

## 🛡️ Safety & Evidence Handling

The system includes several layers intended to reduce unsupported answers:

- jurisdiction checks
- scope checks
- prompt-injection-aware handling
- retrieval grounding
- citation validation
- confidence assessment
- abstention for insufficient evidence
- expert escalation for selected low-confidence cases
- explicit legal/regulatory disclaimer behavior

The application should not imply that a source was consulted when that source was unavailable. In particular, TKDL is not presented as queried when authorized access is unavailable.

---

## 🔐 Authentication & Security

The backend supports:

- email/password login
- role-based access
- registration email verification
- security OTPs
- forgot password
- change password
- account deletion
- JWT-based authentication
- expert-type selection
- organization roles
- notification authorization
- account-scoped workspace data

### OTP-protected actions

OTP verification is used for:

- registration
- forgot password
- change password
- account deletion

### Roles

Current application roles include:

- Practitioner
- Researcher
- Expert
- Admin
- Organization

Experts can additionally be associated with a specific expert type.

---

## 🗄️ Persistence

### MongoDB

The backend uses MongoDB for application-level persistence, including data such as:

- users
- conversations
- chat messages
- product analyses
- saved research
- expert escalations
- notifications
- grievances
- feedback
- audit-related records

### Qdrant

Used for semantic/vector retrieval against the indexed RAG corpus.

### Neo4j

Used for graph context enrichment when configured and enabled.

---

## 📎 Attachments

The RAG service supports attachment context for:

- PDF
- DOCX
- TXT
- Markdown
- CSV
- JSON
- common image formats

Text documents are extracted locally by the service. Image attachments can be interpreted through the configured Groq multimodal path when available.

Attachment content is bounded before being passed into the RAG workflow.

---

## 🔌 Important API Surface

### Backend

Representative application endpoints include:

```text
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/login
GET    /api/auth/me

POST   /api/chat
GET    /api/conversations
POST   /api/conversations
PATCH  /api/conversations/{conversation_id}

POST   /api/products/analyze
POST   /api/ipr/analyze
POST   /api/abs/analyze
POST   /api/tk-abs/analyze

GET    /api/research/search
POST   /api/expert-escalation

GET    /api/notifications
GET    /api/notifications/unread-count
POST   /api/notifications/read-all

POST   /api/translate
POST   /api/contact

GET    /api/health
```

See the live Swagger documentation for the complete backend contract:

**https://ip-sakti-backend-dwox.onrender.com/docs**

### RAG service

Representative endpoints include:

```text
GET    /api/health
POST   /api/chat
POST   /api/attachment/context
POST   /api/products/analyze
POST   /api/ipr/analyze
POST   /api/abs/analyze
POST   /api/tk-abs/analyze

GET    /api/research/search
GET    /api/rag/documents
GET    /api/documents/{document_id}
GET    /api/documents/{document_id}/source
GET    /api/rag/telemetry
```

---

## 🧑‍💻 Local Development

### Prerequisites

- Python 3.12+
- Node.js 18+
- npm
- MongoDB for persistent application data
- Qdrant for vector retrieval
- Neo4j if graph enrichment is enabled
- credentials for the configured LLM/translation/embedding services

### 1. Start the RAG service

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

Configure `ip_sakti_rag/.env`, then run:

```bash
uvicorn main:app --reload --port 8001
```

Health check:

```text
http://localhost:8001/api/health
```

### 2. Start the backend

```bash
cd backend

python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install:

```bash
pip install -r requirements.txt
```

Copy:

```text
backend/.env.example → backend/.env
```

At minimum, configure the backend to reach the RAG service:

```env
RAG_SERVICE_URL=http://localhost:8001
```

Then:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check:

```text
http://localhost:8000/api/health
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The Vite development server proxies `/api/*` to the backend.

---

## 🚀 Deployment Model

The current repository is organized as three sibling services:

```text
ip_sakti_rag/  → RAG service
backend/       → application API
frontend/      → web application
```

A typical deployment sequence is:

1. Deploy the RAG service.
2. Confirm `/api/health`.
3. Configure the backend with the RAG service URL and shared secret.
4. Deploy the backend.
5. Confirm backend health and RAG connectivity.
6. Deploy the frontend.
7. Configure the frontend's `/api/*` rewrite to the backend.
8. Verify authentication, chat, translation, citations and workspace flows.

The current frontend contains a Render rewrite in:

```text
frontend/public/_redirects
```

which routes:

```text
/api/*
```

to the deployed backend.

---

## ⚙️ Environment Variables

Do not commit `.env` files or real credentials.

### Backend

Important groups include:

```env
MONGODB_URI=
MONGODB_DB_NAME=ip_sakti

RAG_SERVICE_URL=
RAG_SERVICE_SHARED_SECRET=

TRANSLATION_PROVIDER=bhashini
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=

JWT_SECRET=

EMAIL_BACKEND=
BREVO_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=
CONTACT_RECIPIENT=
```

`BHASHINI_ULCA_API_KEY` remains accepted as a legacy compatibility variable, but the current configuration uses the Udyat key plus the separate inference key.

### RAG

Important groups include:

```env
LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=

EMBEDDING_SERVICE_URL=
EMBEDDING_SERVICE_TOKEN=

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=

NEO4J_ENABLED=
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

TRANSLATION_PROVIDER=
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=

RAG_SERVICE_SHARED_SECRET=
```

Use the repository's `.env.example` files as the authoritative variable list for the current checkout.

---

## 📁 Repository Structure

```text
IP-Sakti-Sahayak-main/
│
├── README.md
├── DEPLOYMENT.md
├── setup_steps.md
│
├── frontend/
│   ├── README.md
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── data/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── README.md
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── database/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── translation/
│   ├── tests/
│   └── requirements.txt
│
├── ip_sakti_rag/
│   ├── README.md
│   ├── app/
│   │   ├── generation/
│   │   ├── ingestion/
│   │   ├── retrieval/
│   │   ├── safety/
│   │   └── translation/
│   ├── data/
│   │   ├── documents/
│   │   └── processed/
│   ├── scripts/
│   ├── tests/
│   ├── main.py
│   └── requirements*.txt
│
└── scripts/
    ├── ingest_documents.py
    ├── mongo_setup.js
    └── qdrant_init.py
```

---

## 🧪 Testing

Backend tests are located in:

```text
backend/tests/
```

Run:

```bash
cd backend
python -m pytest tests/ -v
```

RAG tests and sample queries are located in:

```text
ip_sakti_rag/tests/
```

The frontend currently provides the Vite build command:

```bash
cd frontend
npm run build
```

---

## 📝 Documentation

| File | Purpose |
|---|---|
| `README.md` | Project overview and architecture |
| `setup_steps.md` | Local setup and service startup |
| `DEPLOYMENT.md` | Deployment guidance |
| `backend/README.md` | Backend-specific documentation |
| `ip_sakti_rag/README.md` | RAG-specific documentation |
| `backend/docs/NEW_FEATURES.md` | Backend feature details |
| `ip_sakti_rag/docs/SOURCE_ACQUISITION_GUIDE.md` | Source acquisition guidance |

---

## ⚠️ Operational Notes

- Render web services can experience cold starts depending on the deployment plan.
- External services such as MongoDB, Qdrant, Neo4j, LLM providers, embedding services and Bhashini can independently affect availability.
- Keep the RAG service and backend shared secret synchronized when enabled.
- Keep the indexed corpus and Qdrant collection compatible with the same embedding dimension/model.
- Never expose API keys in frontend source code.
- Never commit `.env` files containing credentials.
- Legal and regulatory information should be verified against the latest authoritative source before filing, compliance or commercial decisions.

---

## 📄 License / Project Context

IP-SAKTI Sahayak is developed as an SIH-oriented project for multilingual IP and regulatory decision support in the Ayurveda/AYUSH domain.

The repository should be treated as the source of truth for the exact implementation, environment variables and deployment configuration of the current version.
