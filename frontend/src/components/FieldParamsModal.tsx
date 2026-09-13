import React, { useState } from "react";
import { Settings, Check, SlidersHorizontal } from "lucide-react";
import type { FarmerRequest, FarmerResponse, CropCandidate } from "../types/api";
import { submitFarmerInput, fetchCandidateCrops, extractErrorMessage } from "../services/apiClient";
import { useFarm } from "../context/FarmContext";

interface FieldParamsModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: (sess: FarmerResponse, crops: CropCandidate[], input: FarmerRequest) => void;
}

const SOIL_OPTIONS = [
  { key: "clay", label: "Clay", emoji: "🟤", desc: "Heavy, water-retaining" },
  { key: "black", label: "Black Cotton", emoji: "⚫", desc: "Rich, moisture-holding" },
  { key: "sandy", label: "Sandy", emoji: "🟡", desc: "Fast-draining, light" },
  { key: "loamy", label: "Loamy", emoji: "🌿", desc: "Balanced, fertile" },
  { key: "silt", label: "Silt", emoji: "🔵", desc: "Fine-grained, moderate" },
  { key: "laterite", label: "Laterite", emoji: "🔴", desc: "Iron-rich, acidic" },
];

const WATER_OPTIONS = [
  { key: "irrigated", label: "Well Irrigated", emoji: "💧", desc: "Drip / canal / borewell" },
  { key: "rainfed", label: "Rain-fed", emoji: "🌧️", desc: "Depends on monsoon" },
  { key: "partial", label: "Partial", emoji: "🌤️", desc: "Mixed irrigation" },
  { key: "low", label: "Low Water", emoji: "☀️", desc: "Semi-arid, drought-prone" },
];

export const FieldParamsModal: React.FC<FieldParamsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { farmerInput, updateFarmSetup, saveFarmerProfile } = useFarm();

  const [location, setLocation] = useState(farmerInput?.location || "Nashik, Maharashtra");
  const [plotSizeHa, setPlotSizeHa] = useState(farmerInput?.plot_size_ha ?? 2.5);
  const [soilType, setSoilType] = useState<string>(farmerInput?.soil_type || "clay");
  const [waterAvail, setWaterAvail] = useState<string>(farmerInput?.water_availability || "irrigated");
  const [budget, setBudget] = useState(farmerInput?.budget_inr ?? 120000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const input: FarmerRequest = {
        location: location.trim() || "Nashik, Maharashtra",
        plot_size_ha: plotSizeHa,
        soil_type: soilType as FarmerRequest["soil_type"],
        water_availability: waterAvail as FarmerRequest["water_availability"],
        budget_inr: budget,
      };
      const [session, crops] = await Promise.all([
        submitFarmerInput(input),
        fetchCandidateCrops(
          input.location,
          input.budget_inr,
          input.soil_type,
          input.water_availability,
          input.plot_size_ha
        ),
      ]);
      updateFarmSetup(session, crops, input);
      await saveFarmerProfile({
        location: input.location,
        soil_type: input.soil_type,
        irrigation_type: input.water_availability,
        budget_inr: input.budget_inr,
        area_acres: +(input.plot_size_ha * 2.47105).toFixed(2),
      }).catch(() => {});
      if (onSuccess) onSuccess(session, crops, input);
      if (onClose) onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(4, 20, 15, 0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "fpFadeIn 0.25s ease-out forwards",
      }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <style>{`
        @keyframes fpFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .fp-section-title {
          font-size: 11px;
          font-weight: 700;
          color: rgba(76, 255, 160, 0.8);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        .fp-grid-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(76, 255, 160, 0.18);
          background: rgba(8, 22, 26, 0.5);
          color: #F7FBF4;
          cursor: pointer;
          transition: all 0.18s ease;
          text-align: left;
          width: 100%;
        }
        .fp-grid-btn:hover {
          background: rgba(76, 255, 160, 0.1);
          border-color: rgba(76, 255, 160, 0.4);
        }
        .fp-grid-btn.fp-selected {
          background: rgba(76, 255, 160, 0.18);
          border-color: #4CFFA0;
          box-shadow: 0 0 14px rgba(76, 255, 160, 0.2);
        }
        .fp-input {
          width: 100%;
          background: rgba(8, 22, 26, 0.55);
          border: 1px solid rgba(76, 255, 160, 0.22);
          border-radius: 10px;
          padding: 11px 14px;
          color: #F7FBF4;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .fp-input:focus {
          border-color: #4CFFA0;
          box-shadow: 0 0 0 3px rgba(76,255,160,0.12);
        }
        .fp-input::placeholder { color: rgba(242,247,239,0.4); }
        .fp-save-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid rgba(76, 255, 160, 0.4);
          background: linear-gradient(135deg, #D2DBCB, #6EDB9B);
          color: #06251A;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 22px rgba(10, 26, 26, 0.35), 0 0 20px rgba(76, 255, 160, 0.3);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .fp-save-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.06);
        }
        .fp-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @keyframes fp-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          background: "rgba(10, 34, 26, 0.92)",
          border: "1px solid rgba(76, 255, 160, 0.3)",
          borderRadius: 18,
          padding: "28px",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 28px 70px rgba(0,0,0,0.65), 0 0 50px rgba(76,255,160,0.1)",
          color: "#F7FBF4",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "rgba(76,255,160,0.12)",
              border: "1px solid rgba(76,255,160,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#4CFFA0",
            }}>
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#FBFFFC" }}>Field Parameters</div>
              <div style={{ fontSize: 12, color: "rgba(242,247,239,0.6)" }}>Configure your farm's agronomic details</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "rgba(242,247,239,0.5)", fontSize: 22, cursor: "pointer", padding: "4px 8px", borderRadius: 8 }}
          >×</button>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 20 }}>
          <div className="fp-section-title">📍 Location</div>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Nashik, Maharashtra"
            className="fp-input"
          />
        </div>

        {/* Plot Size */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="fp-section-title" style={{ margin: 0 }}>📐 Plot Size</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4CFFA0" }}>{plotSizeHa} ha ({(plotSizeHa * 2.47105).toFixed(2)} acres)</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={plotSizeHa}
            onChange={(e) => setPlotSizeHa(+e.target.value)}
            style={{ width: "100%", accentColor: "#4CFFA0", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(242,247,239,0.4)", marginTop: 4 }}>
            <span>0.5 ha</span><span>10 ha</span><span>20 ha</span>
          </div>
        </div>

        {/* Soil Type */}
        <div style={{ marginBottom: 20 }}>
          <div className="fp-section-title">🌱 Soil Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {SOIL_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`fp-grid-btn ${soilType === opt.key ? "fp-selected" : ""}`}
                onClick={() => setSoilType(opt.key)}
              >
                <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: soilType === opt.key ? "#4CFFA0" : "#FBFFFC" }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(242,247,239,0.5)" }}>{opt.desc}</div>
                </div>
                {soilType === opt.key && (
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#4CFFA0", color: "#06251A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Water Availability */}
        <div style={{ marginBottom: 20 }}>
          <div className="fp-section-title">💧 Water Availability</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {WATER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`fp-grid-btn ${waterAvail === opt.key ? "fp-selected" : ""}`}
                onClick={() => setWaterAvail(opt.key)}
              >
                <span style={{ fontSize: 18 }}>{opt.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: waterAvail === opt.key ? "#4CFFA0" : "#FBFFFC" }}>{opt.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(242,247,239,0.5)" }}>{opt.desc}</div>
                </div>
                {waterAvail === opt.key && (
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#4CFFA0", color: "#06251A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="fp-section-title" style={{ margin: 0 }}>💰 Season Budget</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4CFFA0" }}>₹{budget.toLocaleString("en-IN")}</span>
          </div>
          <input
            type="range"
            min={20000}
            max={500000}
            step={5000}
            value={budget}
            onChange={(e) => setBudget(+e.target.value)}
            style={{ width: "100%", accentColor: "#4CFFA0", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(242,247,239,0.4)", marginTop: 4 }}>
            <span>₹20K</span><span>₹2.5L</span><span>₹5L</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          className="fp-save-btn"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "fp-spin 1s linear infinite" }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Applying Field Parameters…
            </>
          ) : (
            <>
              <Settings size={16} />
              Apply Field Parameters
            </>
          )}
        </button>
      </div>
    </div>
  );
};
