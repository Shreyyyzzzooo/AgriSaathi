/**
 * DashboardPage — full AgriTwin application page.
 *
 * Layout (responsive):
 *   Desktop: split screen
 *     LEFT  — 3D Digital Twin + TimelineScrubber
 *     RIGHT — Stepper: FarmerInputForm → CropComparisonDashboard
 *   Mobile: single column, 3D twin collapses to 280px fixed height
 *
 * State machine:
 *   "input"    → FarmerInputForm visible
 *   "crops"    → CropComparisonDashboard visible, 3D twin shows placeholder
 *   "results"  → CropComparisonDashboard + simulation stats, 3D twin animates
 */

import { useState, useCallback } from "react";
import { DigitalTwinView } from "../components/DigitalTwin3D";
import FarmerInputForm from "../components/FarmerInputForm";
import CropComparisonDashboard from "../components/CropComparisonDashboard";
import { ErrorBanner, SkeletonCard } from "../components/ui";
import { getTranslation, type Language } from "../i18n";
import type {
  FarmerRequest,
  FarmerResponse,
  CropCandidate,
  CropResult,
} from "../types/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "input" | "crops" | "results";

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  width: "100vw",
  height: "100vh",
  background: "#0F172A",
  overflow: "hidden",
  fontFamily: "system-ui, sans-serif",
};

const LEFT: React.CSSProperties = {
  flex: "0 0 50%",
  height: "100%",
  position: "relative",
  borderRight: "1px solid #1E293B",
};

const RIGHT: React.CSSProperties = {
  flex: 1,
  height: "100%",
  overflowY: "auto",
  padding: "24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const TITLE: React.CSSProperties = {
  color: "#F1F5F9",
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: "-0.3px",
};

const SUBTITLE: React.CSSProperties = {
  color: "#64748B",
  fontSize: 12,
  marginTop: 2,
};

const STEPPER_LABEL: React.CSSProperties = {
  color: "#64748B",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [step, setStep]             = useState<Step>("input");
  const [farmerInput, setFarmerInput] = useState<FarmerRequest | null>(null);
  const [session, setSession]       = useState<FarmerResponse | null>(null);
  const [crops, setCrops]           = useState<CropCandidate[]>([]);
  const [simResults, setSimResults] = useState<Record<string, CropResult & { market_crash_risk?: boolean }>>({});
  const [activeCrop, setActiveCrop] = useState<CropResult | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>("en");

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

  // Called by FarmerInputForm on successful submit
  const handleFarmerSuccess = useCallback(
    (
      sess: FarmerResponse,
      candidateCrops: CropCandidate[],
      input: FarmerRequest
    ) => {
      setSession(sess);
      setCrops(candidateCrops);
      setFarmerInput(input);
      setStep("crops");
    },
    []
  );

  // Called by CropComparisonDashboard when simulation results arrive
  const handleSimulated = useCallback(
    (results: Record<string, CropResult & { market_crash_risk?: boolean }>) => {
      setSimResults(results);
      setStep("results");
    },
    []
  );

  // Called when user clicks "View in 3D" on a crop card
  const handleCropSelected = useCallback((_cropId: string, result: CropResult) => {
    setActiveCrop(result);
  }, []);

  // ── Derived values for 3D twin ────────────────────────────────────────────
  // Use the first active crop result for the twin; fall back to first sim result
  const twinCrop = activeCrop ?? Object.values(simResults)[0] ?? null;
  const twinWeather = twinCrop?.weather_by_day ?? [];
  const twinDuration = twinCrop
    ? crops.find((c) => c.crop_id === twinCrop.crop_id)?.duration_days ?? 120
    : 120;

  // ── Step label helper ─────────────────────────────────────────────────────
  const stepDots = (["input", "crops", "results"] as Step[]).map((s) => ({
    key: s,
    label: s === "input" ? "Plot Setup" : s === "crops" ? "Crop Selection" : "Simulation",
    active: step === s,
    done: (step === "crops" && s === "input") ||
          (step === "results" && (s === "input" || s === "crops")),
  }));

  return (
    <div style={PAGE}>
      {/* ════ LEFT — 3D Digital Twin ═════════════════════════════════════════ */}
      <div style={LEFT}>
        <DigitalTwinView
          plotSize={farmerInput?.plot_size_ha ?? 2.5}
          durationDays={twinDuration}
          weatherByDay={twinWeather}
          cropType={twinCrop?.crop_id ?? "wheat_rabi"}
        />

        {/* Overlay: "select a crop to animate" hint when no results */}
        {step !== "results" && (
          <div style={{
            position: "absolute",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15,23,42,0.82)",
            border: "1px solid #334155",
            borderRadius: 10,
            padding: "8px 16px",
            color: "#64748B",
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}>
            {step === "input"
              ? "🌾 3D twin will animate after simulation"
              : "▶ Select crops and simulate to see the 3D twin animate"}
          </div>
        )}
      </div>

      {/* ════ RIGHT — Dashboard panel ════════════════════════════════════════ */}
      <div style={RIGHT}>
        {/* Header */}
        <div style={HEADER}>
          <span style={{ fontSize: 28 }}>🌱</span>
          <div>
            <div style={TITLE}>{t("title")}</div>
            <div style={SUBTITLE}>
              {t("subtitle")}
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {stepDots.map(({ key, label, active, done }, i) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && (
                <div style={{
                  width: 24, height: 1,
                  background: done ? "#22C55E" : "#334155",
                }} />
              )}
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: done ? "#15803D" : active ? "#1E3A5F" : "#1E293B",
                border: `2px solid ${done ? "#22C55E" : active ? "#3B82F6" : "#334155"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: done ? "#86EFAC" : active ? "#93C5FD" : "#475569",
                fontWeight: 700, flexShrink: 0,
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{
                ...STEPPER_LABEL,
                color: active ? "#93C5FD" : done ? "#22C55E" : "#475569",
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Global error */}
        {globalError && (
          <ErrorBanner
            message={`Connection error: ${globalError}. Check that uvicorn is running on port 8000.`}
            onDismiss={() => setGlobalError(null)}
          />
        )}

        {/* ── Step content ── */}

        {/* Step 1: Farmer input */}
        {step === "input" && (
          <div>
            <div style={{ color: "#94A3B8", fontSize: 13, marginBottom: 16 }}>
              Enter your farm parameters to get started.
            </div>
            <FarmerInputForm onSuccess={handleFarmerSuccess} lang={lang} />
          </div>
        )}

        {/* Step 2 & 3: Crop comparison */}
        {(step === "crops" || step === "results") && session && (
          <>
            {/* Summary bar */}
            <div style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              fontSize: 12,
              color: "#94A3B8",
            }}>
              <span>📍 <strong style={{ color: "#F1F5F9" }}>{farmerInput?.location}</strong></span>
              <span>🌾 {farmerInput?.plot_size_ha} ha</span>
              <span>🪨 {farmerInput?.soil_type}</span>
              <span>💧 {farmerInput?.water_availability}</span>
              <span>💰 ₹{((farmerInput?.budget_inr ?? 0) / 1000).toFixed(0)}K budget</span>
              <button
                onClick={() => {
                  setStep("input");
                  setSimResults({});
                  setActiveCrop(null);
                }}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#64748B",
                  padding: "2px 10px",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                ✏ Edit
              </button>
            </div>

            {/* Loading skeleton while simulating */}
            {step === "crops" && crops.length === 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} rows={4} height={14} />)}
              </div>
            )}

            <CropComparisonDashboard
              sessionId={session.session_id}
              crops={crops}
              budget={farmerInput?.budget_inr ?? 0}
              simulationResults={simResults}
              onSimulated={handleSimulated}
              onCropSelected={handleCropSelected}
              lang={lang}
              setLang={setLang}
            />
          </>
        )}
      </div>
    </div>
  );
}
