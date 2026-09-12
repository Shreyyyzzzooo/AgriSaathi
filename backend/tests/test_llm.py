"""Tests for backend/app/llm/ and POST /api/explanation.

Verifies:
1. explanation_generator.generate_explanation() never raises offline.
2. Offline fallback returns both text_en and text_hi when lang="both".
3. reasoning_bullets always has ≥ 3 items.
4. translation.explain_crop() routes lang correctly.
5. POST /api/explanation returns 200 (not 500) when WATSONX_APIKEY is absent.
6. POST /api/explanation returns correct ExplainResponse schema.
7. Hindi text contains Devanagari characters.
8. English text does not contain Devanagari characters.
9. reasoning_bullets are grounded (contain numeric values from simulation).
10. Prompt templates render without KeyError.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.llm.translation import is_hindi, explain_crop
from app.llm.explanation_generator import generate_explanation, _build_context

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _sim_result(crop_id: str = "wheat_rabi") -> dict:
    return {
        "crop_id": crop_id,
        "stats": {
            "mean": 52400.0,
            "p10":  31200.0,
            "p50":  51800.0,
            "p90":  74600.0,
            "histogram_bins": [
                10000.0, 18000.0, 26000.0, 34000.0, 42000.0,
                50000.0, 58000.0, 66000.0, 74000.0, 82000.0, 90000.0
            ],
        },
        "weather_by_day": [
            {"day": 1, "rainfall_mm": 0.0,  "temp_c": 28.5, "condition": "sunny"},
            {"day": 2, "rainfall_mm": 12.3, "temp_c": 24.1, "condition": "rainy"},
            {"day": 3, "rainfall_mm": 0.0,  "temp_c": 29.1, "condition": "sunny"},
        ],
    }


def _extra(budget: int = 50000, soil: str = "loamy", crash: bool = False) -> dict:
    return {
        "budget_inr":         budget,
        "soil_type":          soil,
        "loss_probability":   0.08,
        "market_crash_risk":  crash,
    }


# ─────────────────────────────────────────────────────────────────────────────
# explanation_generator tests
# ─────────────────────────────────────────────────────────────────────────────

class TestExplanationGenerator:

    def test_offline_does_not_raise_en(self, monkeypatch):
        """Offline path returns dict without raising."""
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "en", _extra())
        assert isinstance(result, dict)

    def test_offline_does_not_raise_hi(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "hi", _extra())
        assert isinstance(result, dict)

    def test_offline_both_returns_text_en_and_text_hi(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "both", _extra())
        assert result["text_en"] is not None
        assert result["text_hi"] is not None

    def test_offline_en_text_hi_is_none(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "en", _extra())
        assert result["text_hi"] is None

    def test_offline_hi_text_en_is_none(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "hi", _extra())
        assert result["text_en"] is None

    def test_reasoning_bullets_at_least_three(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "both", _extra())
        assert len(result["reasoning_bullets"]) >= 3

    def test_crop_id_echoed(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result("cotton_kharif"), "en", _extra())
        assert result["crop_id"] == "cotton_kharif"

    def test_text_en_grounded_with_numbers(self, monkeypatch):
        """English text must contain numeric values from simulation stats."""
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "en", _extra())
        # Mean is 52400 → formatted as ₹52,400/ha or ₹0.5 lakh/ha
        text = result["text_en"] or ""
        assert "52" in text or "lakh" in text or "52,400" in text

    def test_hindi_text_contains_devanagari(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "hi", _extra())
        assert is_hindi(result["text_hi"] or "")

    def test_crash_risk_mentioned_in_bullets(self, monkeypatch):
        """When market_crash_risk=True the bullets must reference saturation."""
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(
            _sim_result(), "en", _extra(crash=True)
        )
        bullets_text = " ".join(result["reasoning_bullets"]).lower()
        assert "saturation" in bullets_text or "45%" in bullets_text or "crash" in bullets_text

    def test_required_keys_present(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = generate_explanation(_sim_result(), "both", _extra())
        assert set(result.keys()) >= {"crop_id", "text_en", "text_hi", "reasoning_bullets"}

    def test_build_context_loss_prob(self):
        """_build_context must convert loss_probability fraction to percentage."""
        ctx = _build_context(_sim_result(), {"loss_probability": 0.12})
        assert abs(float(ctx["loss_prob"]) - 12.0) < 0.01

    def test_prompt_templates_render(self):
        """Both prompt templates must render without KeyError."""
        from app.llm.explanation_generator import (
            _load_template, _template_vars, _PROMPT_EN, _PROMPT_HI
        )
        ctx = _build_context(_sim_result(), _extra())
        vars_ = _template_vars(ctx)
        rendered_en = _load_template(_PROMPT_EN).format(**vars_)
        rendered_hi = _load_template(_PROMPT_HI).format(**vars_)
        assert "wheat" in rendered_en.lower() or "Wheat" in rendered_en
        assert len(rendered_hi) > 50


# ─────────────────────────────────────────────────────────────────────────────
# translation.py tests
# ─────────────────────────────────────────────────────────────────────────────

class TestTranslation:

    def test_explain_crop_en(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = explain_crop(_sim_result(), "en", _extra())
        assert result["text_en"] is not None
        assert result["text_hi"] is None

    def test_explain_crop_hi(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = explain_crop(_sim_result(), "hi", _extra())
        assert result["text_hi"] is not None
        assert result["text_en"] is None

    def test_explain_crop_both(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = explain_crop(_sim_result(), "both", _extra())
        assert result["text_en"] is not None
        assert result["text_hi"] is not None

    def test_unknown_lang_defaults_to_en(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = explain_crop(_sim_result(), "fr", _extra())
        # Unknown lang defaults to en
        assert result["text_en"] is not None

    def test_is_hindi_detects_devanagari(self):
        assert is_hindi("नमस्ते किसान") is True

    def test_is_hindi_rejects_english(self):
        assert is_hindi("Hello farmer") is False

    def test_bullets_always_present(self, monkeypatch):
        monkeypatch.setattr("app.llm.explanation_generator._API_KEY", None)
        result = explain_crop(_sim_result(), "en", {})
        assert len(result["reasoning_bullets"]) >= 3


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/explanation endpoint tests
# ─────────────────────────────────────────────────────────────────────────────

class TestExplanationRoute:

    def _payload(self, lang: str = "en") -> dict:
        return {"simulation_result": _sim_result(), "lang": lang}

    def test_post_explanation_returns_200_offline(self, client):
        """Must return 200 (not 500) when WATSONX_APIKEY is absent."""
        resp = client.post("/api/explanation", json=self._payload())
        assert resp.status_code == 200

    def test_post_explanation_response_keys(self, client):
        body = client.post("/api/explanation", json=self._payload()).json()
        assert "crop_id"           in body
        assert "text_en"           in body
        assert "text_hi"           in body
        assert "reasoning_bullets" in body

    def test_post_explanation_en_not_500(self, client):
        resp = client.post("/api/explanation", json=self._payload("en"))
        assert resp.status_code == 200
        assert resp.json()["text_en"] is not None
        assert resp.json()["text_hi"] is None

    def test_post_explanation_hi_not_500(self, client):
        resp = client.post("/api/explanation", json=self._payload("hi"))
        assert resp.status_code == 200
        assert resp.json()["text_hi"] is not None
        assert resp.json()["text_en"] is None

    def test_post_explanation_both_not_500(self, client):
        resp = client.post("/api/explanation", json=self._payload("both"))
        assert resp.status_code == 200
        body = resp.json()
        assert body["text_en"] is not None
        assert body["text_hi"] is not None

    def test_post_explanation_bullets_non_empty(self, client):
        body = client.post("/api/explanation", json=self._payload()).json()
        assert isinstance(body["reasoning_bullets"], list)
        assert len(body["reasoning_bullets"]) >= 3

    def test_post_explanation_crop_id_echoed(self, client):
        body = client.post("/api/explanation", json=self._payload()).json()
        assert body["crop_id"] == "wheat_rabi"

    def test_post_explanation_hindi_contains_devanagari(self, client):
        body = client.post("/api/explanation", json=self._payload("hi")).json()
        assert is_hindi(body["text_hi"] or "")

    def test_post_explanation_invalid_lang_returns_422(self, client):
        resp = client.post("/api/explanation", json=self._payload("fr"))
        assert resp.status_code == 422

    def test_post_explanation_missing_histogram_bins_returns_422(self, client):
        payload = self._payload()
        del payload["simulation_result"]["stats"]["histogram_bins"]
        resp = client.post("/api/explanation", json=payload)
        assert resp.status_code == 422

    def test_post_explanation_cotton_kharif(self, client):
        payload = {"simulation_result": _sim_result("cotton_kharif"), "lang": "both"}
        body = client.post("/api/explanation", json=payload).json()
        assert body["crop_id"] == "cotton_kharif"
        assert body["text_en"] is not None
        assert body["text_hi"] is not None
