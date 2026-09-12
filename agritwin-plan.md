# AgriTwin — Implementation Plan

## Top-Level Overview

AgriTwin is a greenfield monorepo: a FastAPI Python backend + React/TypeScript/R3F frontend.
The user (solo developer) ingests farmer plot parameters, fetches live NASA POWER weather and
Agmarknet mandi prices, loads cached ICAR crop benchmarks, runs Monte Carlo yield simulations
via NumPy, drives a 3D React-Three-Fiber digital twin with the simulation weather, and generates
bilingual plain-language explanations via IBM watsonx.ai Granite.

The workspace is currently empty. Every sub-task below creates files from scratch. No existing
code must be preserved or migrated.

**Key design decisions (confirmed):**
- `budget_inr` in POST /farmer and `budget` in GET /crops are both **integer** rupees.
- GET /crops takes explicit `location` + `budget` query params (not session_id).
- Monte Carlo run count is an **optional field** on POST /simulate body (default 200, max 500).
- `PlotScene` stage transitions are driven by timeline only; weather drives particles only.
- Session store is **SQLite-backed** (survives uvicorn restarts) via Python's stdlib `sqlite3`.

---

## Sub-Task 1 — Monorepo Skeleton + Tooling

**Status:** [x] done

**Intent:**
Create every directory, root config file, and stub file so all later sub-tasks have a place to land
and both the frontend and backend dev servers can start without errors.

**Expected Outcomes:**
- `frontend/` Vite + React + TypeScript project starts with `npm run dev` showing default Vite page.
- `backend/` FastAPI app starts with `uvicorn app.main:app --reload` showing `{"status":"ok"}` at `/`.
- `docs/api_contract.md` exists (written in Sub-Task 1 from the frozen spec below).
- Root `README.md` exists with local-run instructions.

**Todo List:**
1. Create root `README.md` (project description, local run instructions for both servers).
2. Scaffold `frontend/` directory with `package.json` for Vite + React + TypeScript + Three.js + @react-three/fiber + @react-three/drei + axios.
3. Create `frontend/tsconfig.json` and `frontend/vite.config.ts`.
4. Create `frontend/src/main.tsx`, `frontend/src/App.tsx` (minimal, no logic yet).
5. Create `frontend/src/types/api.ts` as an empty stub (populated in Sub-Task 7).
6. Create `backend/requirements.txt` with: fastapi, uvicorn[standard], numpy, pydantic, httpx, python-dotenv, ibm-watsonx-ai.
7. Create `backend/.env.example` listing WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_URL.
8. Create `backend/app/__init__.py` (empty).
9. Create `backend/app/main.py` with a minimal FastAPI app, CORS middleware, and a `GET /` health endpoint.
10. Create stub router files: `backend/app/routers/farmer.py`, `crops.py`, `simulate.py`, `explain.py` (each with an empty APIRouter).
11. Create stub service files: `backend/app/services/nasa_power.py`, `agmarknet.py`, `icar.py`, `monte_carlo.py`, `watsonx.py`.
12. Create `backend/app/models/schemas.py` as empty stub (populated in Sub-Task 2).
13. Create `backend/app/session_store.py` as empty stub (populated in Sub-Task 2).
14. Create `backend/data/icar_benchmarks.json` as an empty JSON array `[]` (populated in Sub-Task 3).
15. Create `docs/api_contract.md` with the full frozen API contract (copy from this plan's appendix).

**Relevant Context:**
- No existing files. All paths are relative to the monorepo root `agritwin/`.
- Frontend: Vite scaffolds into `frontend/` via `npm create vite@latest frontend -- --template react-ts`.
- Backend: FastAPI convention — `app/main.py` is the entry point; routers included via `app.include_router(...)`.

---

## Sub-Task 2 — Backend Schemas + SQLite Session Store

**Status:** [x] done

**Intent:**
Define all Pydantic v2 request/response models that exactly match the frozen API contract, and implement
the SQLite-backed session store so sessions survive uvicorn restarts.

**Expected Outcomes:**
- `schemas.py` exports: `FarmerRequest`, `FarmerResponse`, `CropCandidate`, `SimulateRequest`, `SimulateResponse`, `ExplainRequest`, `ExplainResponse`, `WeatherDay`, `CropStats`, `CropResult`.
- `session_store.py` exports `save_session(session_id, data)` and `get_session(session_id)` backed by `sessions.db` (SQLite).
- Both files are importable without runtime errors.

**Todo List:**
1. Populate `backend/app/models/schemas.py` with all Pydantic models per the frozen contract.
   - `budget_inr` is `int` in `FarmerRequest`; `budget` is `int` query param in GET /crops.
   - `monte_carlo_runs` is `Optional[int] = Field(default=200, le=500, ge=1)` in `SimulateRequest`.
   - `histogram_bins` is `list[float]` with exactly 11 values.
   - `weather_by_day` length equals `duration_days` for the crop (validated at service layer, not schema).
2. Populate `backend/app/session_store.py`:
   - On import, open/create `backend/sessions.db` with a `sessions` table: `(id TEXT PRIMARY KEY, data TEXT)`.
   - `save_session(session_id: str, data: dict)` — JSON-serialises `data` and upserts.
   - `get_session(session_id: str) -> dict | None` — fetches and JSON-deserialises; returns `None` if missing.
3. Wire `session_store.py` into `app/main.py` startup (call `init_db()` on startup).

**Relevant Context:**
- Pydantic v2 is assumed (ibm-watsonx-ai requires modern pydantic). Use `model_validator` not `validator`.
- SQLite stdlib `sqlite3` — no ORM needed; keep it minimal.

---

## Sub-Task 3 — Data Layer: NASA POWER, Agmarknet, ICAR

**Status:** [x] done

**Intent:**
Implement the three service modules responsible for fetching or loading external data, each with a
simple file-based cache (JSON files in `backend/data/cache/`) so repeated calls don't hit remote APIs.

**Expected Outcomes:**
- `nasa_power.py`: `fetch_weather(location: str, duration_days: int) -> list[WeatherDay]` — returns a list of dicts matching `WeatherDay` shape.
- `agmarknet.py`: `fetch_prices(location: str) -> dict[str, float]` — returns `{crop_id: price_inr_per_quintal}`.
- `icar.py`: `load_benchmarks() -> list[dict]` — loads `icar_benchmarks.json`; populates with ≥10 crops including wheat_rabi, rice_kharif, cotton_kharif, maize_kharif, soybean_kharif, chickpea_rabi, mustard_rabi, sugarcane, groundnut_kharif, onion_rabi.
- Cache files written to `backend/data/cache/` as `nasa_{location_slug}_{days}.json` and `agmarknet_{location_slug}.json`; stale after 24 hours.

**Todo List:**
1. Implement `nasa_power.py`:
   - Call NASA POWER Daily API: `https://power.larc.nasa.gov/api/temporal/daily/point` with params `PRECTOTCORR,T2M` for the location's lat/lon.
   - Parse response into `list[WeatherDay]`: map T2M → `temp_c`, PRECTOTCORR → `rainfall_mm`, derive `condition` from thresholds (rainfall > 10 → "rainy", temp > 38 → "stormy", rainfall > 0 → "cloudy", else "sunny").
   - Geocode location string to lat/lon using a simple lookup dict of 20 Indian cities (no external geocoder needed).
   - Cache result as JSON; return cached if < 24 hours old.
2. Implement `agmarknet.py`:
   - Use the open Agmarknet commodity price API (or a static mock dict if the API is unavailable).
   - Return `{crop_id: price_inr_per_quintal}` for the location's state.
   - Cache result similarly.
3. Populate `icar_benchmarks.json` with ≥10 crop objects, each containing: `crop_id`, `name`, `season`, `duration_days`, `yield_mean_qtl_ha`, `yield_std_qtl_ha`, `cost_inr_ha`, `water_req`.
4. Implement `icar.py`: `load_benchmarks()` reads and returns the JSON file as a list of dicts.

**Relevant Context:**
- NASA POWER API is free and requires no key.
- Agmarknet's official API requires registration; use a static mock dict as fallback (flag clearly in code).
- The geocode lookup dict must cover major agricultural states: Maharashtra, Punjab, UP, MP, Rajasthan, Haryana, AP, Karnataka.

---

## Sub-Task 4 — Monte Carlo Simulation Engine

**Status:** [x] done

**Intent:**
Implement the NumPy-based simulation engine that takes a crop benchmark record and a weather array,
draws `n_runs` random yield samples, and returns the exact `CropStats` shape from the frozen contract.

**Expected Outcomes:**
- `monte_carlo.py` exports `simulate_crop(crop: dict, weather: list[dict], n_runs: int) -> dict`.
- Return dict matches: `{crop_id, stats: {mean, p10, p50, p90, histogram_bins}, weather_by_day}`.
- `histogram_bins` always has exactly 11 float values (10 equal-width bins → 11 edges).
- Function is deterministic given the same `numpy.random.seed` (seed passed as optional arg for tests).
- Unit test in `backend/tests/test_monte_carlo.py` verifies shape and histogram edge count.

**Todo List:**
1. Implement `simulate_crop`:
   - Draw `n_runs` samples from `np.random.normal(mean=crop["yield_mean_qtl_ha"], scale=crop["yield_std_qtl_ha"])`.
   - Apply a weather modifier: compute a scalar from `weather` (e.g. fraction of rainy days * 0.1 bonus, fraction of stormy days * 0.15 penalty) and multiply all samples.
   - Clip samples to 0 (no negative yields).
   - Compute `mean`, `p10` (np.percentile 10), `p50`, `p90`.
   - Compute histogram: `np.histogram(samples, bins=10)` → extract the 11 bin edges.
   - Return full result dict.
2. Write `backend/tests/__init__.py` and `backend/tests/test_monte_carlo.py` with at least 3 assertions:
   - Result has correct keys.
   - `histogram_bins` has 11 values.
   - `p10 <= p50 <= p90`.

**Relevant Context:**
- Weather modifier must be simple and explainable (used by the LLM explain service to cite weather impact).
- Keep the modifier formula in a named constant or docstring so `watsonx.py` can reference it in the prompt.

---

## Sub-Task 5 — FastAPI Routers: All Four Endpoints

**Status:** [x] done

**Intent:**
Wire all four routers to their service modules, validate request/response shapes against `schemas.py`,
and confirm the Swagger UI at `/docs` shows the correct contract.

**Expected Outcomes:**
- `POST /farmer` creates a session via `session_store`, returns `{session_id, status: "created"}`.
- `GET /crops` calls `icar.load_benchmarks()` + `agmarknet.fetch_prices()`, returns filtered + flagged list.
- `POST /simulate` calls `nasa_power.fetch_weather()` + `monte_carlo.simulate_crop()` for each crop, returns `SimulateResponse`.
- `POST /explain` calls `watsonx.explain()`, returns `ExplainResponse`.
- All routers registered in `app/main.py`.

**Todo List:**
1. Implement `farmer.py` router:
   - Validate `FarmerRequest`, generate `uuid.uuid4()` session_id, save to session store, return `FarmerResponse`.
2. Implement `crops.py` router:
   - Accept `location: str` and `budget: int` as query params.
   - Load ICAR benchmarks; for each crop, flag `budget_flag` based on `cost_inr_ha` vs budget (within_budget if cost ≤ budget, marginal if cost ≤ budget*1.2, over_budget otherwise).
   - Return list of `CropCandidate`.
3. Implement `simulate.py` router:
   - Validate `SimulateRequest`; look up session via `session_id`.
   - For each `crop_id` in `selected_crops`: load ICAR record, fetch NASA POWER weather, run `simulate_crop`.
   - Return `SimulateResponse` wrapping list of `CropResult`.
4. Implement `explain.py` router:
   - Validate `ExplainRequest`; call `watsonx.explain()` (stub if API key absent); return `ExplainResponse`.
5. Register all four routers in `app/main.py` with prefix `""` and appropriate tags.
6. Manually test all four endpoints in Swagger UI and confirm response shapes.

**Relevant Context:**
- Session lookup returns `None` if session_id is invalid — return HTTP 404 in that case.
- `monte_carlo_runs` defaults to 200 if not provided in the request.

---

## Sub-Task 6 — watsonx.ai Granite Explain Service

**Status:** [x] done

**Intent:**
Build the `watsonx.py` service to construct a structured prompt from a `CropResult` object, call
IBM Granite via the `ibm-watsonx-ai` SDK, and parse `text_en`, `text_hi`, and `reasoning_bullets`
from the response.

**Expected Outcomes:**
- `watsonx.py` exports `explain(simulation_result: dict, lang: str) -> dict` returning `ExplainResponse`-shaped dict.
- Prompt includes: crop name, mean yield, p10/p90 range, dominant weather condition, and a request for 3–5 bullet reasoning points.
- If `lang == "en"`: only English text; `text_hi` is null. If `"hi"`: only Hindi; `text_en` is null. If `"both"`: both populated.
- If `WATSONX_API_KEY` is missing from environment, function returns a deterministic mock response (for offline dev).
- API key, project ID, and endpoint URL read from `.env` via `python-dotenv`.

**Todo List:**
1. Implement `watsonx.py`:
   - Load credentials from environment on module import.
   - Build a prompt template string (f-string) that embeds crop stats and requests structured output.
   - Call `ibm_watsonx_ai.foundation_models.ModelInference` with model `ibm/granite-13b-instruct-v2`.
   - Parse the response text: extract bullet lines (lines starting with `-` or `•`) as `reasoning_bullets`.
   - If `lang` includes English, generate English explanation paragraph from response.
   - If `lang` includes Hindi, make a second call with a Hindi instruction (or request bilingual in one call — choose the approach that produces cleaner output).
   - Return dict matching `ExplainResponse` schema.
2. Add a `_mock_explain(simulation_result, lang)` fallback used when no API key is present.
3. Add integration note in `docs/api_contract.md` clarifying that `/explain` degrades gracefully to mock.

**Relevant Context:**
- IBM watsonx.ai SDK docs: `ModelInference.generate(prompt=..., params=...)`.
- Granite models accept a system prompt and a user message; structure the prompt accordingly.
- `.env.example` already lists the three required env vars (created in Sub-Task 1).

---

## Sub-Task 7 — Frontend: TypeScript Types + `useAgriTwin` Hook

**Status:** [x] done

**Intent:**
Mirror the frozen API schemas in `api.ts` and implement all four API call functions in `useAgriTwin.ts`
so that no component ever imports `axios` or `fetch` directly.

**Expected Outcomes:**
- `api.ts` exports: `FarmerRequest`, `FarmerResponse`, `CropCandidate`, `SimulateRequest`, `SimulateResponse`, `CropResult`, `CropStats`, `WeatherDay`, `ExplainRequest`, `ExplainResponse`.
- `useAgriTwin.ts` exports a hook returning: `{ submitFarmer, fetchCrops, runSimulation, fetchExplanation, loading, error }`.
- TypeScript compiles with zero errors.

**Todo List:**
1. Populate `frontend/src/types/api.ts` with all TypeScript interfaces mirroring the frozen schemas.
   - `budget_inr: number` (integer enforced at API boundary, not TS type system).
   - `monte_carlo_runs?: number` optional in `SimulateRequest`.
   - `histogram_bins: number[]` (11 values, length not enforced in TS).
   - `condition: "sunny" | "rainy" | "cloudy" | "stormy"` as a string union.
2. Implement `frontend/src/hooks/useAgriTwin.ts`:
   - Use `axios` (already in `package.json` from Sub-Task 1).
   - `submitFarmer(req: FarmerRequest): Promise<FarmerResponse>`
   - `fetchCrops(location: string, budget: number): Promise<CropCandidate[]>`
   - `runSimulation(req: SimulateRequest): Promise<SimulateResponse>`
   - `fetchExplanation(req: ExplainRequest): Promise<ExplainResponse>`
   - Each function sets `loading = true` before call, `loading = false` after, sets `error` on failure.
   - Backend base URL read from `import.meta.env.VITE_API_URL` (default `http://localhost:8000`).
3. Create `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`.

**Relevant Context:**
- All four hook functions are stateful; `loading` and `error` are shared across calls.
- `WeatherDay` in `api.ts` must be identical in shape to what `PlotScene` consumes — no transformation.

---

## Sub-Task 8 — Frontend: UI Step Components

**Status:** [x] done

**Intent:**
Build the four step-based UI components that wire the hook to the screen. No inline fetch calls.
No inline styles — use a minimal CSS module or Tailwind setup.

**Expected Outcomes:**
- `FarmerForm.tsx`: collects all five farmer fields, calls `submitFarmer`, advances to step 2.
- `CropSelector.tsx`: shows candidate crops with budget_flag badge, multi-select, calls `runSimulation`.
- `SimResults.tsx`: shows per-crop stats table + histogram bar chart (plain SVG or recharts).
- `ExplainPanel.tsx`: language toggle (en/hi/both), calls `fetchExplanation`, renders bullets + paragraphs.
- `App.tsx` wires the four steps with a simple stepper (step 1→2→3→4).

**Todo List:**
1. Install `recharts` for the histogram (add to `package.json`).
2. Implement `FarmerForm.tsx`: controlled form with dropdowns for `soil_type` and `water_availability`, number inputs for `plot_size_ha` and `budget_inr`, text input for `location`.
3. Implement `CropSelector.tsx`: renders a card per crop; `budget_flag` shown as a coloured badge (green/amber/red); checkbox multi-select; "Simulate" button triggers `runSimulation`.
4. Implement `SimResults.tsx`: table of `{crop_id, mean, p10, p50, p90}`; Recharts BarChart for histogram bins per crop; "Explain" button per crop.
5. Implement `ExplainPanel.tsx`: language radio buttons; renders `text_en` / `text_hi` paragraph; renders `reasoning_bullets` as an unordered list.
6. Update `App.tsx` with a 4-step stepper passing hook state down as props.

**Relevant Context:**
- `SimResults.tsx` receives `SimulateResponse` from hook state (not re-fetched).
- `ExplainPanel.tsx` calls `fetchExplanation` with the selected crop's `CropResult`.

---

## Sub-Task 9 — PlotScene 3D Digital Twin

**Status:** [x] done

**Intent:**
Build the React-Three-Fiber scene that visualises the growing crop. It consumes only `PlotSceneProps`
(plotSize, cropDurationDays, weatherByDay) and has zero API calls or hook imports.

**Expected Outcomes:**
- `PlotScene.tsx` renders a 3D scene with a ground plane, a crop mesh that transitions through 4 growth stages, and a particle system.
- Stage transitions: bare soil (0–10%), seedling (10–40%), mature (40–80%), harvest (80–100%) of `cropDurationDays` — driven by an internal useFrame clock.
- Rain particles appear when `condition == "rainy"` or `"stormy"` for the current simulated day.
- Heat haze / dust particles appear when `condition == "sunny"` and `temp_c > 35`.
- `PlotScene` can be rendered in isolation with mock props (confirmed in a Storybook story or a standalone test page).
- No `fetch`, `axios`, or hook import inside the file.

**Todo List:**
1. Install `@react-three/fiber`, `@react-three/drei`, `three` (already in Sub-Task 1 package.json; confirm).
2. Implement `PlotScene.tsx`:
   a. Define `PlotSceneProps` and `WeatherDay` interfaces (imported from `types/api.ts`).
   b. Ground plane: a `<mesh>` with `<planeGeometry>` scaled by `plotSize`.
   c. Crop mesh: a `<mesh>` that swaps geometry based on growth stage (BoxGeometry for bare, ConeGeometry for seedling, taller Cone for mature, flattened Cylinder for harvest).
   d. `useFrame` hook: advance `elapsedDays` by `cropDurationDays / (60 * animDurationSeconds)` per frame; compute stage from progress fraction; look up `weatherByDay[Math.floor(elapsedDays)]`.
   e. Rain particles: a `<Points>` component with 200 random positions, visible only when `condition` is rainy/stormy; animate Y position downward in `useFrame`.
   f. Heat particles: a `<Points>` component with 50 slow-rising positions, visible only when condition is sunny and temp_c > 35.
3. Wrap `PlotScene` in `<Canvas>` with `<OrbitControls>` and `<ambientLight>` in a parent `SceneWrapper.tsx`.
4. Add `SceneWrapper` to `SimResults.tsx` so the 3D view appears alongside stats.
5. Confirm `PlotScene` has no imports from `../hooks/` or any axios/fetch call.

**Relevant Context:**
- `weatherByDay` index must be clamped to `[0, weatherByDay.length - 1]` to avoid out-of-bounds.
- `drei`'s `<OrbitControls>` and `<Environment>` can be used freely.
- Low-poly aesthetic: keep geometry segment counts ≤ 8.

---

## Sub-Task 10 — Integration + End-to-End Smoke Test

**Status:** [x] done

**Intent:**
Connect frontend to backend, resolve any CORS or type mismatches, and verify the full user flow
works locally from farmer form to animated 3D twin.

**Expected Outcomes:**
- `uvicorn app.main:app --reload` and `npm run dev` run concurrently without errors.
- A user can complete all four steps in the browser with no console errors.
- `PlotScene` animates correctly using real simulation weather data from the backend.
- No TypeScript `any` types remain in component props.

**Todo List:**
1. Confirm `CORSMiddleware` in `app/main.py` allows `http://localhost:5173` (Vite default port).
2. Run `npm run build` in `frontend/` — fix any TypeScript errors.
3. Run `uvicorn app.main:app --reload` and curl each endpoint manually.
4. Open browser, complete full form-to-explain flow, verify 3D scene animates.
5. Update `README.md` with final local-run instructions.

---

## Appendix: Frozen API Contract (source for docs/api_contract.md)

See `docs/api_contract.md` — written in Sub-Task 1 from the spec below.

### POST /farmer
Request: `{ location: string, plot_size_ha: number, soil_type: "loamy"|"clay"|"sandy"|"silt", water_availability: "rainfed"|"irrigated"|"partial", budget_inr: integer }`
Response: `{ session_id: string (UUID v4), status: "created" }`

### GET /crops?location=string&budget=integer
Response array: `[{ crop_id, name, season: "rabi"|"kharif"|"zaid", duration_days: integer, budget_flag: "within_budget"|"over_budget"|"marginal" }]`

### POST /simulate
Request: `{ session_id: string, selected_crops: string[], monte_carlo_runs?: integer (default 200, max 500) }`
Response: `{ results: [{ crop_id, stats: { mean, p10, p50, p90, histogram_bins: float[11] }, weather_by_day: WeatherDay[] }] }`

### POST /explain
Request: `{ simulation_result: CropResult, lang: "en"|"hi"|"both" }`
Response: `{ crop_id: string, text_en: string|null, text_hi: string|null, reasoning_bullets: string[] }`

### WeatherDay shape
`{ day: integer (1-indexed), rainfall_mm: number, temp_c: number, condition: "sunny"|"rainy"|"cloudy"|"stormy" }`

### PlotSceneProps (TypeScript — never receives API calls)
`{ plotSize: number, cropDurationDays: number, weatherByDay: WeatherDay[] }`
