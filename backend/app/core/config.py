"""
Central application configuration.

RAG internals (LLM, embeddings, vector store, knowledge graph) now live
entirely in the sibling `ip_sakti_rag` service -- this backend only needs to
know how to reach it (RAG_SERVICE_URL / RAG_SERVICE_SHARED_SECRET). Every
other external-service setting here (MongoDB, Bhashini) is still optional:
when missing, the relevant module falls back to a clearly-labelled
local/demo implementation instead of pretending to be a live integration.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_env: str = "development"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:3000"
    log_level: str = "INFO"

    # Database -- MongoDB is the sole persistent application datastore.
    # Leave MONGODB_URI blank to run against an in-process, pymongo-API-
    # compatible in-memory store (DEMO MODE -- non-persistent, resets on
    # restart). Set MONGODB_URI to a real MongoDB for a persistent database.
    mongodb_uri: str = ""
    mongodb_db_name: str = "ip_sakti"

    # --- RAG microservice (ip_sakti_rag) ---
    # This backend no longer does retrieval/generation itself -- it calls
    # the sibling ip_sakti_rag FastAPI service for every RAG-backed
    # endpoint (chat, product/IPR/TK-ABS analysis, research search,
    # document listing, telemetry). Leave RAG_SERVICE_URL pointed at your
    # local ip_sakti_rag instance for dev (default: localhost:8001).
    rag_service_url: str = "http://localhost:8001"
    rag_service_shared_secret: str = ""
    rag_service_timeout_seconds: float = 60.0

    # Translation (UI strings -- separate from RAG; unaffected by the above)
    translation_provider: str = "bhashini"
    bhashini_api_key: str = ""  # legacy compatibility
    bhashini_user_id: str = ""
    bhashini_ulca_api_key: str = ""
    bhashini_inference_api_key: str = ""

    # Email / SMTP
    email_backend: str = "auto"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_starttls: bool = True
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: float = 10.0
    email_from_address: str = "no-reply@your-domain.example"
    email_from_name: str = "IP-SAKTI Sahayak"
    email_console_show_body: bool = False
    contact_recipient: str = ""

    # Email verification / security OTPs
    otp_length: int = 6
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    otp_max_sends_per_hour: int = 5
    otp_pepper: str = ""
    require_email_verification: bool = True

    # Security
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    @property
    def rag_service_configured(self) -> bool:
        return bool(self.rag_service_url)

    @property
    def mongodb_configured(self) -> bool:
        return bool(self.mongodb_uri)

    @property
    def bhashini_configured(self) -> bool:
        return bool(self.bhashini_user_id and self.bhashini_ulca_api_key)

    @property
    def llm_configured(self) -> bool:
        return True

    @property
    def qdrant_configured(self) -> bool:
        return True

    @property
    def neo4j_configured(self) -> bool:
        return True


@lru_cache
def get_settings() -> Settings:
    return Settings()