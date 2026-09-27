"""Server-side Bhashini ULCA translation client used by the RAG pipeline."""
from __future__ import annotations

import httpx

from app.config import settings

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
_PIPELINE_ID = "64392f96daac500b55c543cd"

# Bhashini uses ISO-639 language codes for the pipeline configuration.
_LANG_CODE = {
    "en": "en", "as": "as", "bn": "bn", "brx": "brx", "doi": "doi",
    "gu": "gu", "hi": "hi", "kn": "kn", "ks": "ks", "kok": "kok",
    "mai": "mai", "ml": "ml", "mni": "mni", "mr": "mr", "ne": "ne",
    "or": "or", "pa": "pa", "sa": "sa", "sat": "sat", "sd": "sd",
    "ta": "ta", "te": "te", "ur": "ur",
}


def _language_code(language: str) -> str:
    return _LANG_CODE.get(language, language)


def _get_pipeline_config(client: httpx.Client, source_lang: str, target_lang: str) -> tuple[str, dict]:
    headers = {
        "userID": settings.bhashini_user_id or "",
        "ulcaApiKey": settings.bhashini_ulca_api_key or settings.bhashini_api_key or "",
        "Content-Type": "application/json",
    }
    payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {
                "language": {
                    "sourceLanguage": _language_code(source_lang),
                    "targetLanguage": _language_code(target_lang),
                }
            },
        }],
        "pipelineRequestConfig": {"pipelineId": _PIPELINE_ID},
    }
    response = client.post(_CONFIG_URL, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    endpoint = data["pipelineInferenceAPIEndPoint"]
    configs = data["pipelineResponseConfig"]
    translation_configs = []
    for task in configs:
        for config in task.get("config", []):
            language = config.get("language", {})
            if (
                config.get("serviceId")
                and language.get("sourceLanguage") == _language_code(source_lang)
                and language.get("targetLanguage") == _language_code(target_lang)
            ):
                translation_configs.append(config)
    if not translation_configs:
        # Some Bhashini responses omit language metadata after filtering.
        for task in configs:
            for config in task.get("config", []):
                if config.get("serviceId"):
                    translation_configs.append(config)
    if not translation_configs:
        raise RuntimeError(f"Bhashini returned no translation service for {source_lang}->{target_lang}.")
    return endpoint.get("callbackUrl") or _DEFAULT_INFERENCE_URL, {
        "service_id": translation_configs[0]["serviceId"],
        "inference_key": endpoint.get("inferenceApiKey") or {},
    }


def _translate_batch(client: httpx.Client, texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    if not texts or source_lang == target_lang:
        return texts
    compute_url, config = _get_pipeline_config(client, source_lang, target_lang)
    inference_key = config.get("inference_key") or {}
    compute_headers = {"Content-Type": "application/json"}
    if settings.bhashini_inference_api_key:
        compute_headers["Authorization"] = settings.bhashini_inference_api_key
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
    response.raise_for_status()
    outputs = response.json()["pipelineResponse"][0]["output"]
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
