# 🌐 IP-SAKTI Sahayak — Frontend

> **React 19 + Vite + TypeScript frontend for the IP-SAKTI Sahayak multilingual IP, AYUSH and regulatory decision-support platform.**

The frontend provides the complete user-facing experience: Sahayak AI, product analysis, IPR navigation, Traditional Knowledge & ABS, research, expert guidance, workspace, HelpDesk, authentication, notifications and multilingual UI.

---

## ✨ Start Here

<p align="center">
  <strong>One workspace for IP research, AYUSH regulation and evidence-aware guidance.</strong><br/>
  Multilingual • Source-aware • Jurisdiction-aware • Role-aware
</p>

### 🔗 Live Application

**Frontend:** https://ip-sakti-frontend.onrender.com/

**Backend API:** https://ip-sakti-backend-dwox.onrender.com/docs

---

## 🧭 What the Frontend Provides

| Area | Purpose |
|---|---|
| 🤖 **Sahayak** | Conversational IP/AYUSH/regulatory assistance |
| 🧪 **Product Analyzer** | Product category, regulatory, IP and TK/ABS analysis |
| 🧭 **IPR Navigator** | Structured IP-oriented research and guidance |
| 🌿 **TK & ABS** | Traditional Knowledge and biodiversity/ABS analysis |
| 📚 **Research** | Source and document discovery |
| 🧑‍⚖️ **Expert Guidance** | Expert escalation and consultation tracking |
| 🗂️ **My Workspace** | Sessions, research, notifications, grievances and expert guidance |
| 📨 **HelpDesk** | FAQs, grievances, contact and policy pages |
| 🔔 **Notifications** | Account-scoped application notifications |
| 👤 **Profile/Auth** | Login, registration, roles and account security |

---

## 🏗️ Frontend Architecture

```text
                         React Application
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
       Components           Contexts              Utils
          │                    │                    │
          │          ┌─────────┼─────────┐          │
          │          │         │         │          │
          │       Auth      Language  Notifications │
          │       Theme   Jurisdiction   Expert     │
          │          │         │         │          │
          └──────────┴─────────┴─────────┴──────────┘
                               │
                               ▼
                         /api/* requests
                               │
                               ▼
                         FastAPI Backend
```

### Main technologies

- **React 19**
- **TypeScript**
- **Vite 6**
- **Tailwind CSS 4**
- **Lucide React** for icons
- **Motion** for interface animation
- **jsPDF** for client-side PDF-related functionality

---

## 📁 Source Structure

```text
frontend/
├── public/
│   ├── assets/
│   ├── ip-sakti-favicon.png
│   ├── ip-sakti-logo.png
│   └── _redirects
│
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── types.ts
│   │
│   ├── components/
│   │   ├── AdminView.tsx
│   │   ├── ChatView.tsx
│   │   ├── ExpertAdvisoryView.tsx
│   │   ├── HelpDeskView.tsx
│   │   ├── IPRNavigatorView.tsx
│   │   ├── LandingView.tsx
│   │   ├── ProductAnalyzerView.tsx
│   │   ├── ResearchView.tsx
│   │   ├── TraditionalKnowledgeView.tsx
│   │   ├── WorkspaceView.tsx
│   │   └── ...
│   │
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── ExpertAdvisoryContext.tsx
│   │   ├── JurisdictionContext.tsx
│   │   ├── LanguageContext.tsx
│   │   ├── NotificationContext.tsx
│   │   ├── ThemeContext.tsx
│   │   ├── indicDictionaries.ts
│   │   └── translations.ts
│   │
│   └── utils/
│       ├── jurisdictionValidation.ts
│       ├── pdfGenerator.ts
│       ├── queryRelevance.ts
│       └── sectionLinks.tsx
│
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🌐 Multilingual UI

The frontend defines 23 supported languages:

```text
English
Assamese
Bengali
Bodo
Dogri
Gujarati
Hindi
Kannada
Kashmiri
Konkani
Maithili
Malayalam
Manipuri
Marathi
Nepali
Odia
Punjabi
Sanskrit
Santali
Sindhi
Tamil
Telugu
Urdu
```

Language state is managed by:

```text
src/context/LanguageContext.tsx
```

The frontend uses the backend translation endpoint:

```text
POST /api/translate
```

The application combines local curated translations with live Bhashini translation when configured.

The language selection is intended to affect both:

- application UI text
- Sahayak/RAG response language

---

## 🧠 Sahayak Chat

`ChatView.tsx` is the main conversational interface.

It supports:

- user questions
- jurisdiction selection
- localized responses
- source citations
- confidence information
- relevant considerations
- recommended next steps
- feedback
- conversation history
- attachments
- low-confidence expert escalation
- safe handling of out-of-scope queries

### Attachment support

The frontend can send supported attachments for backend/RAG processing.

Supported categories include:

- PDF
- DOCX
- TXT
- MD
- CSV
- JSON
- common image formats

The frontend displays attachment processing state before the question is sent.

---

## 🧭 Jurisdiction

The UI exposes two main modes:

```text
Indian
International
```

The selected jurisdiction is passed with relevant requests so the backend/RAG layer can apply jurisdiction-aware scope handling.

---

## 👥 Role-Aware Experience

Current frontend role definitions include:

- Practitioner
- Researcher
- Expert
- Admin
- Organization

The application also normalizes legacy role identifiers such as:

```text
USER   → Practitioner
EXPERT → Expert
ADMIN  → Admin
```

Expert accounts additionally support an expert type:

- Ayurveda Expert
- Legal / IP Expert
- Regulatory Affairs Expert

---

## 🧑‍⚖️ Expert Workspace

The expert workflow is backed by the backend expert-escalation API.

An expert can view requests assigned to their account and update the escalation status.

Typical lifecycle:

```text
Low-confidence / user escalation
          ↓
Expert type identified
          ↓
Matching expert selected
          ↓
Request assigned
          ↓
Expert Workspace
          ↓
Pending → Assigned → Resolved
```

---

## 🔔 Notifications

Notifications are managed through:

```text
src/context/NotificationContext.tsx
```

The context communicates with:

```text
GET  /api/notifications
GET  /api/notifications/unread-count
PATCH /api/notifications/{notification_id}/read
POST /api/notifications/read-all
```

The header bell uses the same account-scoped notification system as the workspace.

---

## 📨 HelpDesk

`HelpDeskView.tsx` provides:

- Raise a Grievance
- FAQs
- Contact Us
- Terms & Conditions
- Privacy Policy

The HelpDesk is available as part of the main application navigation.

---

## 🔐 Authentication

Authentication state is managed through:

```text
src/context/AuthContext.tsx
```

The frontend supports:

- login
- registration
- email verification
- forgot password
- change password
- account deletion
- role selection/activation
- persistent login/Remember Me behavior

Tokens and user session state are handled by the authentication storage/context layer.

---

## 🔌 API Communication

In local development, Vite proxies `/api/*` to:

```text
http://localhost:8000
```

The proxy is configured in:

```text
vite.config.ts
```

The production frontend contains:

```text
public/_redirects
```

with the current backend rewrite:

```text
/api/*  https://ip-sakti-backend-dwox.onrender.com/api/:splat  200
```

This allows the browser to use relative `/api/...` requests while the deployed frontend and backend remain separate services.

---

## 🛠️ Local Setup

### Prerequisites

- Node.js 18+
- npm
- running IP-SAKTI backend

### Install

```bash
cd frontend
npm install
```

### Start development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Optional API target override

The Vite configuration supports:

```env
VITE_API_BASE_URL=http://localhost:8000
```

when the backend is running somewhere other than the default local address.

### Production build

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

---

## 🎨 UI Design Principles

The current interface follows a professional, information-dense but structured visual language intended for an IP/regulatory application:

- clear hierarchy
- restrained government/enterprise visual style
- consistent iconography
- responsive layouts
- accessible controls
- light/dark theme support
- localized labels
- status and confidence indicators
- citation-focused answer presentation

---

## 🧩 Important Context Providers

| Context | Responsibility |
|---|---|
| `AuthContext` | Authentication and current user |
| `LanguageContext` | Selected language and translation |
| `JurisdictionContext` | India/International mode |
| `NotificationContext` | Notifications and unread count |
| `ExpertAdvisoryContext` | Expert guidance state |
| `ThemeContext` | Light/dark appearance |

---

## 🧪 Build Verification

Run:

```bash
npm run build
```

A successful build generates:

```text
frontend/dist/
```

The generated application can then be served by a static host such as Render.

---

## ⚠️ Frontend Security Notes

- Do not put API secrets in frontend source code.
- Do not place Bhashini, LLM, MongoDB, Qdrant or Neo4j credentials in `VITE_*` variables.
- Frontend API calls should use the backend as the application gateway.
- Authentication tokens must be handled through the existing auth storage/context implementation.
- Production API routing must point `/api/*` to the intended backend.

---

## 🔗 Related Documentation

- Root project documentation: `../README.md`
- Backend documentation: `../backend/README.md`
- RAG documentation: `../ip_sakti_rag/README.md`
- Setup guide: `../setup_steps.md`
- Deployment guide: `../DEPLOYMENT.md`
