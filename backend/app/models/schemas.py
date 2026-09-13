"""Pydantic v2 request/response models — mirrors the frozen API contract in docs/api_contract.md."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FarmerRequest(BaseModel):
    model_config = ConfigDict(strict=False)

    location: str
    plot_size_ha: float = Field(gt=0)
    soil_type: Literal["loamy", "clay", "sandy", "silt"]
    water_availability: Literal["rainfed", "irrigated", "partial"]
    budget_inr: int = Field(ge=1)


class FarmerResponse(BaseModel):
    session_id: str
    status: str


class CropCandidate(BaseModel):
    crop_id: str
    name: str
    season: Literal["rabi", "kharif", "zaid"]
    duration_days: int
    budget_flag: Literal["within_budget", "marginal", "over_budget"]


class WeatherDay(BaseModel):
    day: int
    rainfall_mm: float
    temp_c: float
    condition: Literal["sunny", "rainy", "cloudy", "stormy"]


class CropStats(BaseModel):
    mean: float
    p10: float
    p50: float
    p90: float
    histogram_bins: list[float]
    histogram_counts: list[int]

    @field_validator("histogram_bins")
    @classmethod
    def must_have_eleven_bins(cls, v: list[float]) -> list[float]:
        if len(v) != 11:
            raise ValueError(f"histogram_bins must have exactly 11 values, got {len(v)}")
        return v


class CropResult(BaseModel):
    crop_id: str
    stats: CropStats
    weather_by_day: list[WeatherDay]


class SimulateRequest(BaseModel):
    model_config = ConfigDict(strict=False)

    session_id: str
    selected_crops: list[str] = Field(min_length=1)
    monte_carlo_runs: Optional[int] = Field(default=200, ge=1, le=500)


class SimulateResponse(BaseModel):
    results: list[CropResult]


class ExplainRequest(BaseModel):
    simulation_result: CropResult
    lang: Literal["en", "hi", "kn", "mr", "bn", "ta", "te", "gu", "pa", "ml"]


class ExplainResponse(BaseModel):
    crop_id: str
    text_en: Optional[str] = None
    text_hi: Optional[str] = None
    text_kn: Optional[str] = None
    text_mr: Optional[str] = None
    text_bn: Optional[str] = None
    text_ta: Optional[str] = None
    text_te: Optional[str] = None
    text_gu: Optional[str] = None
    text_pa: Optional[str] = None
    text_ml: Optional[str] = None
    reasoning_bullets: list[str]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply_text: str
