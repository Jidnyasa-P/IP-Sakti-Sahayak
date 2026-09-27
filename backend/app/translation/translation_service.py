"""
Multilingual / translation abstraction (Section 19).

BhashiniProvider uses the current BHASHINI-Udyat credential pair:
- BHASHINI_UDYAT_API_KEY for pipeline configuration
- BHASHINI_INFERENCE_API_KEY for the inference call

BHASHINI_ULCA_API_KEY remains accepted as a legacy environment-variable alias.
"""
import json
import os
from abc import ABC, abstractmethod

import httpx

from app.core.config import get_settings
from app.core.logging import logger

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "translations.json")

BHASHINI_PIPELINE_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
BHASHINI_CONFIG_ENDPOINT = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
BHASHINI_PIPELINE_ID = "64392f96daac500b55c543cd"
BHASHINI_DIRECT_SERVICE_ID = "ai4bharat/indictrans-v2-all-gpu--t4"


def _load_dictionaries() -> dict:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _error_text(response: httpx.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            for key in ("message", "error", "errorMessage", "detail"):
                if data.get(key):
                    return str(data[key])[:500]
    except Exception:
        pass
    return response.text.strip().replace("\n", " ")[:500] or "No error body returned."


class TranslationProvider(ABC):
    @abstractmethod
    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        """Returns (translated_text, source_label)."""

    @abstractmethod
    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        ...


class DictionaryProvider(TranslationProvider):
    """DEMO MODE: curated static dictionaries, no network calls."""

    def __init__(self):
        self._dicts = _load_dictionaries()

    def _dict_for(self, target_language: str) -> dict[str, str]:
        if target_language == "hi":
            return self._dicts.get("HINDI_STATUTORY_DICTIONARY", {})
        if target_language == "mr":
            return self._dicts.get("MARATHI_STATUTORY_DICTIONARY", {})
        return {}

    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        return text, "demo_mode_no_translation_available"

    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        lookup = self._dict_for(target_language)
        translated = {k: lookup.get(k, v) for k, v in strings.items()}
        return translated, "demo_mode_curated_dictionary"


class BhashiniProvider(TranslationProvider):
    def __init__(self, user_id: str, udyat_key: str, inference_api_key: str):
        self.user_id = user_id.strip()
        self.udyat_key = udyat_key.strip()
        self.inference_api_key = inference_api_key.strip()

    async def _call_pipeline(self, texts: list[str], target_language: str) -> list[str] | None:
        if not texts or target_language == "en":
            return texts

        source = "en"
        config_error: Exception | None = None

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                if self.user_id and self.udyat_key:
                    config_headers = {
                        "userID": self.user_id,
                        "ulcaApiKey": self.udyat_key,
                        "Content-Type": "application/json",
                    }
                    config_payload = {
                        "pipelineTasks": [{
                            "taskType": "translation",
                            "config": {"language": {"sourceLanguage": source, "targetLanguage": target_language}},
                        }],
                        "pipelineRequestConfig": {"pipelineId": BHASHINI_PIPELINE_ID},
                    }
                    resp = await client.post(
                        BHASHINI_CONFIG_ENDPOINT,
                        json=config_payload,
                        headers=config_headers,
                    )
                    if not resp.is_error:
                        data = resp.json()
                        endpoint = data.get("pipelineInferenceAPIEndPoint") or {}
                        service_id = None
                        for task in data.get("pipelineResponseConfig") or []:
                            if task.get("taskType") != "translation":
                                continue
                            for item in task.get("config", []):
                                language = item.get("language") or {}
                                if item.get("serviceId") and (
                                    not language
                                    or (
                                        language.get("sourceLanguage") == source
                                        and language.get("targetLanguage") == target_language
                                    )
                                ):
                                    service_id = item["serviceId"]
                                    break
                            if service_id:
                                break
                        if service_id:
                            compute_url = endpoint.get("callbackUrl") or BHASHINI_PIPELINE_ENDPOINT
                            return await self._compute(
                                client, texts, source, target_language, service_id, compute_url
                            )
                        config_error = RuntimeError(
                            f"Bhashini returned no translation service for en->{target_language}."
                        )
                    else:
                        config_error = RuntimeError(
                            f"Bhashini pipeline configuration failed: HTTP {resp.status_code}: {_error_text(resp)}"
                        )

                # Direct inference path uses the INFERENCE key from Udyat.
                return await self._compute(
                    client,
                    texts,
                    source,
                    target_language,
                    BHASHINI_DIRECT_SERVICE_ID,
                    BHASHINI_PIPELINE_ENDPOINT,
                )
        except Exception as exc:
            if config_error:
                logger.warning(
                    f"Bhashini call failed: {config_error}; direct inference fallback failed: {exc}. "
                    "Falling back to dictionary provider."
                )
            else:
                logger.warning(
                    f"Bhashini call failed: {exc}. Falling back to dictionary provider."
                )
            return None

    async def _compute(
        self,
        client: httpx.AsyncClient,
        texts: list[str],
        source: str,
        target: str,
        service_id: str,
        compute_url: str,
    ) -> list[str]:
        if not self.inference_api_key:
            raise RuntimeError("BHASHINI_INFERENCE_API_KEY is not configured.")
        payload = {
            "pipelineTasks": [{
                "taskType": "translation",
                "config": {
                    "language": {"sourceLanguage": source, "targetLanguage": target},
                    "serviceId": service_id,
                },
            }],
            "inputData": {"input": [{"source": text} for text in texts]},
        }
        headers = {
            "Authorization": self.inference_api_key,
            "Content-Type": "application/json",
            "Accept": "*/*",
        }
        resp = await client.post(compute_url, json=payload, headers=headers)
        if resp.is_error:
            raise RuntimeError(
                f"Bhashini inference failed: HTTP {resp.status_code}: {_error_text(resp)}"
            )
        outputs = resp.json().get("pipelineResponse", [{}])[0].get("output", [])
        if len(outputs) != len(texts):
            raise RuntimeError("Bhashini returned an unexpected number of translations.")
        return [item["target"] for item in outputs]

    async def translate_text(self, text: str, target_language: str) -> tuple[str, str]:
        result = await self._call_pipeline([text], target_language)
        if result:
            return result[0], "bhashini_live"
        translated, source = await DictionaryProvider().translate_text(text, target_language)
        return translated, source

    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        keys = list(strings.keys())
        values = [strings[k] for k in keys]
        result = await self._call_pipeline(values, target_language)
        if result:
            return dict(zip(keys, result)), "bhashini_live"
        return await DictionaryProvider().translate_strings(strings, target_language)


_provider: TranslationProvider | None = None


def get_translation_provider() -> TranslationProvider:
    global _provider
    if _provider is None:
        settings = get_settings()
        if settings.translation_provider == "bhashini" and settings.bhashini_configured:
            udyat_key = settings.bhashini_udyat_api_key or settings.bhashini_ulca_api_key
            _provider = BhashiniProvider(
                settings.bhashini_user_id,
                udyat_key,
                settings.bhashini_inference_api_key,
            )
            logger.info("Translation provider: Bhashini (Udyat credentials configured).")
        else:
            _provider = DictionaryProvider()
    return _provider
