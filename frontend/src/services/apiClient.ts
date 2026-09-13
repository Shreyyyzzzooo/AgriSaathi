/**
 * services/apiClient.ts
 *
 * Axios client pointing to VITE_BACKEND_URL (default http://localhost:8000).
 * All API calls are centralised here — no component imports axios directly.
 */

import axios, { type AxiosError } from "axios";
import type {
  FarmerRequest,
  FarmerResponse,
  CropCandidate,
  SimulateRequest,
  SimulateResponse,
  ExplainRequest,
  ExplainResponse,
  LocationInfoResponse,
  ChatRequest,
  ChatResponse,
} from "../types/api";

const BASE_URL: string =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_BACKEND_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// ── Typed helpers ─────────────────────────────────────────────────────────────

/** POST /api/farmer — register farmer session, returns session_id */
export async function submitFarmerInput(
  payload: FarmerRequest
): Promise<FarmerResponse> {
  const { data } = await apiClient.post<FarmerResponse>("/api/farmer", payload);
  return data;
}

/** GET /api/crops — filtered, budget-flagged crop list */
export async function fetchCandidateCrops(
  location: string,
  budget: number,
  soil_type: string,
  water_availability: string,
  plot_size_ha: number = 1.0
): Promise<CropCandidate[]> {
  const { data } = await apiClient.get<CropCandidate[]>("/api/crops", {
    params: { location, budget, soil_type, water_availability, plot_size_ha },
  });
  return data;
}

/** POST /api/simulate — run Monte Carlo, returns profit distributions + weather */
export async function runSimulation(
  payload: SimulateRequest
): Promise<SimulateResponse> {
  const { data } = await apiClient.post<SimulateResponse>(
    "/api/simulate",
    payload
  );
  return data;
}

/** POST /api/explain — watsonx.ai bilingual explanation */
export async function fetchExplanation(
  payload: ExplainRequest
): Promise<ExplainResponse> {
  const { data } = await apiClient.post<ExplainResponse>(
    "/api/explanation",
    payload
  );
  return data;
}

/** GET /api/location-info — verify soil based on location */
export async function fetchLocationInfo(q: string): Promise<LocationInfoResponse> {
  const { data } = await apiClient.get<LocationInfoResponse>("/api/location-info", {
    params: { q },
  });
  return data;
}

/** Extract a human-readable message from an Axios error */
export function extractErrorMessage(err: unknown): string {
  const ae = err as AxiosError<{ detail?: string }>;
  if (ae?.response?.data?.detail) return ae.response.data.detail;
  if (ae?.message) return ae.message;
  return "An unexpected error occurred.";
}

/** POST /api/chat — Chatbot endpoint */
export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/api/chat", payload);
  return data;
}
