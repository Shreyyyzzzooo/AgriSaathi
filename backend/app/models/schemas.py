"""Pydantic v2 request/response models — mirrors the frozen API contract in docs/api_contract.md."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FarmerRequest(BaseModel):
    model_config = ConfigDict(strict=False, extra="allow")

    location: Optional[str] = "Unknown"
    plot_size_ha: Optional[float] = 1.0
    soil_type: Optional[str] = "loamy"
    water_availability: Optional[str] = "rainfed"
    budget_inr: Optional[int] = 100000

    # Extended farm profile fields
    farm_name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    area_acres: Optional[float] = None
    current_crop: Optional[str] = None
    sowing_date: Optional[str] = None
    irrigation_type: Optional[str] = None
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    ph: Optional[float] = None
    organic_matter: Optional[float] = None


class FarmerResponse(BaseModel):
    session_id: str
    status: str
    profile: Optional[dict] = None


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

class MarketPriceRecord(BaseModel):
    crop: str
    market: str
    arrival_date: str
    min_price: float
    max_price: float
    modal_price: float
    variety: Optional[str] = "Standard"
    grade: Optional[str] = "FAQ"
    district: Optional[str] = ""

class MarketPriceLocation(BaseModel):
    state: str
    district: str

class MarketPriceTrendPoint(BaseModel):
    date: str
    price: float
    min_price: float
    max_price: float

class MarketPriceResponse(BaseModel):
    source: str = "Agmarknet"
    location: MarketPriceLocation
    notice: Optional[str] = None
    prices: list[MarketPriceRecord]
    trends: Optional[dict[str, list[MarketPriceTrendPoint]]] = None

class MarketLocationsResponse(BaseModel):
    locations: dict[str, list[str]]


# ── Auth Models ───────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=4, max_length=128)
    preferred_language: Optional[str] = "en"


class UserLoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    preferred_language: str
    created_at: str


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class LanguageUpdateRequest(BaseModel):
    language: str


# ── Farmer Profile Models ─────────────────────────────────────────────────────

class FarmerProfileResponse(BaseModel):
    profile: Optional[dict] = None
    message: Optional[str] = None


# ── Chat History Models ───────────────────────────────────────────────────────

class ChatConversationItem(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int = 0


class ChatMessageItem(BaseModel):
    id: str
    conversation_id: str
    sender: Literal["user", "bot"]
    text: str
    created_at: str


class ChatConversationDetail(BaseModel):
    conversation: ChatConversationItem
    messages: list[ChatMessageItem]


class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class SendMessageRequest(BaseModel):
    text: str
    session_id: Optional[str] = None


