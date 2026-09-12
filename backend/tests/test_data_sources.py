"""Tests for backend/app/data_sources — validates graceful fallback behaviour.

Every test mocks live HTTP to return a 500 or raise a timeout, then asserts
that the client returns valid data loaded from the fallback JSON files rather
than raising an exception.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# ── Paths ─────────────────────────────────────────────────────────────────────

_FALLBACK_WEATHER = (
    Path(__file__).parent.parent
    / "app" / "data_sources" / "cache" / "fallback_weather.json"
)
_FALLBACK_PRICES = (
    Path(__file__).parent.parent
    / "app" / "data_sources" / "cache" / "fallback_mandi_prices.json"
)
_ICAR_CACHE = (
    Path(__file__).parent.parent / "data" / "icar_reference_cache.json"
)


# ─────────────────────────────────────────────────────────────────────────────
# NASA POWER tests
# ─────────────────────────────────────────────────────────────────────────────

class TestNasaPowerFallback:
    """nasa_power.fetch_weather must fall back on HTTP 500 or timeout."""

    def _run(self, coro):
        return asyncio.get_event_loop().run_until_complete(coro)

    def test_fallback_on_http_500(self):
        """HTTP 500 from NASA POWER → fallback weather loaded, no exception."""
        from app.data_sources import nasa_power

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)

        with patch("app.data_sources.nasa_power.httpx.AsyncClient", return_value=mock_client):
            result = self._run(nasa_power.fetch_weather(18.52, 73.86, duration_days=10))

        assert isinstance(result, list)
        assert len(result) == 10
        assert all(hasattr(d, "day_index") for d in result)
        assert all(hasattr(d, "rainfall_mm") for d in result)
        assert all(hasattr(d, "temp_avg_c") for d in result)
        assert all(hasattr(d, "heat_stress") for d in result)
        assert all(isinstance(d.heat_stress, bool) for d in result)

    def test_fallback_on_timeout(self):
        """ConnectTimeout → fallback weather loaded, no exception."""
        from app.data_sources import nasa_power

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(
            side_effect=httpx.ConnectTimeout("timed out")
        )

        with patch("app.data_sources.nasa_power.httpx.AsyncClient", return_value=mock_client):
            result = self._run(nasa_power.fetch_weather(20.0, 73.79, duration_days=5))

        assert isinstance(result, list)
        assert len(result) == 5

    def test_fallback_record_structure(self):
        """Fallback records must have all required DailyWeather fields."""
        from app.data_sources import nasa_power

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=httpx.ReadTimeout("timeout"))

        with patch("app.data_sources.nasa_power.httpx.AsyncClient", return_value=mock_client):
            result = self._run(nasa_power.fetch_weather(21.15, 79.09, duration_days=3))

        for day in result:
            assert day.day_index >= 1
            assert day.rainfall_mm >= 0.0
            assert isinstance(day.temp_avg_c, float)
            assert isinstance(day.heat_stress, bool)
            assert isinstance(day.solar_mj_m2, float)

    def test_day_index_sequential(self):
        """Fallback records must have sequential day_index starting at 1."""
        from app.data_sources import nasa_power

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=Exception("network error"))

        with patch("app.data_sources.nasa_power.httpx.AsyncClient", return_value=mock_client):
            result = self._run(nasa_power.fetch_weather(22.72, 75.86, duration_days=7))

        indices = [d.day_index for d in result]
        assert indices == list(range(1, 8))

    def test_heat_stress_flag_correct(self):
        """heat_stress must be True iff temp_avg_c > 35."""
        from app.data_sources import nasa_power

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=Exception("offline"))

        with patch("app.data_sources.nasa_power.httpx.AsyncClient", return_value=mock_client):
            result = self._run(nasa_power.fetch_weather(26.91, 75.79, duration_days=20))

        for day in result:
            assert day.heat_stress == (day.temp_avg_c > 35.0)

    def test_fallback_file_exists(self):
        """The fallback weather JSON file must exist and be valid JSON."""
        assert _FALLBACK_WEATHER.exists(), f"Missing: {_FALLBACK_WEATHER}"
        records = json.loads(_FALLBACK_WEATHER.read_text())
        assert isinstance(records, list)
        assert len(records) > 0

    def test_get_latlon_known_city(self):
        """get_latlon must resolve a known city correctly."""
        from app.data_sources.nasa_power import get_latlon

        lat, lon = get_latlon("Nashik, Maharashtra")
        assert abs(lat - 20.0) < 1.0
        assert abs(lon - 73.79) < 1.0

    def test_get_latlon_unknown_city_raises(self):
        """get_latlon must raise KeyError for an unknown city."""
        from app.data_sources.nasa_power import get_latlon

        with pytest.raises(KeyError):
            get_latlon("Atlantis, Ocean")


# ─────────────────────────────────────────────────────────────────────────────
# Agmarknet tests
# ─────────────────────────────────────────────────────────────────────────────

class TestAgmarknetFallback:
    """agmarknet.fetch_prices must fall back on HTTP error or missing API key."""

    def test_fallback_when_no_api_key(self, monkeypatch):
        """Absent AGMARKNET_API_KEY → fallback prices loaded, no exception."""
        import importlib
        import app.data_sources.agmarknet as agmarknet_mod

        monkeypatch.setattr(agmarknet_mod, "_API_KEY", None)

        result = agmarknet_mod.fetch_prices("Nashik, Maharashtra")

        assert isinstance(result, list)
        assert len(result) > 0
        for item in result:
            assert hasattr(item, "crop_id")
            assert hasattr(item, "modal_price_quintal")
            assert hasattr(item, "price_variance")
            assert item.modal_price_quintal > 0

    def test_fallback_on_http_500(self, monkeypatch):
        """HTTP 500 from Agmarknet → fallback prices loaded, no exception."""
        import app.data_sources.agmarknet as agmarknet_mod

        monkeypatch.setattr(agmarknet_mod, "_API_KEY", "fake-key")

        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get = MagicMock(return_value=mock_resp)

        with patch("app.data_sources.agmarknet.httpx.Client", return_value=mock_client):
            result = agmarknet_mod.fetch_prices("Nagpur, Maharashtra")

        assert isinstance(result, list)
        assert len(result) > 0

    def test_fallback_on_connect_error(self, monkeypatch):
        """ConnectError → fallback prices loaded, no exception."""
        import app.data_sources.agmarknet as agmarknet_mod

        monkeypatch.setattr(agmarknet_mod, "_API_KEY", "fake-key")

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get = MagicMock(
            side_effect=httpx.ConnectError("connection refused")
        )

        with patch("app.data_sources.agmarknet.httpx.Client", return_value=mock_client):
            result = agmarknet_mod.fetch_prices("Pune, Maharashtra")

        assert isinstance(result, list)
        assert len(result) > 0

    def test_crop_id_filter(self, monkeypatch):
        """Passing crop_ids filter must return only matching records."""
        import app.data_sources.agmarknet as agmarknet_mod

        monkeypatch.setattr(agmarknet_mod, "_API_KEY", None)

        result = agmarknet_mod.fetch_prices(
            "Indore, Madhya Pradesh",
            crop_ids=["wheat_rabi", "cotton_kharif"],
        )

        returned_ids = {r.crop_id for r in result}
        assert returned_ids.issubset({"wheat_rabi", "cotton_kharif"})

    def test_fallback_file_exists(self):
        """The fallback mandi prices JSON must exist and be valid."""
        assert _FALLBACK_PRICES.exists(), f"Missing: {_FALLBACK_PRICES}"
        records = json.loads(_FALLBACK_PRICES.read_text())
        assert isinstance(records, list)
        assert len(records) > 0

    def test_price_series_types(self, monkeypatch):
        """CropPriceSeries fields must be the right Python types."""
        import app.data_sources.agmarknet as agmarknet_mod

        monkeypatch.setattr(agmarknet_mod, "_API_KEY", None)
        result = agmarknet_mod.fetch_prices("Ludhiana, Punjab")

        for item in result:
            assert isinstance(item.crop_id, str)
            assert isinstance(item.modal_price_quintal, float)
            assert isinstance(item.price_variance, float)


# ─────────────────────────────────────────────────────────────────────────────
# ICAR soil tests
# ─────────────────────────────────────────────────────────────────────────────

class TestIcarSoil:
    """icar_soil must load and serve benchmark data from the local JSON cache."""

    def test_cache_file_exists(self):
        """icar_reference_cache.json must exist."""
        assert _ICAR_CACHE.exists(), f"Missing: {_ICAR_CACHE}"

    def test_list_crops_returns_five_primary(self):
        """list_crops must include the 5 primary ICAR crops."""
        from app.data_sources.icar_soil import list_crops

        crops = list_crops()
        ids = {c["crop_id"] for c in crops}
        required = {
            "cotton_kharif", "soybean_kharif", "wheat_rabi",
            "groundnut_kharif", "maize_kharif",
        }
        assert required.issubset(ids)

    def test_get_crop_known(self):
        """get_crop with a known crop_id must return a dict with all fields."""
        from app.data_sources.icar_soil import get_crop

        record = get_crop("wheat_rabi")
        assert record is not None
        assert record["crop_id"] == "wheat_rabi"
        assert record["season"] == "rabi"
        assert record["duration_days"] > 0
        assert record["yield_mean_qtl_ha"] > 0
        assert record["cost_inr_ha"] > 0
        assert isinstance(record["optimal_soil_types"], list)

    def test_get_crop_unknown_returns_none(self):
        """get_crop with an unknown ID must return None."""
        from app.data_sources.icar_soil import get_crop

        assert get_crop("dragon_fruit_zaid") is None

    def test_optimal_soil_filter(self):
        """get_optimal_crops_for_soil must return only crops matching the soil."""
        from app.data_sources.icar_soil import get_optimal_crops_for_soil

        loam_crops = get_optimal_crops_for_soil("loam")
        assert len(loam_crops) > 0
        for crop in loam_crops:
            assert "loam" in [s.lower() for s in crop["optimal_soil_types"]]

    def test_icar_record_schema(self):
        """Every ICAR record must have required agronomic fields."""
        from app.data_sources.icar_soil import list_crops

        required_keys = {
            "crop_id", "name", "season", "duration_days",
            "yield_mean_qtl_ha", "yield_std_qtl_ha",
            "cost_inr_ha", "water_req", "water_req_mm_season",
            "optimal_soil_types",
        }
        for crop in list_crops():
            missing = required_keys - set(crop.keys())
            assert not missing, f"Crop '{crop.get('crop_id')}' missing keys: {missing}"

    def test_water_req_values(self):
        """water_req must be one of 'low', 'medium', 'high'."""
        from app.data_sources.icar_soil import list_crops

        valid = {"low", "medium", "high"}
        for crop in list_crops():
            assert crop["water_req"] in valid

    def test_yield_range_sensible(self):
        """yield_min must be less than yield_mean which must be less than yield_max."""
        from app.data_sources.icar_soil import list_crops

        for crop in list_crops():
            assert crop["yield_min_qtl_ha"] < crop["yield_mean_qtl_ha"]
            assert crop["yield_mean_qtl_ha"] < crop["yield_max_qtl_ha"]
