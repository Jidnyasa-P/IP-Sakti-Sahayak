"""BHASHINI/ULCA neural machine translation client.

The client resolves the translation service for each requested language pair
and then calls the returned inference endpoint. Credentials are read only
from the RAG service environment.
"""
from __future__ import annotations

import httpx

from app.config import settings

_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
_DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"

_LANG_CODE = {
    "en": "en", "as": "as", "bn": "bn", "brx": "brx", "doi": "doi",
    "gu": "gu", "hi": "hi", "kn": "kn", "ks": "ks", "kok": "kok",
    "mai": "mai", "ml": "ml", "mni": "mni", "mr": "mr", "ne": "ne",
    "or": "or", "pa": "pa", "sa": "sa", "sat": "sat", "sd": "sd",
    "ta": "ta", "te": "te", "ur": "ur",
}


def _normalise_inference_key(value: str) -> str:
    value = (value or "").strip()
    return value[7:].strip() if value.lower().startswith("bearer ") else value


def bhashini_translate_many(
    texts: list[str],
    source_lang: str,
    target_lang: str,
    timeout: float = 20.0,
) -> list[str]:
    if not texts or source_lang == target_lang:
        return list(texts)

    if source_lang not in _LANG_CODE or target_lang not in _LANG_CODE:
        raise ValueError(f"Unsupported BHASHINI language pair: {source_lang}->{target_lang}")

    user_id = (settings.bhashini_user_id or "").strip()
    ulca_key = (settings.bhashini_ulca_api_key or "").strip()
    inference_key = _normalise_inference_key(settings.bhashini_inference_api_key or "")
    if not user_id or not ulca_key or not inference_key:
        raise RuntimeError("BHASHINI_USER_ID, BHASHINI_ULCA_API_KEY and BHASHINI_INFERENCE_API_KEY are required.")

    config_headers = {
        "userID": user_id,
        "ulcaApiKey": ulca_key,
        "Content-Type": "application/json",
    }
    config_payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {
                "language": {
                    "sourceLanguage": _LANG_CODE[source_lang],
                    "targetLanguage": _LANG_CODE[target_lang],
                }
            },
        }]
    }

    with httpx.Client(timeout=timeout) as client:
        config_resp = client.post(_CONFIG_URL, headers=config_headers, json=config_payload)
        config_resp.raise_for_status()
        config = config_resp.json()

        endpoint = config.get("pipelineInferenceAPIEndPoint") or {}
        callback_url = endpoint.get("callbackUrl") or _DEFAULT_INFERENCE_URL
        returned_key = endpoint.get("inferenceApiKey") or {}
        returned_value = returned_key.get("value") if isinstance(returned_key, dict) else None
        if returned_value:
            inference_key = _normalise_inference_key(str(returned_value))

        response_configs = config.get("pipelineResponseConfig") or []
        service_id = None
        for response_group in response_configs:
            for service_config in response_group.get("config") or []:
                lang = service_config.get("language") or {}
                if (
                    lang.get("sourceLanguage") == _LANG_CODE[source_lang]
                    and lang.get("targetLanguage") == _LANG_CODE[target_lang]
                    and service_config.get("serviceId")
                ):
                    service_id = service_config["serviceId"]
                    break
            if service_id:
                break
        if not service_id:
            raise RuntimeError("BHASHINI returned no translation service for the requested language pair.")

        compute_payload = {
            "pipelineTasks": [{
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": _LANG_CODE[source_lang],
                        "targetLanguage": _LANG_CODE[target_lang],
                    },
                    "serviceId": service_id,
                },
            }],
            "inputData": {"input": [{"source": text} for text in texts]},
        }
        compute_resp = client.post(
            callback_url,
            headers={"Authorization": inference_key, "Content-Type": "application/json"},
            json=compute_payload,
        )
        compute_resp.raise_for_status()
        outputs = compute_resp.json()["pipelineResponse"][0]["output"]
        translated = [item["target"] for item in outputs]
        if len(translated) != len(texts):
            raise RuntimeError("BHASHINI returned an unexpected number of translated outputs.")
        return translated


def bhashini_translate(text: str, source_lang: str, target_lang: str, timeout: float = 20.0) -> str:
    return bhashini_translate_many([text], source_lang, target_lang, timeout=timeout)[0]
