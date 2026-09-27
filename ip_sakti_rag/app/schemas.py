"""
Pydantic models. These mirror `frontend/src/types.ts` where possible
(Citation, ConfidenceMetric, ProductInformation, IPRNavigatorQuery, TKABSQuery, ...)
so a FastAPI backend can serialize these directly into what the React frontend expects,
plus the extra structured fields requested for the RAG contract
(product_classification, jurisdiction, intent, needs_clarification, needs_expert, evidence).
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field

Language = Literal[
    "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai",
    "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur",
]
ConfidenceLevel = Literal["High", "Moderate", "Low", "Insufficient evidence"]

ProductCategory = Literal[
    "Classical",
    "Proprietary",
    "Phytopharmaceutical",
    "Food / Ayurveda-Aahar",
    "Cosmetic",
    "Other / Needs Further Review",
]


# ---------------------------------------------------------------------------
# Document / chunk metadata (versioned, source-tracked)
# ---------------------------------------------------------------------------

class DocumentMetadata(BaseModel):
    id: str
    title: str
    source: str
    authority: str
    url: Optional[str] = None
    document_type: Literal["Act", "Rules", "Guidelines", "Treaty", "Notification", "Regulation"]
    jurisdiction: str
    publication_date: str
    effective_date: str
    language: str = "English"
    topic: str
    summary: str = ""
    version: int = 1
    superseded_by: Optional[str] = None
    status: Literal["Indexed", "Processing", "Chunking", "Failed"] = "Indexed"
    chunk_count: int = 0


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    source: str
    authority: str
    jurisdiction: str
    document_type: str
    section: str
    page: int = 1
    paragraph: Optional[str] = None
    language: str = "English"
    publication_date: str = ""
    effective_date: str = ""
    topic: str = ""
    chunk_text: str
    score: Optional[float] = None
    semantic_score: Optional[float] = None
    keyword_score: Optional[float] = None


class Citation(BaseModel):
    index: int
    chunk_id: str
    document_id: str
    title: str
    authority: str
    section: str
    source: str
    excerpt: str
    page: Optional[int] = None
    url: Optional[str] = None


class ConfidenceMetric(BaseModel):
    level: ConfidenceLevel
    score: float
    reasons: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Core chat / RAG response — the primary structured object
# ---------------------------------------------------------------------------

class RAGResponse(BaseModel):
    query: str
    language: Language
    product_classification: Optional[ProductCategory] = None
    jurisdiction: list[str] = Field(default_factory=list)
    intent: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    evidence: list[DocumentChunk] = Field(default_factory=list)
    confidence: ConfidenceMetric
    needs_clarification: bool = False
    needs_expert: bool = False
    relevant_considerations: list[str] = Field(default_factory=list)
    recommended_next_steps: list[str] = Field(default_factory=list)
    disclaimer: str
    # True when app/safety/scope_guard.py blocked this before retrieval/
    # generation ran at all (off-topic, prompt-injection attempt, or wrong
    # jurisdiction toggle) -- `answer` is then ONLY the warning/redirect
    # message, not an attempted answer. Frontend should render this
    # distinctly (no citations panel, no confidence badge).
    scope_blocked: bool = False
# ---------------------------------------------------------------------------
# Product analyzer (mirrors ProductInformation / ProductAnalysisResult)
# ---------------------------------------------------------------------------

class ProductInformation(BaseModel):
    product_name: str
    product_type: str = ""
    dosage_form: str = ""
    ingredients: str
    classical_reference: Optional[str] = None
    manufacturing_info: str = ""
    intended_use: str = ""
    claims: str = ""
    target_market: Literal["Domestic (India)", "Export", "Both"] = "Domestic (India)"
    biological_source_details: Optional[str] = None


class RegulatoryConsideration(BaseModel):
    title: str
    description: str
    governing_statute: str
    actionable_requirement: str


class IPRConsiderations(BaseModel):
    patent_assessment: str
    section_3p_tk_bar: str
    section_3e_admixture_bar: str
    trademark_recommendation: str
    industrial_design: str
    trade_secret_potential: str


class TKABSFlags(BaseModel):
    tk_prior_art_risk: Literal["High", "Medium", "Low"]
    tk_details: str
    biological_resource_status: str
    nba_abs_requirements: str
    form_required: str


class ProductAnalysisResult(BaseModel):
    id: str
    product_information: ProductInformation
    likely_category: ProductCategory
    category_reasoning: str
    confidence: ConfidenceMetric
    jurisdiction: list[str] = Field(default_factory=list)
    regulatory_considerations: list[RegulatoryConsideration] = Field(default_factory=list)
    ipr_considerations: IPRConsiderations
    traditional_knowledge_abs_flags: TKABSFlags
    recommended_next_steps: list[str] = Field(default_factory=list)
    evidence: list[Citation] = Field(default_factory=list)
    needs_expert: bool = False
    disclaimer: str


# ---------------------------------------------------------------------------
# IPR Navigator
# ---------------------------------------------------------------------------

class IPRNavigatorQuery(BaseModel):
    asset_type: str
    description: str = ""
    is_classical_text_derived: Optional[bool] = None
    has_synergistic_data: Optional[bool] = None
    is_biological_sourced_india: Optional[bool] = None
    is_novel_extraction_process: Optional[bool] = None
    uses_biological_resource: Optional[bool] = None
    has_traditional_basis: Optional[bool] = None
    has_synergy_data: Optional[bool] = None
    is_already_commercialized: Optional[bool] = None
    target_market: Optional[str] = None


class IPRNavigatorResult(BaseModel):
    potential_protection: list[str]
    primary_protection: str
    why_relevant: str
    important_considerations: list[str]
    relevant_authority: str
    documents_to_prepare: list[str]
    possible_next_steps: list[str]
    jurisdiction: list[str] = Field(default_factory=list)
    sources: list[Citation]
    confidence: ConfidenceMetric
    disclaimer: str


# ---------------------------------------------------------------------------
# TK / ABS
# ---------------------------------------------------------------------------

class TKABSQuery(BaseModel):
    biological_resource: str = ""
    plant_material: str = ""
    geographic_origin: str = ""
    traditional_use: str = ""
    source_community_info: str = ""
    intended_use: Literal[
        "Domestic commercial utilization",
        "Foreign entity utilization",
        "Collaborative research",
        "IP filing",
    ] = "Domestic commercial utilization"


class ABSConsiderations(BaseModel):
    nba_approval_needed: bool
    sbb_notification_needed: bool
    statutory_sections: list[str]
    benefit_sharing_rate: str
    exemptions_applicable: Optional[str] = None


class TKABSResult(BaseModel):
    traditional_knowledge_overview: str
    biological_resource_assessment: str
    abs_considerations: ABSConsiderations
    prior_art_tk_considerations: str
    potential_ip_implications: list[str]
    recommended_next_steps: list[str]
    sources: list[Citation]
    confidence: ConfidenceMetric
    disclaimer: str


# ---------------------------------------------------------------------------
# Research search / document registry / telemetry
# ---------------------------------------------------------------------------

class ResearchFilter(BaseModel):
    query: Optional[str] = None
    authority: Optional[str] = None
    topic: Optional[str] = None
    jurisdiction: Optional[str] = None
    document_type: Optional[str] = None
    language: Optional[str] = None


class TelemetryLogEntry(BaseModel):
    id: str
    timestamp: str
    query: str
    latency_ms: int
    confidence: ConfidenceLevel
    sources_retrieved: int


class RAGTelemetry(BaseModel):
    total_queries: int = 0
    average_retrieval_latency_ms: float = 0
    average_generation_latency_ms: float = 0
    low_confidence_queries_count: int = 0
    feedback_stats: dict = Field(default_factory=lambda: {"helpful": 0, "unhelpful": 0})
    recent_logs: list[TelemetryLogEntry] = Field(default_factory=list)
