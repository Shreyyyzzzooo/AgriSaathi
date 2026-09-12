/**
 * TypeScript interfaces mirroring the frozen API contract in docs/api_contract.md.
 * These are the single source of truth for all frontend types.
 */

// ── Shared ────────────────────────────────────────────────────────────────────

export type SoilType = "loamy" | "clay" | "sandy" | "silt";
export type WaterAvailability = "rainfed" | "irrigated" | "partial";
export type Season = "rabi" | "kharif" | "zaid";
export type BudgetFlag = "within_budget" | "marginal" | "over_budget";
export type Lang = "en" | "hi" | "kn" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "ml" | "as" | "or" | "ur" | "ne" | "sd" | "ks" | "sa";

export interface ExplainRequest {
  simulation_result: CropResult;
  lang: Lang;
}

export interface ExplainResponse {
  crop_id: string;
  text_en: string | null;
  text_hi: string | null;
  text_kn: string | null;
  text_mr: string | null;
  text_bn: string | null;
  text_ta: string | null;
  text_te: string | null;
  text_gu: string | null;
  text_pa: string | null;
  text_ml: string | null;
  text_as: string | null;
  text_or: string | null;
  text_ur: string | null;
  text_ne: string | null;
  text_sd: string | null;
  text_ks: string | null;
  text_sa: string | null;
  reasoning_bullets: string[];
}

// ── PlotScene props (decoupled from API) ──────────────────────────────────────

/**
 * PlotScene only consumes these three props — no API calls inside the component.
 * Parent passes weather_by_day directly from SimulateResponse.
 */
export interface PlotSceneProps {
  plotSize: number;           // hectares — drives ground mesh scale
  cropDurationDays: number;   // total growing days — drives animation timeline
  weatherByDay: WeatherDay[]; // direct slice, no transformation
}
