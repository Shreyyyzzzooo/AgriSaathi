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
  ChatRequest,
  ChatResponse,
  MarketPriceResponse,
  MarketLocationsResponse,
  LocationInfoResponse,
  User,
  AuthResponse,
  FarmerProfile,
  FarmerProfileResponse,
  ChatConversationItem,
  ChatConversationDetail,
  ChatMessageItem,
} from "../types/api";

const BASE_URL: string =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_BACKEND_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// Automatically attach Bearer auth token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("agrisaathi_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth Endpoints ───────────────────────────────────────────────────────────

export async function registerUser(payload: {
  username: string;
  password: string;
  preferred_language?: string;
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/register", payload);
  return data;
}

export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", payload);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>("/api/auth/me");
  return data;
}

export async function logoutUser(): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>("/api/auth/logout");
  return data;
}

export async function updateUserLanguage(language: string): Promise<{ status: string; preferred_language: string }> {
  const { data } = await apiClient.put<{ status: string; preferred_language: string }>("/api/auth/language", {
    language,
  });
  return data;
}

// ── Farmer Profile Endpoints ──────────────────────────────────────────────────

/** GET /api/farmer/profile — fetch authenticated user's farm setup */
export async function fetchFarmerProfile(): Promise<FarmerProfileResponse> {
  const { data } = await apiClient.get<FarmerProfileResponse>("/api/farmer/profile");
  return data;
}

/** PUT /api/farmer/profile — save or update farm profile */
export async function updateFarmerProfile(payload: Partial<FarmerProfile>): Promise<FarmerProfileResponse> {
  const { data } = await apiClient.put<FarmerProfileResponse>("/api/farmer/profile", payload);
  return data;
}

/** POST /api/farmer — register farmer session and auto-upsert profile if logged in */
export async function submitFarmerInput(
  payload: FarmerRequest & Partial<FarmerProfile>
): Promise<FarmerResponse> {
  const { data } = await apiClient.post<FarmerResponse>("/api/farmer", payload);
  return data;
}

// ── Crop & Simulation Endpoints ───────────────────────────────────────────────

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

// ── Persistent Chat Endpoints ─────────────────────────────────────────────────

export async function fetchChatConversations(): Promise<ChatConversationItem[]> {
  const { data } = await apiClient.get<ChatConversationItem[]>("/api/chat/conversations");
  return data;
}

export async function createChatConversation(title?: string): Promise<ChatConversationItem> {
  const { data } = await apiClient.post<ChatConversationItem>("/api/chat/conversations", {
    title: title || "New Conversation",
  });
  return data;
}

export async function fetchChatConversationDetail(conversationId: string): Promise<ChatConversationDetail> {
  const { data } = await apiClient.get<ChatConversationDetail>(`/api/chat/conversations/${conversationId}`);
  return data;
}

export async function postChatMessage(
  conversationId: string,
  text: string,
  sessionId?: string
): Promise<ChatMessageItem> {
  const { data } = await apiClient.post<ChatMessageItem>(
    `/api/chat/conversations/${conversationId}/messages`,
    { text, session_id: sessionId }
  );
  return data;
}

export async function deleteChatConversation(conversationId: string): Promise<{ status: string }> {
  const { data } = await apiClient.delete<{ status: string }>(`/api/chat/conversations/${conversationId}`);
  return data;
}

/** POST /api/chat — Legacy Chatbot endpoint */
export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>("/api/chat", payload);
  return data;
}

// ── Market Prices Endpoints ───────────────────────────────────────────────────

/** GET /api/market-prices/locations — Fetch available states and reporting districts */
export async function fetchMarketLocations(): Promise<MarketLocationsResponse> {
  const { data } = await apiClient.get<MarketLocationsResponse>("/api/market-prices/locations");
  return data;
}

/** GET /api/market-prices — Fetch mandi market prices */
export async function fetchMarketPrices(state: string, district?: string): Promise<MarketPriceResponse> {
  const { data } = await apiClient.get<MarketPriceResponse>("/api/market-prices", {
    params: { state, district: district || "All" },
  });
  return data;
}

// ── Error Helper ─────────────────────────────────────────────────────────────

/** Extract a human-readable message from an Axios error */
export function extractErrorMessage(err: unknown): string {
  const ae = err as AxiosError<{ detail?: string }>;
  if (ae?.response?.data?.detail) return ae.response.data.detail;
  if (ae?.message) return ae.message;
  return "An unexpected error occurred.";
}
