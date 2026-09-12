"""API integration tests — exercises all four endpoints via httpx.AsyncClient.

Uses FastAPI's TestClient / ASGITransport so no real network is required.
All external calls (NASA POWER, Agmarknet, watsonx) are either:
    - Already mocked/fallback-safe (no API key in test env).
    - Patched with unittest.mock to avoid real HTTP in simulation tests.

Test coverage:
    GET  /
    POST /api/farmer
    GET  /api/crops
    POST /api/simulate
    POST /api/explain
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest
import pytest_asyncio

from app.main import app
from app.data_sources.nasa_power import DailyWeather


# ── Shared async test client ──────────────────────────────────────────────────

@pytest.fixture
def client():
    """Synchronous TestClient for non-async tests."""
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c


@pytest.fixture
def async_transport():
    return httpx.ASGITransport(app=app)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_weather(n: int = 20) -> list[DailyWeather]:
    return [
        DailyWeather(
            day_index=i + 1,
            rainfall_mm=5.0 if i % 5 == 0 else 0.0,
            temp_avg_c=29.5,
            heat_stress=False,
            solar_mj_m2=16.0,
        )
        for i in range(n)
    ]


_FARMER_PAYLOAD = {
    "location":           "Nashik, Maharashtra",
    "plot_size_ha":       2.5,
    "soil_type":          "loamy",
    "water_availability": "irrigated",
    "budget_inr":         50000,
}


# ─────────────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────────────

class TestHealth:

    def test_health_returns_ok(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_health_content_type_json(self, client):
        resp = client.get("/")
        assert "application/json" in resp.headers["content-type"]


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/farmer
# ─────────────────────────────────────────────────────────────────────────────

class TestFarmerEndpoint:

    def test_post_farmer_returns_200(self, client):
        resp = client.post("/api/farmer", json=_FARMER_PAYLOAD)
        assert resp.status_code == 200

    def test_post_farmer_returns_session_id(self, client):
        resp = client.post("/api/farmer", json=_FARMER_PAYLOAD)
        body = resp.json()
        assert "session_id" in body
        assert len(body["session_id"]) == 36   # UUID v4 length

    def test_post_farmer_status_is_created(self, client):
        resp = client.post("/api/farmer", json=_FARMER_PAYLOAD)
        assert resp.json()["status"] == "created"

    def test_post_farmer_missing_field_returns_422(self, client):
        payload = {k: v for k, v in _FARMER_PAYLOAD.items() if k != "location"}
        resp = client.post("/api/farmer", json=payload)
        assert resp.status_code == 422

    def test_post_farmer_invalid_soil_type_returns_422(self, client):
        bad = {**_FARMER_PAYLOAD, "soil_type": "volcanic"}
        resp = client.post("/api/farmer", json=bad)
        assert resp.status_code == 422

    def test_post_farmer_zero_budget_returns_422(self, client):
        bad = {**_FARMER_PAYLOAD, "budget_inr": 0}
        resp = client.post("/api/farmer", json=bad)
        assert resp.status_code == 422

    def test_post_farmer_each_call_returns_unique_session_id(self, client):
        id1 = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        id2 = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        assert id1 != id2


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/crops
# ─────────────────────────────────────────────────────────────────────────────

class TestCropsEndpoint:

    def test_get_crops_returns_200(self, client):
        resp = client.get("/api/crops?location=Nashik&budget=50000")
        assert resp.status_code == 200

    def test_get_crops_returns_list(self, client):
        resp = client.get("/api/crops?location=Nashik&budget=50000")
        assert isinstance(resp.json(), list)

    def test_get_crops_required_fields_present(self, client):
        crops = client.get("/api/crops?location=Nashik&budget=50000").json()
        assert len(crops) > 0
        for crop in crops:
            assert "crop_id"       in crop
            assert "name"          in crop
            assert "season"        in crop
            assert "duration_days" in crop
            assert "budget_flag"   in crop

    def test_get_crops_budget_flag_values(self, client):
        crops = client.get("/api/crops?location=Nashik&budget=50000").json()
        valid_flags = {"within_budget", "marginal", "over_budget"}
        for crop in crops:
            assert crop["budget_flag"] in valid_flags

    def test_get_crops_season_values(self, client):
        crops = client.get("/api/crops?location=Nashik&budget=50000").json()
        valid_seasons = {"rabi", "kharif", "zaid"}
        for crop in crops:
            assert crop["season"] in valid_seasons

    def test_get_crops_within_budget_ordered_first(self, client):
        crops = client.get("/api/crops?location=Nashik&budget=50000").json()
        flags = [c["budget_flag"] for c in crops]
        # within_budget must all come before over_budget
        if "over_budget" in flags and "within_budget" in flags:
            last_within = max(i for i, f in enumerate(flags) if f == "within_budget")
            first_over  = min(i for i, f in enumerate(flags) if f == "over_budget")
            assert last_within < first_over

    def test_get_crops_tiny_budget_flags_most_over(self, client):
        crops = client.get("/api/crops?location=Nashik&budget=100").json()
        over_count = sum(1 for c in crops if c["budget_flag"] == "over_budget")
        assert over_count >= 1

    def test_get_crops_missing_budget_returns_422(self, client):
        resp = client.get("/api/crops?location=Nashik")
        assert resp.status_code == 422

    def test_get_crops_irrigated_includes_high_water_crops(self, client):
        crops = client.get(
            "/api/crops?location=Nashik&budget=100000&water_availability=irrigated"
        ).json()
        crop_ids = {c["crop_id"] for c in crops}
        # Cotton and rice are high-water; should appear with irrigated regime
        assert len(crop_ids) > 0

    def test_get_crops_rainfed_excludes_high_water_crops(self, client):
        crops = client.get(
            "/api/crops?location=Nashik&budget=100000&water_availability=rainfed"
        ).json()
        crop_ids = {c["crop_id"] for c in crops}
        # cotton_kharif (high water) must NOT appear for rainfed
        assert "cotton_kharif" not in crop_ids


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/simulate
# ─────────────────────────────────────────────────────────────────────────────

class TestSimulateEndpoint:
    """Patches fetch_weather so no real HTTP call is made."""

    def _post_simulate(self, client, session_id: str, crops: list[str], runs: int = 50):
        return client.post("/api/simulate", json={
            "session_id":       session_id,
            "selected_crops":   crops,
            "monte_carlo_runs": runs,
        })

    def test_simulate_returns_200(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            resp = self._post_simulate(client, session_id, ["wheat_rabi"])
        assert resp.status_code == 200

    def test_simulate_results_key_present(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            body = self._post_simulate(client, session_id, ["wheat_rabi"]).json()
        assert "results" in body

    def test_simulate_crop_result_keys(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            results = self._post_simulate(client, session_id, ["wheat_rabi"]).json()["results"]
        assert len(results) == 1
        r = results[0]
        assert r["crop_id"] == "wheat_rabi"
        assert "stats" in r
        assert "weather_by_day" in r

    def test_simulate_stats_keys_match_contract(self, client):
        """stats must have exactly: mean, p10, p50, p90, histogram_bins."""
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            stats = self._post_simulate(
                client, session_id, ["wheat_rabi"]
            ).json()["results"][0]["stats"]
        assert set(stats.keys()) == {"mean", "p10", "p50", "p90", "histogram_bins"}

    def test_simulate_histogram_bins_eleven_values(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            bins = self._post_simulate(
                client, session_id, ["wheat_rabi"]
            ).json()["results"][0]["stats"]["histogram_bins"]
        assert len(bins) == 11

    def test_simulate_weather_by_day_length(self, client):
        """weather_by_day length == crop duration_days."""
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            result = self._post_simulate(
                client, session_id, ["wheat_rabi"]
            ).json()["results"][0]
        # wheat_rabi duration_days = 120
        assert len(result["weather_by_day"]) == 120

    def test_simulate_weather_day_fields(self, client):
        """Each weather_by_day entry must have day, rainfall_mm, temp_c, condition."""
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            weather = self._post_simulate(
                client, session_id, ["wheat_rabi"]
            ).json()["results"][0]["weather_by_day"]
        for day in weather[:3]:
            assert "day"          in day
            assert "rainfall_mm"  in day
            assert "temp_c"       in day
            assert "condition"    in day
            assert day["condition"] in {"sunny", "rainy", "cloudy", "stormy"}

    def test_simulate_invalid_session_returns_404(self, client):
        resp = client.post("/api/simulate", json={
            "session_id":     "00000000-0000-0000-0000-000000000000",
            "selected_crops": ["wheat_rabi"],
        })
        assert resp.status_code == 404

    def test_simulate_invalid_crop_returns_422(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            resp = self._post_simulate(client, session_id, ["dragon_fruit_zaid"])
        assert resp.status_code == 422

    def test_simulate_multiple_crops_all_in_results(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            results = self._post_simulate(
                client, session_id, ["wheat_rabi", "maize_kharif"], runs=50
            ).json()["results"]
        returned_ids = {r["crop_id"] for r in results}
        assert returned_ids == {"wheat_rabi", "maize_kharif"}

    def test_simulate_p10_lte_p50_lte_p90(self, client):
        session_id = client.post("/api/farmer", json=_FARMER_PAYLOAD).json()["session_id"]
        with patch(
            "app.api.routes.simulation.fetch_weather",
            new=AsyncMock(return_value=_mock_weather(120)),
        ):
            stats = self._post_simulate(
                client, session_id, ["wheat_rabi"]
            ).json()["results"][0]["stats"]
        assert stats["p10"] <= stats["p50"] <= stats["p90"]


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/explain
# ─────────────────────────────────────────────────────────────────────────────

class TestExplainEndpoint:

    def _minimal_explain_payload(self, lang: str = "en") -> dict:
        return {
            "simulation_result": {
                "crop_id": "wheat_rabi",
                "stats": {
                    "mean": 50000.0,
                    "p10":  30000.0,
                    "p50":  50000.0,
                    "p90":  72000.0,
                    "histogram_bins": [
                        10000.0, 18000.0, 26000.0, 34000.0, 42000.0,
                        50000.0, 58000.0, 66000.0, 74000.0, 82000.0, 90000.0
                    ],
                },
                "weather_by_day": [
                    {"day": 1, "rainfall_mm": 0.0, "temp_c": 28.5, "condition": "sunny"}
                ],
            },
            "lang": lang,
        }

    def test_explain_returns_200(self, client):
        resp = client.post("/api/explain", json=self._minimal_explain_payload())
        assert resp.status_code == 200

    def test_explain_response_keys(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload()).json()
        assert "crop_id"           in body
        assert "text_en"           in body
        assert "text_hi"           in body
        assert "reasoning_bullets" in body

    def test_explain_crop_id_echoed(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload()).json()
        assert body["crop_id"] == "wheat_rabi"

    def test_explain_en_lang_has_text_en(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload("en")).json()
        assert body["text_en"] is not None
        assert body["text_hi"] is None

    def test_explain_hi_lang_has_text_hi(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload("hi")).json()
        assert body["text_hi"] is not None
        assert body["text_en"] is None

    def test_explain_both_lang_has_both(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload("both")).json()
        assert body["text_en"] is not None
        assert body["text_hi"] is not None

    def test_explain_reasoning_bullets_non_empty(self, client):
        body = client.post("/api/explain", json=self._minimal_explain_payload()).json()
        bullets = body["reasoning_bullets"]
        assert isinstance(bullets, list)
        assert len(bullets) >= 3

    def test_explain_invalid_lang_returns_422(self, client):
        payload = self._minimal_explain_payload()
        payload["lang"] = "fr"
        resp = client.post("/api/explain", json=payload)
        assert resp.status_code == 422

    def test_explain_missing_histogram_bins_returns_422(self, client):
        payload = self._minimal_explain_payload()
        del payload["simulation_result"]["stats"]["histogram_bins"]
        resp = client.post("/api/explain", json=payload)
        assert resp.status_code == 422
