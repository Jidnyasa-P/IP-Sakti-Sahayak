"""
Multilingual / translation abstraction (Section 19).

DictionaryProvider (DEMO MODE fallback): the curated Hindi/Marathi statutory
terminology dictionaries ported verbatim from the existing frontend project
(src/context/translations.ts -> backend/data/translations.json). Covers UI
string translation instantly and offline.

BhashiniProvider: a real HTTP client against the Bhashini ULCA pipeline
compute API. Credentials are kept server-side and use BHASHINI_USER_ID,
BHASHINI_ULCA_API_KEY and BHASHINI_INFERENCE_API_KEY.

The provider is swappable via TRANSLATION_PROVIDER so no single vendor is
hard-coded into the rest of the app (Section 19: "must be replaceable").
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
BHASHINI_PIPELINE_IDS = (
    "64392f96daac500b55c543cd",
    "643930aa521a4b1ba0f4c41d",
)


def _load_dictionaries() -> dict:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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
        # No general-purpose MT offline; return the source text with a clear label
        # rather than fabricating a translation.
        return text, "demo_mode_no_translation_available"

    async def translate_strings(self, strings: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
        lookup = self._dict_for(target_language)
        translated = {k: lookup.get(k, v) for k, v in strings.items()}
        return translated, "demo_mode_curated_dictionary"


class BhashiniProvider(TranslationProvider):
    def __init__(self, user_id: str, ulca_key: str, inference_api_key: str):
        self.user_id = user_id.strip()
        self.ulca_key = ulca_key.strip()
        self.inference_api_key = inference_api_key.strip()

    @staticmethod
    def _error_text(resp: httpx.Response) -> str:
        try:
            data = resp.json()
            if isinstance(data, dict):
                for key in ("message", "error", "errorMessage", "detail"):
                    if data.get(key):
                        return str(data[key])[:500]
        except Exception:
            pass
        return resp.text.strip().replace("\n", " ")[:500] or "No error body returned."

    async def _call_pipeline(self, texts: list[str], target_language: str) -> list[str] | None:
        if not texts or target_language == "en":
            return texts

        headers = {
            "userID": self.user_id,
            "ulcaApiKey": self.ulca_key,
            "Content-Type": "application/json",
        }
        source = "en"
        errors: list[str] = []

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                config = None
                for pipeline_id in BHASHINI_PIPELINE_IDS:
                    payload = {
                        "pipelineTasks": [{
                            "taskType": "translation",
                            "config": {"language": {"sourceLanguage": source, "targetLanguage": target_language}},
                        }],
                        "pipelineRequestConfig": {"pipelineId": pipeline_id},
                    }
                    resp = await client.post(BHASHINI_CONFIG_ENDPOINT, json=payload, headers=headers)
                    if resp.is_error:
                        errors.append(
                            f"pipeline {pipeline_id}: HTTP {resp.status_code}: {self._error_text(resp)}"
                        )
                        continue
                    config = resp.json()
                    break

                if config is None:
                    raise RuntimeError("Bhashini pipeline configuration failed: " + " | ".join(errors))

                endpoint = config.get("pipelineInferenceAPIEndPoint") or {}
                configs = config.get("pipelineResponseConfig") or []
                service_id = None
                for task in configs:
                    for item in task.get("config", []):
                        lang = item.get("language", {})
                        if item.get("serviceId") and (
                            not lang
                            or (lang.get("sourceLanguage") == source and lang.get("targetLanguage") == target_language)
                        ):
                            service_id = item["serviceId"]
                            break
                    if service_id:
                        break
                if not service_id:
                    raise RuntimeError("Bhashini returned no translation service for en->" + target_language)

                compute_headers = {"Content-Type": "application/json"}
                inference_key = endpoint.get("inferenceApiKey") or {}
                if self.inference_api_key:
                    compute_headers["Authorization"] = self.inference_api_key
                elif inference_key.get("name") and inference_key.get("value"):
                    compute_headers[inference_key["name"]] = inference_key["value"]
                else:
                    raise RuntimeError("Bhashini inference API key is not configured.")

                payload = {
                    "pipelineTasks": [{
                        "taskType": "translation",
                        "config": {
                            "language": {"sourceLanguage": source, "targetLanguage": target_language},
                            "serviceId": service_id,
                        },
                    }],
                    "inputData": {"input": [{"source": t} for t in texts]},
                }
                compute_url = endpoint.get("callbackUrl") or BHASHINI_PIPELINE_ENDPOINT
                resp = await client.post(compute_url, json=payload, headers=compute_headers)
                if resp.is_error:
                    raise RuntimeError(
                        f"Bhashini inference failed: HTTP {resp.status_code}: {self._error_text(resp)}"
                    )
                outputs = resp.json().get("pipelineResponse", [{}])[0].get("output", [])
                if len(outputs) != len(texts):
                    raise RuntimeError("Bhashini returned an unexpected number of translations.")
                return [o["target"] for o in outputs]
        except Exception as exc:
            logger.warning(f"Bhashini call failed: {exc}. Falling back to dictionary provider.")
            return None

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
            _provider = BhashiniProvider(settings.bhashini_user_id, settings.bhashini_ulca_api_key, settings.bhashini_inference_api_key)
            logger.info("Translation provider: Bhashini (live credentials configured).")
        else:
            _provider = DictionaryProvider()
    return _provider
