"""Bhashini translation client for the current Udyat credentials.

The Udyat dashboard exposes two relevant credentials:
- UDYAT KEY: used as ``ulcaApiKey`` for pipeline configuration.
- INFERENCE: used as ``Authorization`` for the translation compute call.

The normal path negotiates a translation service through Bhashini's pipeline
configuration endpoint. A direct inference fallback is retained so the RAG
service can still translate when the configuration endpoint is unavailable.
"""
from __future__ import annotations

import httpx

from app.config import settings

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
_PIPELINE_ID = "64392f96daac500b55c543cd"
_DIRECT_SERVICE_ID = "ai4bharat/indictrans-v2-all-gpu--t4"

_LANG_CODE = {
    "en": "en", "as": "as", "bn": "bn", "brx": "brx", "doi": "doi",
    "gu": "gu", "hi": "hi", "kn": "kn", "ks": "ks", "kok": "kok",
    "mai": "mai", "ml": "ml", "mni": "mni", "mr": "mr", "ne": "ne",
    "or": "or", "pa": "pa", "sa": "sa", "sat": "sat", "sd": "sd",
    "ta": "ta", "te": "te", "ur": "ur",
}


def _language_code(language: str) -> str:
    return _LANG_CODE.get(language, language)


def _error_text(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            for key in ("message", "error", "errorMessage", "detail"):
                if data.get(key):
                    return str(data[key])[:500]
    except Exception:
        pass
    body = response.text.strip().replace("\n", " ")
    return body[:500] or "No error body returned."


def _udyat_key() -> str:
    return (
        (settings.bhashini_udyat_api_key or "").strip()
        or (settings.bhashini_ulca_api_key or "").strip()
    )


def _inference_key() -> str:
    return (settings.bhashini_inference_api_key or "").strip()


def _get_pipeline_config(
    client: httpx.Client, source_lang: str, target_lang: str
) -> tuple[str, str]:
    udyat_key = _udyat_key()
    if not settings.bhashini_user_id or not udyat_key:
        raise RuntimeError(
            "BHASHINI_USER_ID and BHASHINI_UDYAT_API_KEY are required "
            "for pipeline configuration."
        )

    headers = {
        "userID": settings.bhashini_user_id.strip(),
        "ulcaApiKey": udyat_key,
        "Content-Type": "application/json",
    }
    source = _language_code(source_lang)
    target = _language_code(target_lang)
    payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {"language": {"sourceLanguage": source, "targetLanguage": target}},
        }],
        "pipelineRequestConfig": {"pipelineId": _PIPELINE_ID},
    }

    response = client.post(_CONFIG_URL, headers=headers, json=payload)
    if response.is_error:
        raise RuntimeError(
            f"Bhashini pipeline configuration failed: HTTP {response.status_code}: {_error_text(response)}"
        )

    data = response.json()
    configs = data.get("pipelineResponseConfig") or []
    for task in configs:
        if task.get("taskType") != "translation":
            continue
        for item in task.get("config", []):
            language = item.get("language") or {}
            if item.get("serviceId") and (
                not language
                or (
                    language.get("sourceLanguage") == source
                    and language.get("targetLanguage") == target
                )
            ):
                endpoint = data.get("pipelineInferenceAPIEndPoint") or {}
                return (
                    endpoint.get("callbackUrl") or _INFERENCE_URL,
                    item["serviceId"],
                )

    raise RuntimeError(
        f"Bhashini returned no translation service for {source_lang}->{target_lang}."
    )


def _translate_with_service(
    client: httpx.Client,
    texts: list[str],
    source_lang: str,
    target_lang: str,
    service_id: str,
    compute_url: str = _INFERENCE_URL,
) -> list[str]:
    inference_key = _inference_key()
    if not inference_key:
        raise RuntimeError("BHASHINI_INFERENCE_API_KEY is not configured.")

    payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {
                "language": {
                    "sourceLanguage": _language_code(source_lang),
                    "targetLanguage": _language_code(target_lang),
                },
                "serviceId": service_id,
            },
        }],
        "inputData": {"input": [{"source": text} for text in texts]},
    }
    headers = {
        "Authorization": inference_key,
        "Content-Type": "application/json",
        "Accept": "*/*",
    }
    response = client.post(compute_url, headers=headers, json=payload)
    if response.is_error:
        raise RuntimeError(
            f"Bhashini inference failed: HTTP {response.status_code}: {_error_text(response)}"
        )

    outputs = response.json().get("pipelineResponse", [{}])[0].get("output", [])
    if len(outputs) != len(texts):
        raise RuntimeError("Bhashini returned an unexpected number of translations.")
    return [item["target"] for item in outputs]


def _translate_batch(
    client: httpx.Client, texts: list[str], source_lang: str, target_lang: str
) -> list[str]:
    if not texts or source_lang == target_lang:
        return texts

    config_error: Exception | None = None
    if _udyat_key() and settings.bhashini_user_id:
        try:
            compute_url, service_id = _get_pipeline_config(
                client, source_lang, target_lang
            )
            return _translate_with_service(
                client, texts, source_lang, target_lang, service_id, compute_url
            )
        except Exception as exc:
            config_error = exc

    # Current Bhashini inference documentation authenticates the compute call
    # directly with the INFERENCE key. This fallback avoids depending on the
    # older ULCA/Udyat configuration handshake when it is unavailable.
    try:
        return _translate_with_service(
            client,
            texts,
            source_lang,
            target_lang,
            _DIRECT_SERVICE_ID,
        )
    except Exception as direct_error:
        if config_error:
            raise RuntimeError(
                f"{config_error}; direct inference fallback also failed: {direct_error}"
            ) from direct_error
        raise


def bhashini_translate(
    text: str,
    source_lang: str,
    target_lang: str,
    timeout: float = 30.0,
) -> str:
    if not text or source_lang == target_lang:
        return text
    if not _inference_key():
        raise RuntimeError("BHASHINI_INFERENCE_API_KEY is not configured.")
    with httpx.Client(timeout=timeout) as client:
        return _translate_batch(client, [text], source_lang, target_lang)[0]


def bhashini_translate_many(
    texts: list[str],
    source_lang: str,
    target_lang: str,
    timeout: float = 30.0,
) -> list[str]:
    if not texts or source_lang == target_lang:
        return texts
    if not _inference_key():
        raise RuntimeError("BHASHINI_INFERENCE_API_KEY is not configured.")
    with httpx.Client(timeout=timeout) as client:
        return _translate_batch(client, texts, source_lang, target_lang)
