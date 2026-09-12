
# AgriTwin — Frozen API Contract

> **This file is the single source of truth for all request/response schemas.**
> Backend Pydantic models (`schemas.py`) and frontend TypeScript interfaces (`api.ts`) must mirror
> these definitions exactly. Do not modify this file without updating both layers.

---

## Base URL

```
http://localhost:8000          # local development
```

All endpoints return `application/json`. All error responses follow:
```json
{ "detail": "human-readable message" }
```

---

## 1. POST /farmer

Registers a new farmer session with plot parameters.

### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `location` | string | ✅ | e.g. `"Nashik, Maharashtra"` |
| `plot_size_ha` | number | ✅ | float, > 0 |
| `soil_type` | string | ✅ | `"loamy"` \| `"clay"` \| `"sandy"` \| `"silt"` |
| `water_availability` | string | ✅ | `"rainfed"` \| `"irrigated"` \| `"partial"` |
| `budget_inr` | integer | ✅ | whole rupees, ≥ 1 |

```json
{
  "location": "Nashik, Maharashtra",
  "plot_size_ha": 2.5,
  "soil_type": "loamy",
  "water_availability": "irrigated",
  "budget_inr": 50000
}
```

### Response `200 OK`

| Field | Type | Notes |
|---|---|---|
| `session_id` | string | UUID v4 |
| `status` | string | Always `"created"` |

```json
{
  "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "created"
}
```

### Errors

| Code | Condition |
|---|---|
| `422` | Pydantic validation failure — missing or invalid field |

---

## 2. GET /crops

Returns candidate crops filtered and ranked for a location and budget.

### Query Parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `location` | string | ✅ | Same value passed to POST /farmer |
| `budget` | integer | ✅ | Whole rupees |

**Example:** `GET /crops?location=Nashik%2C+Maharashtra&budget=50000`

### Response `200 OK`

Array of crop candidates:

| Field | Type | Notes |
|---|---|---|
| `crop_id` | string | e.g. `"wheat_rabi"` |
| `name` | string | Display name |
| `season` | string | `"rabi"` \| `"kharif"` \| `"zaid"` |
| `duration_days` | integer | Growing period in days |
| `budget_flag` | string | `"within_budget"` \| `"marginal"` \| `"over_budget"` |

```json
[
  {
    "crop_id": "wheat_rabi",
    "name": "Wheat",
    "season": "rabi",
    "duration_days": 120,
    "budget_flag": "within_budget"
  },
  {
    "crop_id": "cotton_kharif",
    "name": "Cotton",
    "season": "kharif",
    "duration_days": 180,
    "budget_flag": "marginal"
  }
]
```

**Budget flag logic:**
- `within_budget`: `cost_inr_ha ≤ budget`
- `marginal`: `budget < cost_inr_ha ≤ budget × 1.2`
- `over_budget`: `cost_inr_ha > budget × 1.2`

---

## 3. POST /simulate

Runs 100–500 Monte Carlo simulations per selected crop and fetches day-by-day NASA POWER weather.

### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `session_id` | string | ✅ | UUID from POST /farmer response |
| `selected_crops` | string[] | ✅ | Array of `crop_id` strings, ≥ 1 |
| `monte_carlo_runs` | integer | ❌ | Default `200`, min `1`, max `500` |

```json
{
  "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "selected_crops": ["wheat_rabi", "chickpea_rabi"],
  "monte_carlo_runs": 300
}
```

### Response `200 OK`

```json
{
  "results": [
    {
      "crop_id": "wheat_rabi",
      "stats": {
        "mean": 32.4,
        "p10": 24.1,
        "p50": 32.0,
        "p90": 41.7,
        "histogram_bins": [10.0, 14.0, 18.0, 22.0, 26.0, 30.0, 34.0, 38.0, 42.0, 46.0, 50.0]
      },
      "weather_by_day": [
        { "day": 1, "rainfall_mm": 0.0, "temp_c": 28.4, "condition": "sunny" },
        { "day": 2, "rainfall_mm": 12.3, "temp_c": 24.1, "condition": "rainy" }
      ]
    }
  ]
}
```

### Field constraints

| Field | Constraint |
|---|---|
| `histogram_bins` | Exactly **11** float values (10 equal-width intervals → 11 edges) |
| `weather_by_day` length | Exactly `duration_days` for the crop |
| `condition` | `"sunny"` \| `"rainy"` \| `"cloudy"` \| `"stormy"` |
| `day` | 1-indexed integer |

### Errors

| Code | Condition |
|---|---|
| `404` | `session_id` not found |
| `422` | Validation failure |

---

## 4. POST /explain

Passes a single crop simulation result to IBM Granite (watsonx.ai) and returns plain-language
explanation in English and/or Hindi.

### Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `simulation_result` | CropResult | ✅ | Full object from `results[]` in POST /simulate response |
| `lang` | string | ✅ | `"en"` \| `"hi"` \| `"both"` |

```json
{
  "simulation_result": {
    "crop_id": "wheat_rabi",
    "stats": {
      "mean": 32.4,
      "p10": 24.1,
      "p50": 32.0,
      "p90": 41.7,
      "histogram_bins": [10.0, 14.0, 18.0, 22.0, 26.0, 30.0, 34.0, 38.0, 42.0, 46.0, 50.0]
    },
    "weather_by_day": [
      { "day": 1, "rainfall_mm": 0.0, "temp_c": 28.4, "condition": "sunny" }
    ]
  },
  "lang": "both"
}
```

### Response `200 OK`

| Field | Type | Notes |
|---|---|---|
| `crop_id` | string | Echoed from request |
| `text_en` | string \| null | English paragraph; null if `lang == "hi"` |
| `text_hi` | string \| null | Hindi paragraph; null if `lang == "en"` |
| `reasoning_bullets` | string[] | 3–5 bullet strings; **always present** regardless of lang |

```json
{
  "crop_id": "wheat_rabi",
  "text_en": "Wheat shows a strong median yield of 32 quintals/ha with a 10th-percentile safety floor of 24 quintals. The season's predominantly sunny weather supported consistent growth.",
  "text_hi": "गेहूँ का औसत उत्पादन 32 क्विंटल/हेक्टेयर है, और मौसम अनुकूल रहने पर 41 क्विंटल तक पहुँच सकता है।",
  "reasoning_bullets": [
    "Median yield (p50 = 32 qtl/ha) is above the district average of 28 qtl/ha",
    "Low downside risk: p10 floor is 24 qtl/ha, limiting severe loss scenarios",
    "Sunny weather (78% of days) favoured grain filling in the simulation",
    "Budget cost is within the declared limit — positive net margin expected"
  ]
}
```

### Graceful degradation

If `WATSONX_API_KEY` is absent from the environment, the endpoint returns a deterministic mock
response (same schema) so the frontend can develop offline without a live IBM account.

---

## 5. PlotScene Props Contract (Frontend — Decoupled from API)

`PlotScene` is a pure 3D presentational component. It **must never** import `axios`, `fetch`,
or any API hook. Its entire input is the following props interface:

```typescript
interface PlotSceneProps {
  plotSize: number;            // hectares — drives ground plane mesh scale
  cropDurationDays: number;    // total growing days — drives animation timeline
  weatherByDay: WeatherDay[];  // direct slice from POST /simulate response, no transform
}

interface WeatherDay {
  day: number;                                        // 1-indexed
  rainfall_mm: number;
  temp_c: number;
  condition: "sunny" | "rainy" | "cloudy" | "stormy";
}
```

### Behaviour rules

| Rule | Detail |
|---|---|
| Stage transitions | Driven by internal `useFrame` clock as a fraction of `cropDurationDays` only |
| Particle system | Rain particles when `condition == "rainy"` or `"stormy"`; heat particles when `condition == "sunny"` and `temp_c > 35` |
| No fetch | Zero network calls inside `PlotScene.tsx` or `SceneWrapper.tsx` |
| Data source | Parent passes `weather_by_day` from `SimulateResponse` directly — no transformation |

### Growth stage thresholds

| Stage | Progress range | Geometry |
|---|---|---|
| Bare soil | 0 – 10% | Flat plane only |
| Seedling | 10 – 40% | Small ConeGeometry |
| Mature | 40 – 80% | Tall ConeGeometry |
| Harvest | 80 – 100% | Flattened CylinderGeometry |

---

## Shared Type Reference

### CropResult

```json
{
  "crop_id": "string",
  "stats": {
    "mean": "number",
    "p10": "number",
    "p50": "number",
    "p90": "number",
    "histogram_bins": ["number"]
  },
  "weather_by_day": ["WeatherDay"]
}
```

### WeatherDay

```json
{
  "day": "integer",
  "rainfall_mm": "number",
  "temp_c": "number",
  "condition": "sunny | rainy | cloudy | stormy"
}
```

---

*Last updated: plan phase — confirmed by user before implementation.*
