"""Server-side Bhashini ULCA translation client used by the RAG pipeline."""
from __future__ import annotations

import httpx

from app.config import settings

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
# Bhashini currently documents both the MeitY and AI4Bharat public pipelines.
# Try MeitY first and AI4Bharat if the selected pipeline is unavailable for the
# requested language pair.
_PIPELINE_IDS = (
    "64392f96daac500b55c543cd",
    "643930aa521a4b1ba0f4c41d",
)

_LANG_CODE = {
    "en": "en", "as": "as", "bn": "bn", "brx": "brx", "doi": "doi",
    "gu": "gu", "hi": "hi", "kn": "kn", "ks": "ks", "kok": "kok",
    "mai": "mai", "ml": "ml", "mni": "mni", "mr": "mr", "ne": "ne",
    "or": "or", "pa": "pa", "sa": "sa", "sat": "sat", "sd": "sd",
    "ta": "ta", "te": "te", "ur": "ur",
}


def _language_code(language: str) -> str:
    return _LANG_CODE.get(language, language)


def _extract_error(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            for key in ("message", "error", "errorMessage", "detail"):
                value = data.get(key)
                if value:
                    return str(value)[:500]
    except Exception:
        pass
    body = response.text.strip().replace("\n", " ")
    return body[:500] or "No error body returned."


def _get_pipeline_config(
    client: httpx.Client, source_lang: str, target_lang: str
) -> tuple[str, dict]:
    headers = {
        "userID": (settings.bhashini_user_id or "").strip(),
        "ulcaApiKey": (settings.bhashini_ulca_api_key or settings.bhashini_api_key or "").strip(),
        "Content-Type": "application/json",
    }
    source = _language_code(source_lang)
    target = _language_code(target_lang)
    errors: list[str] = []

    for pipeline_id in _PIPELINE_IDS:
        payload = {
            "pipelineTasks": [{
                "taskType": "translation",
                "config": {"language": {"sourceLanguage": source, "targetLanguage": target}},
            }],
            "pipelineRequestConfig": {"pipelineId": pipeline_id},
        }
        response = client.post(_CONFIG_URL, headers=headers, json=payload)
        if response.is_error:
            errors.append(f"pipeline {pipeline_id}: HTTP {response.status_code}: {_extract_error(response)}")
            continue

        data = response.json()
        endpoint = data.get("pipelineInferenceAPIEndPoint") or {}
        configs = data.get("pipelineResponseConfig") or []
        translation_configs = []
        for task in configs:
            for config in task.get("config", []):
                language = config.get("language", {})
                if (
                    config.get("serviceId")
                    and language.get("sourceLanguage") == source
                    and language.get("targetLanguage") == target
                ):
                    translation_configs.append(config)

        # Some valid responses omit language metadata. In that case, the first
        # service config for the translation task is the service to use.
        if not translation_configs:
            for task in configs:
                for config in task.get("config", []):
                    if config.get("serviceId"):
                        translation_configs.append(config)

        if translation_configs:
            return endpoint.get("callbackUrl") or _DEFAULT_INFERENCE_URL, {
                "service_id": translation_configs[0]["serviceId"],
                "inference_key": endpoint.get("inferenceApiKey") or {},
                "pipeline_id": pipeline_id,
            }

        errors.append(f"pipeline {pipeline_id}: no translation service for {source_lang}->{target_lang}")

    raise RuntimeError("Bhashini pipeline configuration failed: " + " | ".join(errors))


def _translate_batch(
    client: httpx.Client, texts: list[str], source_lang: str, target_lang: str
) -> list[str]:
    if not texts or source_lang == target_lang:
        return texts

    compute_url, config = _get_pipeline_config(client, source_lang, target_lang)
    inference_key = config.get("inference_key") or {}
    compute_headers = {"Content-Type": "application/json"}
    if settings.bhashini_inference_api_key:
        compute_headers["Authorization"] = settings.bhashini_inference_api_key.strip()
    elif inference_key.get("name") and inference_key.get("value"):
        compute_headers[inference_key["name"]] = inference_key["value"]
    else:
        raise RuntimeError("Bhashini inference API key is not configured.")

    payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {
                "language": {
                    "sourceLanguage": _language_code(source_lang),
                    "targetLanguage": _language_code(target_lang),
                },
                "serviceId": config["service_id"],
            },
        }],
        "inputData": {"input": [{"source": text} for text in texts]},
    }
    response = client.post(compute_url, headers=compute_headers, json=payload)
    if response.is_error:
        raise RuntimeError(
            f"Bhashini inference failed: HTTP {response.status_code}: {_extract_error(response)}"
        )
    outputs = response.json().get("pipelineResponse", [{}])[0].get("output", [])
    if len(outputs) != len(texts):
        raise RuntimeError("Bhashini returned an unexpected number of translations.")
    return [item["target"] for item in outputs]


def bhashini_translate(text: str, source_lang: str, target_lang: str, timeout: float = 30.0) -> str:
    if not text or source_lang == target_lang:
        return text
    if not settings.bhashini_user_id or not (settings.bhashini_ulca_api_key or settings.bhashini_api_key):
        raise RuntimeError("BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY are not configured.")
    with httpx.Client(timeout=timeout) as client:
        return _translate_batch(client, [text], source_lang, target_lang)[0]


def bhashini_translate_many(texts: list[str], source_lang: str, target_lang: str, timeout: float = 30.0) -> list[str]:
    if not texts or source_lang == target_lang:
        return texts
    if not settings.bhashini_user_id or not (settings.bhashini_ulca_api_key or settings.bhashini_api_key):
        raise RuntimeError("BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY are not configured.")
    with httpx.Client(timeout=timeout) as client:
        return _translate_batch(client, texts, source_lang, target_lang)
