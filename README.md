# AgriTwin — 3D Digital Twin for Smarter, Collision-Free Crop Planning

A full-stack web application for Indian farmers: enter farm parameters, fetch live NASA POWER
weather and Agmarknet mandi prices, load ICAR crop benchmarks, run Monte Carlo yield simulations,
visualise a procedural 3D growing crop in React Three Fiber, and generate bilingual (English/Hindi)
explanations via IBM watsonx.ai Granite.

---

## Repository layout

```
agritwin/
├── backend/
│   ├── app/
│   │   ├── main.py                    FastAPI entry point (CORS, lifespan, routers)
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── farmer_input.py    POST /api/farmer
│   │   │       ├── crops.py           GET  /api/crops
│   │   │       ├── simulation.py      POST /api/simulate
│   │   │       ├── explain.py         POST /api/explain   (legacy)
│   │   │       └── explanation.py     POST /api/explanation (LLM layer)
│   │   ├── data_sources/
│   │   │   ├── nasa_power.py          Async NASA POWER weather + fallback
│   │   │   ├── agmarknet.py           Mandi prices + fallback
│   │   │   └── icar_soil.py           Local ICAR crop benchmarks
│   │   ├── llm/
│   │   │   ├── prompts/
│   │   │   │   ├── explain_en.txt     English Granite prompt template
│   │   │   │   └── explain_hi.txt     Hindi (Devanagari) prompt template
│   │   │   ├── explanation_generator.py  IBM Granite client + offline fallback
│   │   │   └── translation.py         Language routing (en / hi / both)
│   │   ├── simulation/
│   │   │   ├── crop_models.py         Yield × Revenue × Profit math
│   │   │   ├── monte_carlo.py         Vectorised NumPy 500-run engine
│   │   │   └── diversification.py     Market-crash risk (>45% peer saturation)
│   │   ├── models/
│   │   │   └── schemas.py             Pydantic v2 request/response models
│   │   └── session_store.py           SQLite-backed session store
│   ├── data/
│   │   ├── icar_benchmarks.json       10 crops with agronomic benchmarks
│   │   ├── icar_reference_cache.json  5 primary crops (Cotton/Soy/Wheat/Groundnut/Maize)
│   │   ├── mock_district_planting_data.json  District peer planting fractions
│   │   └── sample_past_season.json    Historical season reference records
│   ├── tests/
│   │   ├── test_api.py                39 API integration tests
│   │   ├── test_data_sources.py       22 data-layer fallback tests
│   │   ├── test_simulation.py         37 Monte Carlo + diversification tests
│   │   └── test_llm.py                31 LLM explanation tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx      Split-screen layout (3D twin + wizard)
│   │   ├── components/
│   │   │   ├── DigitalTwin3D/
│   │   │   │   ├── DigitalTwinView.tsx  Top-level 3D wrapper (mock fallback)
│   │   │   │   ├── PlotScene.tsx        R3F Canvas — props-only, zero fetch
│   │   │   │   ├── GroundMesh.tsx       Displaced low-poly soil plane
│   │   │   │   ├── CropGrowthStage.tsx  Instanced 10×10 mesh grid (4 stages)
│   │   │   │   ├── WeatherParticles.tsx Rain/heat particles + adaptive lighting
│   │   │   │   └── TimelineScrubber.tsx Day slider + play/pause + p50/p10 toggle
│   │   │   ├── FarmerInputForm/
│   │   │   │   └── FarmerInputForm.tsx  Step 1 form with inline validation
│   │   │   ├── CropComparisonDashboard/
│   │   │   │   ├── CropComparisonDashboard.tsx  Crop cards + badges + histogram
│   │   │   │   └── ProfitHistogram.tsx           Recharts profit distribution
│   │   │   └── ui.tsx                  SkeletonCard, ErrorBanner, Badge, Spinner
│   │   ├── services/
│   │   │   └── apiClient.ts           Axios client — 4 typed API functions
│   │   └── types/
│   │       └── api.ts                 TypeScript mirrors of frozen API contract
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── docs/
│   └── api_contract.md               Frozen API schema (single source of truth)
├── scripts/
│   └── setup.sh                      One-command dev environment setup
├── agritwin-plan.md                  Implementation plan (all sub-tasks tracked)
└── README.md
```

---

## Quick start

### 1. One-command setup (macOS / Linux)

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This creates `backend/.venv`, installs Python deps, copies `.env.example → .env`, and runs `npm install`.

### 2. Manual setup (Windows / all platforms)

#### Backend

```bash
cd backend
python -m venv .venv

# Activate — Windows:
.venv\Scripts\activate
# Activate — macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then fill in WATSONX_APIKEY, WATSONX_PROJECT_ID
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_BACKEND_URL=http://localhost:8000 if needed
```

---

## Running locally

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API     | http://localhost:8000 |
| Swagger UI      | http://localhost:8000/docs |
| Health check    | http://localhost:8000/ |

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | Health check — `{"status":"ok"}` |
| `POST` | `/api/farmer` | Register farmer session → `session_id` |
| `GET`  | `/api/crops` | Filter crops by soil/water/budget |
| `POST` | `/api/simulate` | Monte Carlo simulation (500 runs/crop) |
| `POST` | `/api/explain` | Granite AI bilingual explanation (legacy) |
| `POST` | `/api/explanation` | Granite AI bilingual explanation (LLM layer) |

Full frozen schemas: [`docs/api_contract.md`](docs/api_contract.md)

---

## Environment variables

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`:

```env
# IBM watsonx.ai (optional — offline fallback used if absent)
WATSONX_APIKEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Agmarknet commodity prices (optional — static fallback used if absent)
AGMARKNET_API_KEY=your_agmarknet_key_here

# Server port (default: 8000)
PORT=8000
```

> **All external services degrade gracefully.** The app runs fully offline:
> - NASA POWER → 20-day bundled fallback weather
> - Agmarknet → bundled modal price table
> - IBM Granite → grounded f-string explanation (English + Hindi)

---

## Running tests

```bash
cd backend   # from repo root
source .venv/bin/activate

# All 129 tests
python -m pytest tests/ -v

# Individual suites
python -m pytest tests/test_api.py         # 39 API integration tests
python -m pytest tests/test_data_sources.py # 22 data-layer fallback tests
python -m pytest tests/test_simulation.py   # 37 Monte Carlo tests
python -m pytest tests/test_llm.py          # 31 LLM explanation tests
```

---

## Architecture overview

```
Browser (React + R3F)
  │
  ├─ DashboardPage (split screen)
  │    ├─ LEFT:  DigitalTwinView → PlotScene (R3F Canvas)
  │    │           ├─ GroundMesh       (displaced PlaneGeometry)
  │    │           ├─ CropGrowthStage  (InstancedMesh 10×10, 4 stages)
  │    │           └─ WeatherParticles (BufferGeometry Points)
  │    └─ RIGHT: FarmerInputForm → CropComparisonDashboard
  │                └─ ProfitHistogram (Recharts BarChart)
  │
  └─ apiClient.ts (Axios → http://localhost:8000)
        │
        └─ FastAPI Backend
             ├─ POST /api/farmer     → SQLite session store
             ├─ GET  /api/crops      → icar_soil.py (filter + budget_flag)
             ├─ POST /api/simulate   → asyncio.gather(nasa_power, agmarknet)
             │                          → monte_carlo.simulate_crops()
             │                          → diversification.check_diversification()
             └─ POST /api/explanation → llm/explanation_generator.py
                                         → IBM Granite (or offline f-string)
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| 3D twin | React Three Fiber, Three.js (procedural primitives only) |
| Charts | Recharts |
| Backend | FastAPI, Python 3.11+ |
| Simulation | NumPy (vectorised 500-run Monte Carlo) |
| Weather | NASA POWER Agroclimatology API |
| Prices | Agmarknet (with static fallback) |
| Crop data | ICAR reference benchmarks (bundled JSON) |
| LLM | IBM watsonx.ai — `ibm/granite-13b-chat-v2` |
| Session | SQLite (stdlib `sqlite3`) |
