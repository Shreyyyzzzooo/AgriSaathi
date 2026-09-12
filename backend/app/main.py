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

from app.api.routes.farmer_input import router as farmer_router
from app.api.routes.crops import router as crops_router
from app.api.routes.simulation import router as simulation_router
from app.api.routes.explanation import router as explanation_router
from app.api.routes.location import router as location_router
from app.session_store import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: initialise DB on startup, nothing on shutdown."""
    init_db()
    yield


app = FastAPI(
    title="AgriTwin API",
    version="0.1.0",
    description=(
        "3D Digital Twin for Smarter, Collision-Free Crop Planning. "
        "Endpoints: POST /api/farmer · GET /api/crops · "
        "POST /api/simulate · POST /api/explain"
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
app.include_router(farmer_router)
app.include_router(crops_router)
app.include_router(simulation_router)
app.include_router(explanation_router)
app.include_router(location_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def health() -> dict:
    """Liveness probe — returns {"status": "ok"}."""
    return {"status": "ok"}
