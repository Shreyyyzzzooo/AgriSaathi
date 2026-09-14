# AgriSaathi — Smarter decisions. Healthier fields. Better harvests.

A production-grade, full-stack web application purpose-built to empower Indian farmers with data-driven crop planning decisions. The platform aggregates live satellite weather data from NASA POWER, real-time mandi (wholesale market) prices from Agmarknet, agronomic benchmarks from the Indian Council of Agricultural Research (ICAR), and ISRIC SoilGrids soil composition data into a single unified view.

Key features include:
- A procedural **3D digital twin** of the farmer's field evolving in real-time through five crop growth stages via React Three Fiber.
- A vectorised **Monte Carlo simulation engine** running up to 500 stochastic scenarios per crop to produce profit distributions and downside risk analysis.
- **Market crash detection** safeguarding against price collapse when over 45% of district peers grow the same crop.
- **IBM watsonx.ai-powered multilingual explanations** providing plain-language insights in 10 Indian languages (English, Hindi, Kannada, Marathi, Bengali, Tamil, Telugu, Gujarati, Punjabi, Malayalam).
- A persistent, session-aware **conversational AI chatbot** for open-ended agronomic queries.
- An AI-generated personalised **agronomy plan** with tailored fertiliser and pesticide recommendations based on soil context.
- A full **authentication system** supporting multi-user access with bcrypt password hashing and token-based session management.

---

## Repository layout

```text
agritwin/
├── backend/
│   ├── app/
│   │   ├── main.py                    FastAPI entry point (CORS, lifespan, routers)
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py            User registration, login, JWT token auth
│   │   │       ├── farmer_input.py    POST /api/farmer (Session & Profile)
│   │   │       ├── crops.py           GET  /api/crops
│   │   │       ├── simulation.py      POST /api/simulate
│   │   │       ├── explanation.py     POST /api/explanation (LLM layer)
│   │   │       ├── location.py        GET  /api/location-info (SoilGrids)
│   │   │       ├── market_prices.py   GET  /api/market-prices
│   │   │       ├── chat.py            Persistent chatbot APIs
│   │   │       └── agronomy.py        POST /api/agronomy/plan
│   │   ├── data_sources/
│   │   │   ├── nasa_power.py          Async NASA POWER weather + fallback
│   │   │   ├── agmarknet.py           Mandi prices + fallback
│   │   │   ├── icar_soil.py           Local ICAR crop benchmarks
│   │   │   └── soilgrids.py           ISRIC SoilGrids API + fallback
│   │   ├── llm/
│   │   │   ├── prompts/               10 language prompt templates
│   │   │   ├── explanation_generator.py IBM watsonx.ai client + offline fallback
│   │   │   └── translation.py         Language routing
│   │   ├── simulation/
│   │   │   ├── crop_models.py         Yield × Revenue × Profit math
│   │   │   ├── monte_carlo.py         Vectorised NumPy 500-run engine
│   │   │   └── diversification.py     Market-crash risk (>45% peer saturation)
│   │   ├── models/
│   │   │   └── schemas.py             Pydantic v2 schemas
│   │   └── session_store.py           SQLite-backed auth & session store
│   ├── data/                          (JSON fallbacks and benchmarks)
│   ├── tests/                         129 integration and unit tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                     Dashboard, LandingPage, MarketPrices, etc.
│   │   ├── components/
│   │   │   ├── DigitalTwin3D/         R3F Canvas, GroundMesh, InstancedCropField
│   │   │   ├── FarmerInputForm/       Multi-step parameter collection
│   │   │   ├── CropComparisonDashboard/ Simulation results and histograms
│   │   │   └── ChatBot/               Persistent AI chatbot interface
│   │   ├── services/
│   │   │   └── apiClient.ts           Axios client
│   │   └── types/
│   │       └── api.ts                 TypeScript mirrors of frozen API contract
│   ├── package.json
│   └── .env.example
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
cp .env.example .env   # Fill in WATSONX_APIKEY, WATSONX_PROJECT_ID, GEMINI_API_KEY
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_BACKEND_URL=http://localhost:8000
```

---

## Running locally

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
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
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login user to receive JWT token |
| `POST` | `/api/farmer` | Register farmer session (updates profile if logged in) |
| `GET`  | `/api/crops` | Filter crops by soil/water/budget |
| `POST` | `/api/simulate` | Monte Carlo simulation (500 runs/crop) |
| `POST` | `/api/explanation` | Granite AI bilingual explanation (10 languages) |
| `GET`  | `/api/location-info` | Fetch ISRIC SoilGrids data by location string |
| `POST` | `/api/agronomy/plan` | Generate AI agronomy plan (fertiliser/pesticides) |
| `POST` | `/api/market-prices` | Fetch live/historical mandi prices |
| `GET/POST` | `/api/chat/*` | Persistent conversational chatbot APIs |

Full frozen schemas: [`docs/api_contract.md`](docs/api_contract.md)

---

## Environment variables

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`:

```env
# IBM watsonx.ai (optional — offline fallback used if absent)
WATSONX_APIKEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Google Maps Geocoding API (required for universal location search)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Agmarknet commodity prices (optional — static fallback used if absent)
AGMARKNET_API_KEY=your_agmarknet_key_here

# Gemini Chatbot / Agronomy Agent
GEMINI_API_KEY=your_gemini_api_key_here

# Server port (default: 8000)
PORT=8000
```

> **All external services degrade gracefully.** The app runs fully offline:
> - NASA POWER → Bundled fallback weather JSON
> - Agmarknet → Bundled modal price table
> - IBM Granite → Grounded f-string explanations (10 languages)
> - SoilGrids → Loamy soil defaults
> - Google Maps → Nagpur (central India) coordinate fallback

---

## Running tests (129 tests)

```bash
cd backend   # from repo root
source .venv/bin/activate

# All 129 tests
python -m pytest tests/ -v

# Individual suites
python -m pytest tests/test_api.py          # 39 API integration tests
python -m pytest tests/test_data_sources.py # 22 data-layer fallback tests
python -m pytest tests/test_simulation.py   # 37 Monte Carlo tests
python -m pytest tests/test_llm.py          # 31 LLM explanation tests
```

---

## Architecture overview

```text
Browser (React + R3F)
  │
  ├─ DigitalTwinView → PlotScene (R3F Canvas)
  │    ├─ GroundMesh (Displaced PlaneGeometry)
  │    ├─ InstancedCropField (High-performance GPU instancing)
  │    └─ WeatherParticles (Dynamic environment)
  │
  ├─ CropComparisonDashboard (Charts and AI explanations)
  ├─ ChatBot (Persistent context-aware agent)
  │
  └─ apiClient.ts (Axios → http://localhost:8000)
        │
        └─ FastAPI Backend
             ├─ POST /api/farmer     → SQLite session & auth store
             ├─ POST /api/simulate   → asyncio.gather(nasa_power, agmarknet)
             │                          → monte_carlo.simulate_crops()
             │                          → diversification.check_diversification()
             ├─ POST /api/explanation → IBM Granite (or offline f-string)
             └─ POST /api/chat        → RAG/Session-aware AI agent
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| 3D Twin | React Three Fiber, Three.js (Procedural primitives) |
| Charts | Recharts |
| Backend | FastAPI, Python 3.11+ |
| Simulation | NumPy (Vectorised 500-run Monte Carlo) |
| Weather | NASA POWER Agroclimatology API |
| Soil | ISRIC SoilGrids REST API |
| Prices | Agmarknet (with static fallback) |
| Crop data | ICAR reference benchmarks (bundled JSON) |
| Auth/Session | SQLite (stdlib `sqlite3`), bcrypt |
| LLM | IBM watsonx.ai (`ibm/granite-13b-chat-v2`), Gemini |
