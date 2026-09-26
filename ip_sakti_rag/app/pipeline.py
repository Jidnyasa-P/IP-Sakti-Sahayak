"""
IPSaktiRAG — the single class your FastAPI backend imports and calls.

    from app.pipeline import IPSaktiRAG
    rag = IPSaktiRAG()                     # load once at startup
    result = rag.answer_query("Can I patent my new Ayurvedic formulation "
                               "and export it to Germany?")

Everything else in this package (retrieval, generation, safety, classification,
jurisdiction) is wired together here. Nothing about the frontend is assumed
beyond the response shape documented in README.md / app/schemas.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.classification import classify_product
from app.database.mongo import save_chat
from app.config import settings
from app.generation.grounded_generator import generate_grounded_answer
from app.ingestion.metadata import load_manifest, load_processed_documents
from app.jurisdiction import detect_jurisdiction
from app.retrieval.graph import KnowledgeGraphContext
from app.retrieval.tkdl_connector import TKDLConnector
from app.retrieval.hybrid import HybridRetriever
from app.safety.abstention import apply_abstention_override, decide_abstention, get_disclaimer
from app.safety.citation_validator import validate_citations
from app.safety.confidence import compute_confidence
from app.safety.scope_guard import check_scope
from app.translation.bhashini_client import bhashini_translate_many
from app.schemas import (
    ABSConsiderations,
    Citation,
    ConfidenceMetric,
    DocumentChunk,
    DocumentMetadata,
    IPRConsiderations,
    IPRNavigatorQuery,
    IPRNavigatorResult,
    ProductAnalysisResult,
    ProductInformation,
    RAGResponse,
    RAGTelemetry,
    RegulatoryConsideration,
    TelemetryLogEntry,
    TKABSFlags,
    TKABSQuery,
    TKABSResult,
)


class IPSaktiRAG:
    def __init__(self):
        chunks = _load_chunks(settings.processed_chunks_file)
        processed_documents = load_processed_documents(settings.processed_documents_file)

        # Official statutory URLs are authoritative only when they come from
        # the current manifest.json. The processed JSONL may be stale after a
        # manifest-only URL correction, so overlay the current manifest URL at
        # service startup without changing any other document metadata.
        manifest_by_id = {
            meta.id: meta
            for meta in load_manifest(settings.documents_dir).values()
        }
        self.documents: list[DocumentMetadata] = [
            doc.model_copy(
                update={
                    "url": manifest_by_id.get(doc.id).url
                    if manifest_by_id.get(doc.id) is not None
                    else None
                }
            )
            for doc in processed_documents
        ]
        self.retriever = HybridRetriever(chunks, self.documents)
        self.graph = KnowledgeGraphContext()
        self.tkdl = TKDLConnector()
        self.telemetry = RAGTelemetry()

    # ------------------------------------------------------------------
    # 1. Core chat / RAG endpoint  (-> POST /api/chat, /api/chat/stream)
    # ------------------------------------------------------------------
    def answer_query(self, query: str, language: str | None = None, conversation_id: str | None = None, jurisdiction: str | None = None, attachment_context: str | None = None) -> dict:
        started = datetime.now(timezone.utc)

        # Enforce the selected India/International mode before any retrieval
        # or generation. The frontend check is only a UX guard; this is the
        # authoritative server-side check.
        selected_jurisdiction = (jurisdiction or "india").strip().lower()
        if selected_jurisdiction not in {"india", "international"}:
            selected_jurisdiction = "india"

        supported_languages = {
            "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok",
            "mai", "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd",
            "ta", "te", "ur",
        }
        safe_language = language if language in supported_languages else "en"
        attachment_context = (attachment_context or "").strip()[:16000]
        working_query = query
        if attachment_context:
            working_query = f"{query}\n\n[USER ATTACHMENT CONTEXT]\n{attachment_context}"

        # BHASHINI is used at the RAG boundary: user language -> English for
        # scope checking, classification, retrieval and generation. Source
        # documents/citations remain in their authoritative form.
        retrieval_query = working_query
        if safe_language != "en" and settings.translation_provider.strip().lower() == "bhashini":
            try:
                retrieval_query = bhashini_translate_many([working_query], safe_language, "en")[0]
            except Exception as exc:
                print(f"[bhashini] Input translation failed; using original query: {type(exc).__name__}: {exc}")

        scope = check_scope(retrieval_query, selected_jurisdiction)
        if not scope.allowed:
            blocked_answer = scope.message or "This query does not match the selected jurisdiction."
            if safe_language != "en" and settings.translation_provider.strip().lower() == "bhashini":
                try:
                    blocked_answer = bhashini_translate_many([blocked_answer], "en", safe_language)[0]
                except Exception as exc:
                    print(f"[bhashini] Scope-message translation failed: {type(exc).__name__}: {exc}")
            blocked_confidence = ConfidenceMetric(
                level="Insufficient evidence",
                score=0.0,
                reasons=["Query was blocked before retrieval because it does not match the selected jurisdiction or scope."],
            )
            out = RAGResponse(
                query=query,
                language=safe_language,
                product_classification=None,
                jurisdiction=[selected_jurisdiction],
                intent="SCOPE_GUARD_BLOCKED",
                answer=blocked_answer,
                citations=[],
                evidence=[],
                confidence=blocked_confidence,
                needs_clarification=True,
                needs_expert=False,
                relevant_considerations=[],
                recommended_next_steps=[],
                disclaimer=get_disclaimer(),
                scope_blocked=True,
            ).model_dump()
            out["conversation_id"] = conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
            out["retrieval_metadata"] = {
                "intent": "SCOPE_GUARD_BLOCKED",
                "language": safe_language,
                "latency_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
            }
            return out

        jurisdictions = detect_jurisdiction(retrieval_query)
        classification = classify_product(retrieval_query)

        retrieval = self.retriever.retrieve(
            query=retrieval_query,
            language="en",
            jurisdiction_filter="International" if selected_jurisdiction == "international" else "India",
            top_k=settings.top_k,
        )

        graph_context = self.graph.get_context([classification.category])
        generated = generate_grounded_answer(
            query=retrieval_query,
            language="en",
            chunks=retrieval.top_chunks,
            graph_context=graph_context.__dict__,
        )

        validation = validate_citations(generated["answer"], retrieval.citations)
        confidence = compute_confidence(
            top_score=retrieval.top_fused_score,
            chunk_count=len(retrieval.top_chunks),
            validation=validation,
        )

        needs_clarification, needs_expert = decide_abstention(
            confidence=confidence,
            chunk_count=len(retrieval.top_chunks),
            intent=retrieval.detected_intent,
            jurisdiction_count=len(jurisdictions),
        )
        final_answer = apply_abstention_override(validation.cleaned_answer, needs_clarification)
        relevant_considerations = generated.get("relevant_considerations", []) or []
        recommended_next_steps = generated.get("recommended_next_steps", []) or []
        disclaimer = get_disclaimer()

        if safe_language != "en" and settings.translation_provider.strip().lower() == "bhashini":
            texts_to_translate = [final_answer, *[str(x) for x in relevant_considerations], *[str(x) for x in recommended_next_steps], disclaimer]
            try:
                translated = bhashini_translate_many(texts_to_translate, "en", safe_language)
                final_answer = translated[0]
                offset = 1
                relevant_considerations = translated[offset:offset + len(relevant_considerations)]
                offset += len(relevant_considerations)
                recommended_next_steps = translated[offset:offset + len(recommended_next_steps)]
                disclaimer = translated[-1]
            except Exception as exc:
                print(f"[bhashini] Output translation failed; keeping English answer: {type(exc).__name__}: {exc}")

        self._log_telemetry(query, retrieval.latency_ms, confidence, len(retrieval.citations))

        response = RAGResponse(
            query=query,
            language=safe_language,
            product_classification=(
                classification.category if classification.category != "Other / Needs Further Review" else None
            ),
            jurisdiction=jurisdictions,
            intent=retrieval.detected_intent,
            answer=final_answer,
            citations=retrieval.citations,
            evidence=retrieval.top_chunks,
            confidence=confidence,
            needs_clarification=needs_clarification,
            needs_expert=needs_expert,
            relevant_considerations=relevant_considerations,
            recommended_next_steps=recommended_next_steps,
            disclaimer=disclaimer,
            scope_blocked=False,
        )

        out = response.model_dump()
        out["conversation_id"] = conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
        out["retrieval_metadata"] = {
            "intent": retrieval.detected_intent,
            "language": safe_language,
            "latency_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
        }
        save_chat(out["conversation_id"], query, out)
        return out

    # ------------------------------------------------------------------
    # 2. Product analyzer  (-> POST /api/products/analyze)
    # ------------------------------------------------------------------
    def analyze_product(self, product_info: dict) -> dict:
        info = ProductInformation(**product_info)
        classification = classify_product(
            f"{info.product_name} {info.ingredients} {info.intended_use} {info.classical_reference or ''} {info.claims}"
        )
        jurisdictions = detect_jurisdiction(
            f"{info.target_market} {info.intended_use}"
        )

        search_context = f"{info.product_name} {info.ingredients} {info.intended_use} {info.product_type} {classification.category}"
        retrieval = self.retriever.retrieve(query=search_context, top_k=6)

        graph_context = self.graph.get_context([classification.category])
        generated = generate_grounded_answer(
            query=search_context, language="en", chunks=retrieval.top_chunks, graph_context=graph_context.__dict__
        )
        validation = validate_citations(generated["answer"], retrieval.citations)
        confidence = compute_confidence(retrieval.top_fused_score, len(retrieval.top_chunks), validation)
        _, needs_expert = decide_abstention(confidence, len(retrieval.top_chunks), retrieval.detected_intent, len(jurisdictions))

        result = ProductAnalysisResult(
            id=f"PROD-{uuid.uuid4().hex[:10].upper()}",
            product_information=info,
            likely_category=classification.category,
            category_reasoning=classification.reasoning,
            confidence=confidence,
            jurisdiction=jurisdictions,
            regulatory_considerations=_build_regulatory_considerations(classification.category, retrieval.top_chunks),
            ipr_considerations=_build_ipr_considerations(classification.category, info, retrieval.top_chunks),
            traditional_knowledge_abs_flags=_build_tk_abs_flags(info, retrieval.top_chunks),
            recommended_next_steps=generated.get("recommended_next_steps", []),
            evidence=retrieval.citations,
            needs_expert=needs_expert,
            disclaimer=get_disclaimer(),
        )
        return result.model_dump()

    # ------------------------------------------------------------------
    # 3. IPR Navigator  (-> POST /api/ipr/analyze)
    # ------------------------------------------------------------------
    def analyze_ipr(self, ipr_query: dict) -> dict:
        q = IPRNavigatorQuery(**ipr_query)
        jurisdictions = detect_jurisdiction(f"{q.description} {q.target_market or ''}")
        search_context = f"{q.asset_type} {q.description} patent trademark design PPVFR"
        retrieval = self.retriever.retrieve(query=search_context, top_k=4)

        potential_protection, primary, why_relevant, authority, docs_to_prepare = _ipr_pathways(q)
        confidence = compute_confidence(
            retrieval.top_fused_score,
            len(retrieval.top_chunks),
            validate_citations("", retrieval.citations),
        )

        result = IPRNavigatorResult(
            potential_protection=potential_protection,
            primary_protection=primary,
            why_relevant=why_relevant,
            important_considerations=_ipr_considerations_list(q),
            relevant_authority=authority,
            documents_to_prepare=docs_to_prepare,
            possible_next_steps=[
                "Conduct a prior-art / prior-mark search before filing.",
                "Consult a registered patent agent or trademark attorney for filing strategy.",
            ],
            jurisdiction=jurisdictions,
            sources=retrieval.citations,
            confidence=confidence,
            disclaimer=get_disclaimer(),
        )
        return result.model_dump()

    # ------------------------------------------------------------------
    # 4. Traditional Knowledge / ABS  (-> POST /api/abs/analyze, /api/tk-abs/analyze)
    # ------------------------------------------------------------------
    def analyze_tk_abs(self, tk_query: dict) -> dict:
        q = TKABSQuery(**tk_query)
        resource_name = q.biological_resource or q.plant_material

        # TKDL is restricted and is not available to this deployment. Keep the
        # four supplied demo resources usable from the local RAG corpus, while
        # clearly rejecting arbitrary resources that would require an actual
        # TKDL lookup.
        resource_text = (resource_name or "").strip().lower()
        supported_resources = (
            "withania somnifera",
            "curcuma longa",
            "bacopa monnieri",
            "commiphora mukul",
        )
        if not any(name in resource_text for name in supported_resources):
            raise HTTPException(
                status_code=503,
                detail=(
                    "TKDL access is currently restricted and is not available in this system. "
                    "TK & ABS analysis can currently be demonstrated using the four preset "
                    "biological resources: Withania somnifera (Ashwagandha), Curcuma longa "
                    "(Haridra / Turmeric), Bacopa monnieri (Brahmi), and Commiphora mukul (Guggulu)."
                ),
            )

        search_context = f"Biological Diversity Act NBA ABS Form I Form III {resource_name} {q.geographic_origin}"
        retrieval = self.retriever.retrieve(query=search_context, top_k=4)

        nba_needed = q.intended_use in ("Foreign entity utilization", "IP filing")
        sbb_needed = q.intended_use == "Domestic commercial utilization"

        confidence = compute_confidence(
            retrieval.top_fused_score,
            len(retrieval.top_chunks),
            validate_citations("", retrieval.citations),
        )

        tkdl_result = self.tkdl.check_prior_art(f"{resource_name} {q.traditional_use}")

        result = TKABSResult(
            traditional_knowledge_overview=(
                f"'{resource_name or 'The described resource'}' and its traditional use "
                f"('{q.traditional_use or 'not specified'}') should be checked against TKDL "
                f"and classical-text prior art before any patent filing. {tkdl_result.note}"
            ),
            biological_resource_assessment=(
                f"Sourced from: {q.geographic_origin or 'unspecified origin'}. If this is an "
                "Indian biological resource, Biological Diversity Act, 2002 obligations apply "
                "regardless of the applicant's classification."
            ),
            abs_considerations=ABSConsiderations(
                nba_approval_needed=nba_needed,
                sbb_notification_needed=sbb_needed,
                statutory_sections=["Section 3", "Section 6", "Section 7"],
                benefit_sharing_rate=(
                    "Benefit-sharing rates are notified under NBA guidelines and vary by use "
                    "case — confirm the current rate schedule with the NBA before filing; not "
                    "invented here."
                ),
                exemptions_applicable=(
                    "Registered AYUSH practitioners and certain cultivated/registered medicinal "
                    "plant varieties may qualify for exemptions — verify eligibility with the "
                    "SBB/NBA."
                ),
            ),
            prior_art_tk_considerations=(
                "If the formulation/use matches a classical text or TKDL-recorded prior art, "
                "Section 3(p) of the Patents Act, 1970 bars patentability of that traditional "
                "knowledge as such; only a genuinely novel, non-obvious inventive step over "
                "the traditional knowledge may be patentable."
            ),
            potential_ip_implications=[
                "Patent: likely barred if merely a traditional formulation restated (Section 3(p)).",
                "Trade secret: may protect a novel extraction/process improvement not disclosed in TK.",
                "GI/certification mark: consider if tied to a specific geographic community practice.",
            ],
            recommended_next_steps=[
                "Search TKDL (via authorized access) and classical Ayurvedic texts for prior art.",
                "File Form I/Form III with NBA if biological resource + IPR filing intent applies.",
                "Consult an ABS specialist to confirm current benefit-sharing percentage.",
            ],
            sources=retrieval.citations,
            confidence=confidence,
            disclaimer=get_disclaimer(),
        )
        return result.model_dump()

    # ------------------------------------------------------------------
    # 5. Research / document search  (-> GET /api/research/search, /api/rag/documents)
    # ------------------------------------------------------------------
    def search_documents(
        self,
        query: str = "",
        topic: str | None = None,
        authority: str | None = None,
        document_type: str | None = None,
    ) -> dict:
        """Backs GET /api/research/search (the Research tab's search box +
        filters).

        CHANGED: previously returned a bare list of matching *chunks* —
        the frontend's ResearchView renders a list of *documents* (title,
        summary, official url, chunk_count...), so those chunk dicts were
        being rendered as if they were documents: `doc.summary`/`doc.url`/
        `doc.chunk_count`/`doc.id` are all undefined on a DocumentChunk,
        which is why result cards showed no official link and
        "Inspect Sections" opened nothing. Now returns real DocumentMetadata
        for the matched documents (ranked by their best-matching chunk),
        plus the matching chunks themselves for the "Inspect Sections" panel.
        """
        query = (query or "").strip()
        docs_by_id = {d.id: d for d in self.documents}

        if not query:
            # No search text yet (e.g. initial page load, or a filter-only
            # search) — list everything matching the filters instead of
            # requiring a query to see anything.
            matched_documents = [
                d for d in self.documents if self._document_matches_filters(d, topic, authority, document_type)
            ]
            return {
                "documents": [d.model_dump() for d in matched_documents],
                "matching_chunks": [],
            }

        retrieval = self.retriever.retrieve(query=query, topic_filter=topic, authority_filter=authority, top_k=30)
        matching_chunks = [
            c for c in retrieval.top_chunks if not document_type or c.document_type == document_type
        ]
        # Rank documents by the order their best-matching chunk appears in
        # (retrieval.top_chunks is already best-first), de-duplicated.
        matched_doc_ids = list(dict.fromkeys(c.document_id for c in matching_chunks))
        matched_documents = [docs_by_id[doc_id] for doc_id in matched_doc_ids if doc_id in docs_by_id]

        return {
            "documents": [d.model_dump() for d in matched_documents],
            "matching_chunks": [c.model_dump() for c in matching_chunks],
        }

    @staticmethod
    def _document_matches_filters(
        doc: DocumentMetadata, topic: str | None, authority: str | None, document_type: str | None
    ) -> bool:
        if topic and doc.topic != topic:
            return False
        if authority and authority.lower() not in doc.authority.lower():
            return False
        if document_type and doc.document_type != document_type:
            return False
        return True

    def list_documents(self) -> list[dict]:
        return [d.model_dump() for d in self.documents]

    def get_document(self, document_id: str) -> dict | None:
        for d in self.documents:
            if d.id == document_id:
                chunks = [c for c in self.retriever.chunks if c.document_id == document_id]
                return {"metadata": d.model_dump(), "chunks": [c.model_dump() for c in chunks]}
        return None

    # ------------------------------------------------------------------
    # 6. Telemetry  (-> GET /api/rag/telemetry)
    # ------------------------------------------------------------------
    def get_telemetry(self) -> dict:
        return self.telemetry.model_dump()

    def record_feedback(self, helpful: bool) -> None:
        if helpful:
            self.telemetry.feedback_stats["helpful"] += 1
        else:
            self.telemetry.feedback_stats["unhelpful"] += 1

    def _log_telemetry(self, query: str, latency_ms: int, confidence: ConfidenceMetric, sources_retrieved: int) -> None:
        t = self.telemetry
        t.total_queries += 1
        t.average_retrieval_latency_ms = round((t.average_retrieval_latency_ms + latency_ms) / 2, 1)
        if confidence.level in ("Low", "Insufficient evidence"):
            t.low_confidence_queries_count += 1
        t.recent_logs.insert(
            0,
            TelemetryLogEntry(
                id=f"log-{uuid.uuid4().hex[:8]}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                query=query[:80],
                latency_ms=latency_ms,
                confidence=confidence.level,
                sources_retrieved=sources_retrieved,
            ),
        )
        t.recent_logs = t.recent_logs[:15]


# ---------------------------------------------------------------------------
# Helpers (kept private to this module — no legal facts invented, only
# structural scaffolding filled from retrieved citations)
# ---------------------------------------------------------------------------

def _load_chunks(path) -> list[DocumentChunk]:
    import json

    if not path.exists():
        return []
    chunks = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(DocumentChunk(**json.loads(line)))
    return chunks


def _build_regulatory_considerations(category: str, chunks: list[DocumentChunk]) -> list[RegulatoryConsideration]:
    considerations = []
    for c in chunks[:3]:
        considerations.append(
            RegulatoryConsideration(
                title=f"{c.section} — {c.authority}",
                description=c.chunk_text[:280] + ("..." if len(c.chunk_text) > 280 else ""),
                governing_statute=c.title,
                actionable_requirement=(
                    f"Review {c.section} of {c.title} in full and confirm applicability to a "
                    f"'{category}' product before proceeding."
                ),
            )
        )
    return considerations


def _build_ipr_considerations(category: str, info: ProductInformation, chunks: list[DocumentChunk]) -> IPRConsiderations:
    is_classical = bool(info.classical_reference) or category == "Classical"
    return IPRConsiderations(
        patent_assessment=(
            "Likely limited patentability if the formulation restates a classical text without a "
            "demonstrated inventive/synergistic step (see Section 3(p)/3(e) considerations below)."
            if is_classical
            else "A novel, non-obvious formulation or process may be patentable subject to Section 3(p)/3(e) screening."
        ),
        section_3p_tk_bar=(
            "Section 3(p) bars patenting traditional knowledge as such — check TKDL/classical-text prior art."
        ),
        section_3e_admixture_bar=(
            "Section 3(e) bars a mere admixture of known ingredients without demonstrated synergistic effect — "
            "documented synergy data strengthens patentability."
        ),
        trademark_recommendation="Consider Nice Class 5 (pharmaceutical) or Class 3 (cosmetic) trademark filing for the brand name/logo.",
        industrial_design="Distinctive packaging/bottle/container shapes may qualify for Designs Act, 2000 protection.",
        trade_secret_potential="A proprietary manufacturing process not disclosed publicly may be protectable as a trade secret.",
    )


def _build_tk_abs_flags(info: ProductInformation, chunks: list[DocumentChunk]) -> TKABSFlags:
    risk = "High" if info.classical_reference else ("Medium" if info.biological_source_details else "Low")
    return TKABSFlags(
        tk_prior_art_risk=risk,
        tk_details=(
            f"Classical reference provided ('{info.classical_reference}') — check against TKDL/classical "
            "texts for prior-art bar under Section 3(p)."
            if info.classical_reference
            else "No classical reference provided; confirm the formulation is not substantially similar to known traditional knowledge."
        ),
        biological_resource_status=(
            info.biological_source_details or "Biological source details not provided — required to assess ABS obligations."
        ),
        nba_abs_requirements=(
            "If sourced from an Indian biological resource and intended for IP filing or export, NBA "
            "approval (Form I/III) and benefit-sharing obligations likely apply."
        ),
        form_required="Form I (foreign entities) or Form III (prior approval for IPR) depending on applicant and use.",
    )


def _ipr_pathways(q: IPRNavigatorQuery) -> tuple[list[str], str, str, str, list[str]]:
    asset = q.asset_type.lower()
    if "formulation" in asset or "invention" in asset or "process" in asset:
        return (
            ["Patent", "Trade Secret"],
            "Patent" if q.has_synergistic_data else "Trade Secret",
            "New formulations/processes with demonstrated inventive step and synergy data are "
            "strongest candidates for patent protection; without synergy data, trade secret "
            "protection may be more defensible against a Section 3(e) objection.",
            "Office of the Controller General of Patents, Designs & Trade Marks (CGPDTM)",
            ["Complete specification", "Synergy/efficacy data", "Prior-art search report"],
        )
    if "brand" in asset or "logo" in asset:
        return (
            ["Trademark"],
            "Trademark",
            "Brand names and logos are protectable under the Trade Marks Act, 1999, subject to "
            "distinctiveness (avoiding descriptive bars under Section 9(1)(b)).",
            "Trade Marks Registry",
            ["Trademark search report", "Class 5/Class 3 application (TM-A)"],
        )
    if "packaging" in asset or "design" in asset:
        return (
            ["Industrial Design"],
            "Industrial Design",
            "Distinctive packaging/container geometry is protectable under the Designs Act, 2000.",
            "Designs Office, Kolkata",
            ["Representation sheets", "Novelty statement"],
        )
    if "plant" in asset:
        return (
            ["Plant Variety Protection"],
            "Plant Variety Protection",
            "New plant varieties meeting Novelty, Distinctiveness, Uniformity, Stability (DUS) "
            "criteria are protectable under the PPV&FR Act, 2001.",
            "Protection of Plant Varieties and Farmers' Rights Authority",
            ["DUS test data", "Variety denomination"],
        )
    if "traditional" in asset:
        return (
            ["Defensive publication / TKDL prior-art record"],
            "Defensive publication",
            "Traditional knowledge as such is generally not independently patentable (Section 3(p)) "
            "but can be defensively documented to prevent third-party patenting.",
            "CSIR-TKDL / Ministry of AYUSH",
            ["Documented provenance", "Community consent records"],
        )
    return (
        ["Trade Secret", "Copyright (if creative content)"],
        "Trade Secret",
        "This asset type doesn't map to a standard IP category from the details given — a trade "
        "secret or copyright approach may be most relevant, pending more detail.",
        "N/A — clarify asset type",
        ["Detailed asset description"],
    )


def _ipr_considerations_list(q: IPRNavigatorQuery) -> list[str]:
    considerations = []
    if q.is_classical_text_derived:
        considerations.append("Classical-text-derived formulations face a Section 3(p) traditional-knowledge bar.")
    if q.has_synergistic_data is False:
        considerations.append("Absence of synergy data risks a Section 3(e) mere-admixture objection.")
    if q.is_biological_sourced_india:
        considerations.append("Indian biological sourcing likely triggers NBA/ABS obligations before IPR filing (Section 6).")
    if q.is_already_commercialized:
        considerations.append("Prior commercialization/public disclosure may affect novelty — check disclosure dates against filing timelines.")
    if not considerations:
        considerations.append("Provide more detail (classical basis, synergy data, biological sourcing, commercialization status) for sharper guidance.")
    return considerations
