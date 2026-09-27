"""
Centralised, env-driven configuration.
Nothing here is hard-coded secrets — everything sensitive comes from `.env`.

CHANGED: removed `embedding_model` (was a sentence-transformers model path —
embeddings now come from the Gemini API via LLM_API_KEY, see
app/embeddings.py) and `reranker_enabled`/`reranker_model` (reranking is now
Reciprocal Rank Fusion, a pure algorithm with no model/setting to configure —
see app/retrieval/hybrid.py). If your existing .env still has
EMBEDDING_MODEL / RERANKER_ENABLED / RERANKER_MODEL lines, they're now
harmless no-ops (extra="ignore" below) — fine to leave or remove.

CHANGED AGAIN: embeddings remain the already-ingested FastEmbed model/vector
space, but inference is moved to a separate embedding service so the Render
RAG process does not load the ONNX model into its RAM. LLM_API_KEY remains
for answer generation and the optional Gemini reranker only.
"""
from __future__ import annotations

from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM provider used by generation, scope classification and reranking.
    # For the Render deployment this is Groq.
    LLM_PROVIDER: str = "groq"
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "openai/gpt-oss-120b"

    @model_validator(mode="after")
    def migrate_deprecated_groq_model(self):
        # Groq retired openai/gpt-oss-120b on 2026-08-16. Keep an older
        # Render environment variable from breaking the service by mapping it
        # to the current GPT-OSS 120B production model automatically.
        if (
            self.LLM_PROVIDER.strip().lower() == "groq"
            and self.LLM_MODEL.strip() == "openai/gpt-oss-120b"
        ):
            self.LLM_MODEL = "openai/gpt-oss-120b"
        return self

    # Embeddings: inference is hosted outside Render. The deployed service
    # must expose /embed and use the SAME 384-D FastEmbed model that created
    # the existing Qdrant collection.
    embedding_service_url: str | None = None
    embedding_service_token: str | None = None
    embedding_service_timeout: int = 120

    # Qdrant
    qdrant_local_path: str = "./data/qdrant_local"
    qdrant_collection: str = "ip_sakti_chunks"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None

    # TKDL (placeholder — see app/retrieval/tkdl_connector.py)
    tkdl_enabled: bool = False

    # Neo4j
    neo4j_enabled: bool = True
    neo4j_uri: str | None = None
    neo4j_username: str | None = None
    neo4j_password: str | None = None

    # MongoDB application data
    mongodb_uri: str | None = None
    mongodb_db_name: str = "ip_sakti"

    # Retrieval tuning
    top_k: int = 5
    # Weights for the fallback (non-reranked) fused score when Groq reranking
    # is unavailable -- see app/retrieval/hybrid.py. Should sum to ~1.0 so the
    # result stays on the same 0-1 scale the confidence thresholds below expect.
    semantic_weight: float = 0.6
    keyword_weight: float = 0.4

    # Safety thresholds
    confidence_high_threshold: float = 0.45
    confidence_moderate_threshold: float = 0.28
    confidence_low_threshold: float = 0.15
    min_chunks_for_high_confidence: int = 3
    abstain_below_score: float = 0.15
    # Below this rescaled confidence score, decide_abstention() flags the
    # answer for expert review; the backend's expert_escalation_service uses
    # the same 0.80 cutoff, so a message is only ever redirected to an expert
    # when its displayed confidence score is under 80%.
    confidence_expert_escalation_threshold: float = 0.80

    # Translation (Bhashini) — see app/translation/bhashini_client.py
    translation_provider: str = "none"  # none | bhashini
    bhashini_api_key: str | None = None  # legacy compatibility
    bhashini_user_id: str | None = None
    bhashini_ulca_api_key: str | None = None
    bhashini_inference_api_key: str | None = None

    # Shared secret for callers of the FastAPI service.
    rag_service_shared_secret: str | None = None

    @property
    def documents_dir(self) -> Path:
        return BASE_DIR / "data" / "documents"

    @property
    def processed_dir(self) -> Path:
        return BASE_DIR / "data" / "processed"

    @property
    def processed_chunks_file(self) -> Path:
        return self.processed_dir / "chunks.jsonl"

    @property
    def processed_documents_file(self) -> Path:
        return self.processed_dir / "documents.jsonl"

    @property
    def ingestion_state_file(self) -> Path:
        return self.processed_dir / "ingestion_state.json"


settings = Settings()

# Allow-list of authorities that may back a cited claim. Anything outside this list
# gets flagged by the citation validator as low-trust (see safety/citation_validator.py).
AUTHORITATIVE_SOURCES_ALLOWLIST = {
    "ip india", "cgpdtm", "office of the controller general of patents",
    "ministry of ayush", "ayush", "cdsco",
    "national biodiversity authority", "nba", "state biodiversity board", "sbb",
    "fssai", "food safety and standards authority of india",
    "wipo", "world intellectual property organization", "pct",
    "india code", "gazette of india",
    "trade marks registry", "designs office",
    "protection of plant varieties authority", "ppv&fr",
    "tkdl", "csir-tkdl",  # only via authorized access — see ingestion notes
}

DISCLAIMER_TEXT = (
    "This is informational, decision-support guidance generated from indexed official "
    "sources — it is not legal advice. For patent filings, regulatory submissions, or "
    "ABS applications, please consult a registered patent agent, advocate, or qualified "
    "regulatory affairs specialist."
)
