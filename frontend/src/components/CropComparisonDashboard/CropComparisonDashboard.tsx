import { useState, useEffect } from "react";
import { runSimulation, fetchExplanation, extractErrorMessage } from "../../services/apiClient";
import { Badge, SkeletonCard, ErrorBanner, Spinner } from "../ui";
import ProfitHistogram from "./ProfitHistogram";
import { getTranslation, type Language } from "../../i18n";
import type {
  CropCandidate,
  CropResult,
  ExplainResponse,
  BudgetFlag,
} from "../../types/api";

// ── Helpers ───────────────────────────────────────────────────────────────────
const budgetVariant = (f: BudgetFlag) =>
  f === "within_budget" ? "green" : f === "marginal" ? "amber" : "red";

const seasonEmoji: Record<string, string> = {
  rabi: "❄️", kharif: "🌧️", zaid: "☀️",
};

function fmt(n: number): string {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000)   return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${Math.round(n)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CropComparisonDashboardProps {
  sessionId: string;
  crops: CropCandidate[];
  budget: number;
  simulationResults: Record<string, CropResult & { market_crash_risk?: boolean }>;
  onSimulated: (results: Record<string, CropResult & { market_crash_risk?: boolean }>) => void;
  onCropSelected: (cropId: string, result: CropResult) => void;
  lang: Language;
  setLang: (l: Language) => void;
}

export default function CropComparisonDashboard({
  sessionId,
  crops,
  budget,
  simulationResults,
  onSimulated,
  onCropSelected,
  lang,
  setLang,
}: CropComparisonDashboardProps) {
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [simLoading, setSimLoading] = useState(false);
  const [explLoading, setExplLoading] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, ExplainResponse>>({});
  const [error, setError]           = useState<string | null>(null);

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

  const budgetLabel = (f: BudgetFlag) =>
    f === "within_budget" ? t("withinBudget")
      : f === "marginal"  ? t("marginalBudget")
      : t("overBudget");

  // Auto-refresh explanations when language changes
  useEffect(() => {
    const explainedCrops = Object.keys(explanations);
    if (explainedCrops.length > 0) {
      explainedCrops.forEach((cropId) => {
        const result = simulationResults[cropId];
        if (result) {
          setExplLoading(cropId);
          fetchExplanation({ simulation_result: result, lang: lang === "all" ? "en" : lang })
            .then((expl) => setExplanations((prev) => ({ ...prev, [cropId]: expl })))
            .catch((err) => setError(extractErrorMessage(err)))
            .finally(() => setExplLoading(null));
        }
      });
    }
  }, [lang, simulationResults]);

  // Determine optimal crop
  const optimalCropId = Object.entries(simulationResults).reduce<string | null>(
    (best, [id, r]) =>
      best === null || r.stats.p50 > (simulationResults[best]?.stats.p50 ?? -Infinity)
        ? id : best,
    null
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleSimulate = async () => {
    if (selected.size === 0) return;
    setSimLoading(true);
    setError(null);
    try {
      const resp = await runSimulation({
        session_id: sessionId,
        selected_crops: [...selected],
        monte_carlo_runs: 500,
      });
      const map: Record<string, CropResult> = {};
      resp.results.forEach((r) => { map[r.crop_id] = r; });
      onSimulated(map);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSimLoading(false);
    }
  };

  const handleExplain = async (cropId: string) => {
    const result = simulationResults[cropId];
    if (!result) return;
    setExplLoading(cropId);
    try {
      // If "all", we still fetch explanation in English or both based on what the backend supports.
      // Wait, backend supports "all". So we pass "all".
      const apiLang = lang === "all" ? "all" : lang;
      const expl = await fetchExplanation({ simulation_result: result, lang: apiLang });
      setExplanations((prev) => ({ ...prev, [cropId]: expl }));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setExplLoading(null);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Simulate controls ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={handleSimulate}
          disabled={selected.size === 0 || simLoading}
          style={{
            background: selected.size > 0 ? "#16A34A" : "#1E293B",
            border: "none", borderRadius: 8, padding: "9px 18px",
            color: selected.size > 0 ? "#fff" : "#475569",
            fontSize: 13, fontWeight: 700, cursor: selected.size > 0 ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {simLoading ? <><Spinner size={14} />{t("simulating")}</> : `▶ ${t("simulate")} ${selected.size > 0 ? `(${selected.size})` : ""}`}
        </button>

        <span style={{ fontSize: 12, color: "#64748B" }}>
          Select crops below to include in Monte Carlo simulation
        </span>

        {/* Language toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "4px 8px",
              color: "#94A3B8",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="bn">বাংলা (Bengali)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="gu">ગુજરાતી (Gujarati)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
            <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
            <option value="ml">മലയാളം (Malayalam)</option>
          </select>
        </div>
      </div>

      {/* ── Crop cards grid ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {crops.map((crop) => {
          const isSelected = selected.has(crop.crop_id);
          const result     = simulationResults[crop.crop_id];
          const isOptimal  = crop.crop_id === optimalCropId && !!result;
          const expl       = explanations[crop.crop_id];
          const isOver     = crop.budget_flag === "over_budget";

          return (
            <div
              key={crop.crop_id}
              onClick={() => toggleSelect(crop.crop_id)}
              style={{
                background: "#1E293B",
                border: `2px solid ${isSelected ? "#22C55E" : isOptimal ? "#F59E0B" : "#334155"}`,
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxShadow: isSelected ? "0 0 0 3px rgba(34,197,94,0.15)" : "none",
                position: "relative" as const,
              }}
            >
              {/* Optimal badge */}
              {isOptimal && (
                <div style={{ position: "absolute", top: -10, left: 12 }}>
                  <Badge variant="amber">{t("optimalCropFit")}</Badge>
                </div>
              )}

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: isOptimal ? 8 : 0 }}>
                <div>
                  <div style={{ color: "#F1F5F9", fontWeight: 700, fontSize: 15 }}>
                    {seasonEmoji[crop.season] ?? "🌱"} {crop.name}
                  </div>
                  <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>
                    {crop.season} · {crop.duration_days} days · {crop.crop_id}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  style={{ marginTop: 4, width: 16, height: 16, cursor: "pointer", accentColor: "#22C55E" }}
                />
              </div>

              {/* Badges row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                <Badge variant={budgetVariant(crop.budget_flag)}>
                  {budgetLabel(crop.budget_flag)}
                </Badge>
                {isOver && (
                  <Badge variant="red">{t("exceedsBudget")} ₹{(budget / 1000).toFixed(0)}K</Badge>
                )}
              </div>

              {/* Simulation stats */}
              {simLoading && isSelected && !result && (
                <div style={{ marginTop: 12 }}>
                  <SkeletonCard rows={2} height={12} />
                </div>
              )}

              {result && (
                <>
                  {/* Market crash warning */}
                  {result.market_crash_risk && (
                    <div style={{ marginTop: 10 }}>
                      <Badge variant="amber">
                        {t("marketCrashRisk")}
                      </Badge>
                    </div>
                  )}

                  {/* Profit stats */}
                  <div style={{
                    marginTop: 12, display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 6,
                  }}>
                    {[
                      { label: "p10",  value: result.stats.p10,  color: "#EF4444" },
                      { label: "p50",  value: result.stats.p50,  color: "#22C55E" },
                      { label: "p90",  value: result.stats.p90,  color: "#3B82F6" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: "#0F172A", borderRadius: 8,
                        padding: "6px 8px", textAlign: "center" as const,
                      }}>
                        <div style={{ fontSize: 10, color: "#64748B" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>
                          {fmt(value)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Histogram */}
                  <ProfitHistogram stats={result.stats} cropName={crop.name} />

                  {/* Explain button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExplain(crop.crop_id); onCropSelected(crop.crop_id, result); }}
                    style={{
                      marginTop: 10, width: "100%",
                      background: "#1E3A5F", border: "1px solid #3B82F6",
                      borderRadius: 8, padding: "7px 0",
                      color: "#93C5FD", fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {explLoading === crop.crop_id
                      ? <><Spinner size={12} /> {t("askingGranite")}</>
                      : t("explainBtn")}
                  </button>

                  {/* Explanation box */}
                  {expl && (
                    <div style={{
                      marginTop: 10, background: "#0F172A",
                      borderRadius: 8, padding: "10px 12px",
                      border: "1px solid #1E3A5F",
                    }}>
                      {/* Dynamically get text corresponding to selected lang */}
                      {expl[`text_${lang}` as keyof typeof expl] && typeof expl[`text_${lang}` as keyof typeof expl] === "string" && (
                        <p style={{ color: "#CBD5E1", fontSize: 12, margin: "0 0 8px 0", lineHeight: 1.6 }}>
                          {expl[`text_${lang}` as keyof typeof expl] as string}
                        </p>
                      )}
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {expl.reasoning_bullets.map((b, i) => (
                          <li key={i} style={{ color: "#94A3B8", fontSize: 11, lineHeight: 1.6 }}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
