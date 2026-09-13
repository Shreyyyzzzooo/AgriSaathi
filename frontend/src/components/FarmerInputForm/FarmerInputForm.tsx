/**
 * FarmerInputForm — Step 1 of the AgriTwin wizard.
 *
 * Collects: Location, Plot Size (ha), Soil Type, Water Availability, Budget (INR).
 * Interactive Soil Verification uses SoilGrids API.
 */

import { useState, type FormEvent } from "react";
import {
  submitFarmerInput,
  fetchCandidateCrops,
  fetchLocationInfo,
  extractErrorMessage,
} from "../../services/apiClient";
import { ErrorBanner, Spinner } from "../ui";
import { getTranslation, type Language } from "../../i18n";
import type {
  FarmerRequest,
  FarmerResponse,
  CropCandidate,
  SoilType,
  WaterAvailability,
  LocationInfoResponse,
} from "../../types/api";

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  form:    { display: "flex", flexDirection: "column" as const, gap: 16 },
  label:   { display: "flex", flexDirection: "column" as const, gap: 5,
             fontSize: 13, color: "#94A3B8", fontFamily: "system-ui, sans-serif" },
  input:   {
    background: "#0F172A", border: "1px solid #334155", borderRadius: 8,
    padding: "9px 12px", color: "#F1F5F9", fontSize: 14, outline: "none",
    fontFamily: "system-ui, sans-serif", width: "100%", boxSizing: "border-box" as const,
  },
  inputErr:{ border: "1px solid #EF4444" },
  select:  {
    background: "#0F172A", border: "1px solid #334155", borderRadius: 8,
    padding: "9px 12px", color: "#F1F5F9", fontSize: 14, outline: "none",
    fontFamily: "system-ui, sans-serif", width: "100%", appearance: "auto" as const,
  },
  hint:    { fontSize: 11, color: "#F59E0B", marginTop: 3 },
  btn:     {
    background: "#16A34A", border: "none", borderRadius: 10, padding: "11px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "system-ui, sans-serif", width: "100%",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },
  verifyBtn: {
    background: "#2563EB", border: "none", borderRadius: 8, padding: "9px 16px",
    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "system-ui, sans-serif", alignSelf: "flex-start", marginTop: 8,
  },
  soilBox: {
    background: "#1E293B", border: "1px solid #334155", borderRadius: 8,
    padding: "12px", fontSize: 13, color: "#F1F5F9", marginTop: 8,
  },
  btnRow: {
    display: "flex", gap: 8, marginTop: 12
  },
  yesBtn: {
    background: "#16A34A", border: "none", borderRadius: 6, padding: "6px 12px",
    color: "#fff", cursor: "pointer", fontWeight: "bold"
  },
  noBtn: {
    background: "#EF4444", border: "none", borderRadius: 6, padding: "6px 12px",
    color: "#fff", cursor: "pointer", fontWeight: "bold"
  }
};

// ── Validation ────────────────────────────────────────────────────────────────
function validate(f: Partial<FarmerRequest>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.location?.trim()) errors.location = "Required.";
  if (!f.plot_size_ha || f.plot_size_ha <= 0)
    errors.plot_size_ha = "> 0 ha.";
  if (f.plot_size_ha && f.plot_size_ha > 500)
    errors.plot_size_ha = "Max 500 ha.";
  if (!f.budget_inr || f.budget_inr < 1000)
    errors.budget_inr = "≥ ₹1,000.";
  if (f.budget_inr && f.budget_inr > 10_000_000)
    errors.budget_inr = "Max ₹1 crore.";
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface FarmerInputFormProps {
  onSuccess: (
    session: FarmerResponse,
    crops: CropCandidate[],
    input: FarmerRequest
  ) => void;
  lang: Language;
}

const SOIL_OPTIONS: { value: SoilType; label: string }[] = [
  { value: "loamy",  label: "Loamy (balanced)" },
  { value: "clay",   label: "Clay (heavy)" },
  { value: "sandy",  label: "Sandy (light)" },
  { value: "silt",   label: "Silt (fertile)" },
];

const WATER_OPTIONS: { value: WaterAvailability; label: string }[] = [
  { value: "irrigated", label: "Fully Irrigated" },
  { value: "partial",   label: "Partial Irrigation" },
  { value: "rainfed",   label: "Rainfed Only" },
];

export default function FarmerInputForm({ onSuccess, lang }: FarmerInputFormProps) {
  const [form, setForm] = useState<Partial<FarmerRequest>>({
    soil_type: "loamy",
    water_availability: "irrigated",
  });
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Soil Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [soilInfo, setSoilInfo] = useState<LocationInfoResponse | null>(null);
  const [soilConfirmed, setSoilConfirmed] = useState<boolean | null>(null);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

  const set = (key: keyof FarmerRequest, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    
    if (key === "location") {
      setSoilInfo(null);
      setSoilConfirmed(null);
    }
  };

  const handleVerify = async () => {
    if (!form.location?.trim()) {
      setErrors({ location: "Required." });
      return;
    }
    setIsVerifying(true);
    setApiError(null);
    try {
      const data = await fetchLocationInfo(form.location);
      setSoilInfo(data);
      setSoilConfirmed(null);
    } catch (err) {
      setApiError(extractErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSoilConfirmation = (agree: boolean) => {
    setSoilConfirmed(agree);
    if (agree && soilInfo) {
      set("soil_type", (soilInfo as any).detected_type_simple || soilInfo.detected_type);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError(null);
    try {
      const payload = form as FarmerRequest;
      const [session, crops] = await Promise.all([
        submitFarmerInput(payload),
        fetchCandidateCrops(
          payload.location,
          payload.budget_inr,
          payload.soil_type,
          payload.water_availability,
          payload.plot_size_ha
        ),
      ]);
      onSuccess(session, crops, payload);
    } catch (err) {
      setApiError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {apiError && (
        <ErrorBanner
          message={`Backend error: ${apiError}`}
          onDismiss={() => setApiError(null)}
        />
      )}

      {/* Location */}
      <label style={s.label}>
        📍 {t("location")}
        <input
          style={{ ...s.input, ...(errors.location ? s.inputErr : {}) }}
          placeholder={t("locationPlaceholder")}
          value={form.location ?? ""}
          onChange={(e) => set("location", e.target.value)}
        />
        {errors.location && <span style={s.hint}>{errors.location}</span>}
        <button 
          type="button" 
          onClick={handleVerify} 
          style={s.verifyBtn}
          disabled={isVerifying}
        >
          {isVerifying ? t("verifying") : t("verifyLocation")}
        </button>
      </label>

      {/* Interactive Soil Verification UI */}
      {soilInfo && soilConfirmed === null && (
        <div style={s.soilBox}>
          <strong>Live Soil Data Detected:</strong>
          <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>Clay: {soilInfo.clay_pct}%</li>
            <li>Sand: {soilInfo.sand_pct}%</li>
            <li>Silt: {soilInfo.silt_pct}%</li>
            <li>pH: {soilInfo.ph}</li>
          </ul>
          <p style={{ margin: 0 }}>Classifies as <strong>{soilInfo.detected_type.toUpperCase()}</strong> soil.</p>
          <p style={{ margin: "8px 0 0 0" }}>Do you agree?</p>
          <div style={s.btnRow}>
            <button type="button" onClick={() => handleSoilConfirmation(true)} style={s.yesBtn}>Yes</button>
            <button type="button" onClick={() => handleSoilConfirmation(false)} style={s.noBtn}>No</button>
          </div>
        </div>
      )}

      {/* Soil type */}
      <label style={s.label}>
        🪨 {t("soilType")}
        <select
          style={s.select}
          value={form.soil_type}
          onChange={(e) => set("soil_type", e.target.value as SoilType)}
          disabled={soilConfirmed === true}
        >
          {SOIL_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {soilConfirmed === true && (
          <span style={s.hint}>✓ Verified by ISRIC SoilGrids</span>
        )}
      </label>

      {/* Plot size */}
      <label style={s.label}>
        🌾 {t("plotSize")}
        <input
          style={{ ...s.input, ...(errors.plot_size_ha ? s.inputErr : {}) }}
          type="number"
          min={0.1}
          max={500}
          step={0.1}
          placeholder="e.g. 2.5"
          value={form.plot_size_ha ?? ""}
          onChange={(e) => set("plot_size_ha", parseFloat(e.target.value))}
        />
        {errors.plot_size_ha && <span style={s.hint}>{errors.plot_size_ha}</span>}
      </label>

      {/* Water availability */}
      <label style={s.label}>
        💧 {t("waterAvailability")}
        <select
          style={s.select}
          value={form.water_availability}
          onChange={(e) =>
            set("water_availability", e.target.value as WaterAvailability)
          }
        >
          {WATER_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      {/* Budget */}
      <label style={s.label}>
        💰 {t("budget")}
        <input
          style={{ ...s.input, ...(errors.budget_inr ? s.inputErr : {}) }}
          type="number"
          min={1000}
          step={1000}
          placeholder="e.g. 50000"
          value={form.budget_inr ?? ""}
          onChange={(e) => set("budget_inr", parseInt(e.target.value, 10))}
        />
        {errors.budget_inr && <span style={s.hint}>{errors.budget_inr}</span>}
      </label>

      <button type="submit" style={s.btn} disabled={loading || (soilInfo !== null && soilConfirmed === null)}>
        {loading ? <><Spinner size={16} /> {t("fetchingCrops")}</> : t("findCrops")}
      </button>
    </form>
  );
}
