# ⚙️ IP-SAKTI Sahayak — Backend

> **FastAPI application backend for authentication, persistence, user workflows, expert escalation, notifications, grievances, translation and RAG orchestration.**

The backend is the **application/API layer** between the React frontend and the dedicated `ip_sakti_rag` service.

---

## ✨ Start Here

<p align="center">
  <strong>Secure application orchestration for IP-SAKTI Sahayak.</strong><br/>
  Auth • MongoDB • RAG Gateway • Bhashini • Experts • Notifications • Workspace
</p>

### 🔗 Live API

**Backend:** https://ip-sakti-backend-dwox.onrender.com/

**Swagger:** https://ip-sakti-backend-dwox.onrender.com/docs

**Health:** https://ip-sakti-backend-dwox.onrender.com/api/health

---

## 🎯 Backend Responsibility

The backend intentionally does **not** own the core RAG retrieval/generation pipeline.

Instead:

```text
Frontend
   │
   ▼
Backend
   ├── Authentication / RBAC
   ├── MongoDB persistence
   ├── Conversations
   ├── Workspace
   ├── Notifications
   ├── Grievances
   ├── Expert escalation
   ├── Translation
   └── RAG service gateway
             │
             ▼
        ip_sakti_rag
```

This separation keeps user/application concerns independent from the retrieval and reasoning engine.

---

## 🧱 Technology Stack

- **Python 3.12+**
- **FastAPI**
- **Pydantic / pydantic-settings**
- **MongoDB / PyMongo**
- **JWT authentication**
- **Bhashini translation**
- **Brevo HTTPS email delivery**
- **HTTP communication with `ip_sakti_rag`**
- **Pytest** for backend tests

---

## 📁 Project Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── deps.py
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── chat.py
│   │       ├── experts.py
│   │       ├── health.py
│   │       ├── misc_routes.py
│   │       ├── notifications.py
│   │       ├── products.py
│   │       └── rag_routes.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── security.py
│   │
│   ├── database/
│   │   └── session.py
│   │
│   ├── models/
│   ├── schemas/
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── conversation_service.py
│   │   ├── email_service.py
│   │   ├── expert_escalation_service.py
│   │   ├── notification_service.py
│   │   └── ...
│   │
│   ├── translation/
│   │   └── translation_service.py
│   │
│   ├── rag_client.py
│   └── main.py
│
├── data/
├── docs/
├── scripts/
├── tests/
├── .env.example
├── Dockerfile
└── requirements.txt
```

---

## 🔐 Authentication

The backend provides account and session APIs under `/api/auth`.

### Main flow

```text
Registration
    ↓
Pending registration
    ↓
Email OTP
    ↓
Verification
    ↓
Account created
    ↓
Login
    ↓
JWT session
```

### Security actions

OTP verification is supported for:

- registration
- forgot password
- change password
- account deletion

The backend also supports:

- JWT access tokens
- role-based authorization
- active role selection
- organization roles
- password verification
- security alerts
- account-scoped resources

---

## 👥 Roles

Current roles are:

```text
Practitioner
Researcher
Expert
Admin
Organization
```

Experts can have one of these expert types:

```text
Ayurveda Expert
Legal / IP Expert
Regulatory Affairs Expert
```

Expert type information is used by the escalation workflow when matching a low-confidence case to an available expert.

---

## 🧑‍⚖️ Expert Escalation

Expert routing is persisted in MongoDB.

### User side

A user can receive an expert-review recommendation when the RAG workflow identifies a low-confidence case or the user requests expert assistance.

The backend can:

1. determine the requested expert type
2. find a matching expert
3. assign the escalation
4. notify the expert
5. notify the requesting user
6. expose the case in the appropriate workspace

### Expert side

Experts can access only requests assigned to their account unless they have the required administrative role.

Escalation status supports:

```text
pending
assigned
resolved
```

---

## 🔔 Notifications

Notifications are account-scoped.

Endpoints include:

```text
GET  /api/notifications
GET  /api/notifications/unread-count
PATCH /api/notifications/{notification_id}/read
POST /api/notifications/read-all
```

The backend stores the notification and unread state in MongoDB.

---

## 🗂️ Workspace

The backend supports workspace persistence for:

- conversations
- saved research
- grievances
- expert guidance
- notifications
- product analyses
- related user activity

All account-owned records are scoped to the authenticated user.

---

## 📨 Grievances & Contact

The backend exposes application workflows for:

- Raise a Grievance
- Contact Us
- grievance history
- grievance deletion where permitted
- confirmation emails

The exact email delivery provider is controlled by configuration.

---

## 🌐 Translation / Bhashini

The translation service is available through:

```text
POST /api/translate
```

Current configuration uses:

```env
TRANSLATION_PROVIDER=bhashini
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=
```

`BHASHINI_ULCA_API_KEY` remains accepted only as a legacy compatibility variable.

### Credential roles

The current integration treats:

- **Udyat key** as the pipeline/configuration credential
- **Inference key** as the inference authorization credential

The actual Bhashini wire-level pipeline configuration request may still use the provider's expected `ulcaApiKey` header name; this is a protocol detail and does not mean the project is using the old environment-variable naming.

Never commit credentials to the repository.

---

## 🔌 RAG Gateway

`app/rag_client.py` provides the backend's HTTP gateway to `ip_sakti_rag`.

Representative calls include:

```text
POST /api/chat
POST /api/attachment/context
POST /api/products/analyze
POST /api/ipr/analyze
POST /api/abs/analyze
POST /api/tk-abs/analyze
GET  /api/research/search
GET  /api/rag/documents
GET  /api/documents/{document_id}
GET  /api/rag/telemetry
```

The backend can attach the configured internal shared secret:

```env
RAG_SERVICE_SHARED_SECRET=
```

The value must match the RAG service's corresponding configuration.

---

## 🧩 API Routes

### Authentication

```text
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/resend-otp
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout

POST   /api/auth/forgot-password/request
POST   /api/auth/forgot-password/confirm

POST   /api/auth/change-password/request
POST   /api/auth/change-password/confirm

POST   /api/auth/delete-account/request
POST   /api/auth/delete-account/confirm
```

### Chat & conversations

```text
POST   /api/chat
POST   /api/query
POST   /api/chat/attachment-context

GET    /api/conversations
GET    /api/conversations/{conversation_id}
POST   /api/conversations
PATCH  /api/conversations/{conversation_id}
DELETE /api/conversations
DELETE /api/conversations/{conversation_id}
POST   /api/conversations/{conversation_id}/feedback
```

### Analysis

```text
POST   /api/products/analyze
GET    /api/products
GET    /api/products/{product_id}
GET    /api/products/{product_id}/pdf

POST   /api/ipr/analyze
GET    /api/ipr/overview

POST   /api/abs/analyze
POST   /api/tk-abs/analyze
GET    /api/tk-abs/{analysis_id}
GET    /api/tk-abs/{analysis_id}/pdf
```

### Research & resources

```text
GET /api/research/search
GET /api/resources
GET /api/official-links
GET /api/rag/documents
GET /api/documents/{document_id}
GET /api/documents/{document_id}/source
```

### Workspace

```text
GET    /api/workspace/saved-research
POST   /api/workspace/save-research
DELETE /api/workspace/saved-research/{research_id}

GET    /api/workspace/grievances
POST   /api/workspace/grievances
DELETE /api/workspace/grievances/{grievance_id}
```

### Expert escalation

```text
POST  /api/expert-escalation
GET   /api/expert-escalations
GET   /api/expert-escalations/mine
PATCH /api/expert-escalations/{escalation_id}
```

### Notifications

```text
GET   /api/notifications
GET   /api/notifications/unread-count
PATCH /api/notifications/{notification_id}/read
POST  /api/notifications/read-all
```

### Translation

```text
POST /api/translate
```

### Health

```text
GET /api/health
```

---

## 🗄️ MongoDB

MongoDB is the backend's persistent application datastore.

The default database name is:

```text
ip_sakti
```

Stored application data includes user/account information, conversations, analyses, notifications, grievances, expert escalations, feedback and related workspace data.

If `MONGODB_URI` is blank, the code supports a local/in-process fallback intended for development/demo scenarios rather than persistent production storage.

---

## 📧 Email & OTP Delivery

The backend supports email delivery through the configured email backend.

For the current deployment configuration, Brevo HTTPS API is used:

```env
EMAIL_BACKEND=brevo
BREVO_API_KEY=<your key>
EMAIL_FROM_ADDRESS=<verified sender>
EMAIL_FROM_NAME=IP-SAKTI Sahayak
CONTACT_RECIPIENT=<recipient>
```

Email workflows include:

- registration OTP
- security OTPs
- password-change confirmation
- account-deletion confirmation
- expert request notifications
- expert status updates
- grievance confirmation
- contact confirmation

Never commit `BREVO_API_KEY`.

---

## ⚙️ Environment Configuration

Copy:

```text
backend/.env.example → backend/.env
```

Important variables:

```env
APP_ENV=development
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000

MONGODB_URI=
MONGODB_DB_NAME=ip_sakti

RAG_SERVICE_URL=http://localhost:8001
RAG_SERVICE_SHARED_SECRET=

TRANSLATION_PROVIDER=bhashini
BHASHINI_USER_ID=
BHASHINI_UDYAT_API_KEY=
BHASHINI_INFERENCE_API_KEY=

JWT_SECRET=

EMAIL_BACKEND=brevo
BREVO_API_KEY=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=IP-SAKTI Sahayak
CONTACT_RECIPIENT=
```

Use the complete `.env.example` for the remaining security, upload, certificate and notification settings.

---

## 🛠️ Local Development

### Prerequisites

- Python 3.12+
- MongoDB for persistent development data
- running `ip_sakti_rag` service

### Install

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

Configure:

```text
backend/.env
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

Open:

```text
http://localhost:8000/docs
```

Health:

```text
http://localhost:8000/api/health
```

---

## 🧪 Testing

Backend tests are in:

```text
backend/tests/
```

Run:

```bash
python -m pytest tests/ -v
```

The current suite covers areas including:

- API behavior
- authentication
- chat
- attachments
- conversation ordering
- device/security alerts
- email OTP
- expert certificates
- IPR/resources
- notifications
- PDF export
- RAG/safety
- roles
- URL safety

---

## 🐳 Docker

A backend `Dockerfile` is included:

```text
backend/Dockerfile
```

Use the repository's deployment configuration when building the production image/service.

---

## 🔗 Related Documentation

- Root: `../README.md`
- Frontend: `../frontend/README.md`
- RAG: `../ip_sakti_rag/README.md`
- Feature notes: `docs/NEW_FEATURES.md`
- Setup: `../setup_steps.md`
- Deployment: `../DEPLOYMENT.md`
