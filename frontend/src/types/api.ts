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

export interface FarmerRequest {
  location: string;
  plot_size_ha: number;
  soil_type: SoilType;
  water_availability: WaterAvailability;
  budget_inr: number;
}

export interface FarmerResponse {
  session_id: string;
  status: string;
}

export interface CropCandidate {
  crop_id: string;
  name: string;
  season: Season;
  duration_days: number;
  budget_flag: BudgetFlag;
}

export interface WeatherDay {
  day: number;
  rainfall_mm: number;
  temp_c: number;
  condition: "sunny" | "rainy" | "cloudy" | "stormy";
}

export interface CropResult {
  crop_id: string;
  stats: CropStats;
  weather_by_day: WeatherDay[];
}

export interface SimulateRequest {
  session_id: string;
  selected_crops: string[];
  monte_carlo_runs?: number;
}

export interface SimulateResponse {
  results: CropResult[];
}

export interface LocationInfoResponse {
  location: string;
  detected_type: SoilType;
  clay_pct: number;
  sand_pct: number;
  silt_pct: number;
  ph: number;
  confidence: string;
}

export interface CropStats {
  mean: number;
  stddev: number;
  p10: number;
  p50: number;
  p90: number;
  histogram_bins: number[];
  histogram_counts: number[];
}

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

export interface AgronomyPlanRequest {
  session_id: string;
  crop_id: string;
  lang: string;
}

export interface AgronomyFertilizer {
  name: string;
  timing: string;
  dosage: string;
  reasoning: string;
}

export interface AgronomyPesticide {
  name: string;
  target: string;
  dosage: string;
  reasoning: string;
}

export interface AgronomyPlanResponse {
  fertilizers: AgronomyFertilizer[];
  pesticides: AgronomyPesticide[];
  general_advice: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  session_id: string;
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  reply_text: string;
}

export interface MarketPriceRecord {
  crop: string;
  market: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  variety?: string;
  grade?: string;
  district?: string;
}

export interface MarketPriceLocation {
  state: string;
  district: string;
}

export interface MarketPriceTrendPoint {
  date: string;
  price: number;
  min_price: number;
  max_price: number;
}

export interface MarketPriceResponse {
  source: string;
  location: MarketPriceLocation;
  notice?: string | null;
  prices: MarketPriceRecord[];
  trends?: Record<string, MarketPriceTrendPoint[]>;
}

export interface MarketLocationsResponse {
  locations: Record<string, string[]>;
}

export interface User {
  id: string;
  username: string;
  preferred_language: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface FarmerProfile {
  id?: string;
  user_id?: string;
  farm_name?: string;
  state?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  area_acres?: number;
  soil_type?: SoilType | string;
  current_crop?: string;
  sowing_date?: string;
  irrigation_type?: WaterAvailability | string;
  budget_inr?: number;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  organic_matter?: number;
  [key: string]: any;
}

export interface FarmerProfileResponse {
  profile: FarmerProfile | null;
  message?: string;
}

export interface ChatConversationItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessageItem {
  id: string;
  conversation_id: string;
  sender: "user" | "bot";
  text: string;
  created_at: string;
}

export interface ChatConversationDetail {
  conversation: ChatConversationItem;
  messages: ChatMessageItem[];
}

