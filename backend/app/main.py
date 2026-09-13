"""AgriTwin FastAPI application entry point.

Startup:
    - Initialises the SQLite session store (init_db).
    - Registers all four API routers under /api.

CORS:
    All origins allowed (required for local Vite dev server and demo).
"""

from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.farmer_input import router as farmer_router
from app.api.routes.crops import router as crops_router
from app.api.routes.simulation import router as simulation_router
from app.api.routes.explanation import router as explanation_router
from app.api.routes.location import router as location_router
from app.api.routes.chat import router as chat_router
from app.api.routes.agronomy import router as agronomy_router
from app.api.routes.market_prices import router as market_prices_router
from app.session_store import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: initialise DB on startup, nothing on shutdown."""
    init_db()
    yield


app = FastAPI(
    title="AgriSaathi API",
    version="0.1.0",
    description=(
        "AgriSaathi - 3D Digital Twin, Crop Planning, Market Intelligence, and Farmer Persistence API."
    ),
    lifespan=lifespan,
)

# ── CORS — allow all origins (required for Vite dev + hackathon demo) ─────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(farmer_router)
app.include_router(crops_router)
app.include_router(simulation_router)
app.include_router(explanation_router)
app.include_router(location_router)
app.include_router(chat_router)
app.include_router(agronomy_router)
app.include_router(market_prices_router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def health() -> dict:
    """Liveness probe — returns {"status": "ok"}."""
    return {"status": "ok"}
