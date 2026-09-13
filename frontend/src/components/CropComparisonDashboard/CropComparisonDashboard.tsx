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
  AgronomyPlanResponse,
} from "../../types/api";
import AgronomyPlanModal from "./AgronomyPlanModal";
import { useFarm } from "../../context/FarmContext";

// ── Helpers ───────────────────────────────────────────────────────────────────
const budgetVariant = (f: BudgetFlag) =>
  f === "within_budget" ? "green" : f === "marginal" ? "amber" : "red";

const seasonEmoji: Record<string, string> = {
  rabi: "❄️", kharif: "🌧️", zaid: "☀️",
};

// Determine the current Indian agricultural season based on today's month
function getCurrentSeason(): string {
  const m = new Date().getMonth() + 1; // 1-12
  if (m >= 6 && m <= 10) return "kharif";
  if (m === 11 || m === 12 || m <= 3) return "rabi";
  return "zaid";
}
const CURRENT_SEASON = getCurrentSeason();

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
  
  // Agronomy Plan State
  const [agronomyPlan, setAgronomyPlan] = useState<AgronomyPlanResponse | null>(null);
  const [agronomyLoading, setAgronomyLoading] = useState<boolean>(false);
  const [showAgronomyModal, setShowAgronomyModal] = useState<boolean>(false);
  const [selectedCropForPlan, setSelectedCropForPlan] = useState<string>("");

  const [error, setError]           = useState<string | null>(null);
  const { setAiExplanation } = useFarm();

  const speakExplanation = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Language tag format mapping for SpeechSynthesis
    const langMap: Record<string, string> = {
      en: "en-IN", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN", ta: "ta-IN",
      te: "te-IN", gu: "gu-IN", kn: "kn-IN", pa: "pa-IN", ml: "ml-IN"
    };
    utterance.lang = langMap[lang] || "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // ── Search & filter state ─────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [filterSeason, setFilterSeason]   = useState<string>("all");
  const [filterBudget, setFilterBudget]   = useState<string>("all");

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(lang, key);

  const budgetLabel = (f: BudgetFlag) =>
    f === "within_budget" ? t("withinBudget")
      : f === "marginal"  ? t("marginalBudget")
      : t("overBudget");

  // ── Filtered + searched crop list ────────────────────────────────────────
  const visibleCrops = crops.filter((crop) => {
    if (search && !crop.name.toLowerCase().includes(search.toLowerCase()) &&
        !crop.crop_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSeason !== "all" && crop.season !== filterSeason) return false;
    if (filterBudget !== "all" && crop.budget_flag !== filterBudget) return false;
    return true;
  });

  // Auto-refresh explanations when language changes
  useEffect(() => {
    const explainedCrops = Object.keys(explanations);
    if (explainedCrops.length > 0) {
      explainedCrops.forEach((cropId) => {
        const result = simulationResults[cropId];
        if (result) {
          setExplLoading(cropId);
          fetchExplanation({ simulation_result: result, lang })
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

  const handleExplain = async (cropId: string): Promise<void> => {
    const result = simulationResults[cropId];
    if (!result) return;
    setExplLoading(cropId);
    try {
      const expl = await fetchExplanation({ simulation_result: result, lang });
      setExplanations((prev) => ({ ...prev, [cropId]: expl }));
      setAiExplanation({ cropId, explanation: expl });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setExplLoading(null);
    }
  };

  const handleFetchAgronomyPlan = async (cropId: string) => {
    setSelectedCropForPlan(cropId);
    setShowAgronomyModal(true);
    setAgronomyLoading(true);
    
    try {
      const apiLang = lang;
      const res = await fetch(`http://localhost:8000/api/agronomy/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          crop_id: cropId,
          lang: apiLang
        })
      });
      if (!res.ok) throw new Error("Failed to fetch agronomy plan");
      const data = await res.json();
      setAgronomyPlan(data);
    } catch (err) {
      setError(extractErrorMessage(err));
      setShowAgronomyModal(false);
    } finally {
      setAgronomyLoading(false);
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
            background: selected.size > 0 ? "#16A34A" : "rgba(8, 22, 26, 0.7)",
            border: "none", borderRadius: 8, padding: "9px 18px",
            color: selected.size > 0 ? "#fff" : "rgba(242,247,239,0.4)",
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
              background: "rgba(8, 22, 26, 0.7)",
              border: "1px solid rgba(76, 255, 160, 0.2)",
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

      {/* ── Search & Filter bar ── */}
      <div style={{ marginBottom: 14 }}>
        {/* Row 1: search + filter toggle */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search input */}
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "#64748B", fontSize: 14, pointerEvents: "none",
            }}>🔍</span>
            <input
              type="text"
              placeholder="Search crops by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
              width: "100%", boxSizing: "border-box" as const,
              background: "rgba(8, 22, 26, 0.7)", border: "1px solid rgba(76,255,160,0.2)", borderRadius: 8,
              padding: "8px 12px 8px 32px", color: "#F1F5F9", fontSize: 13, outline: "none",
            }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 16,
                }}
              >×</button>
            )}
          </div>

          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: showFilters ? "rgba(76,255,160,0.25)" : "rgba(8, 22, 26, 0.7)",
              border: `1px solid ${showFilters ? "#4CFFA0" : "rgba(76,255,160,0.2)"}`,
              borderRadius: 8, padding: "8px 14px",
              color: showFilters ? "#4CFFA0" : "#94A3B8",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const,
            }}
          >
            ⚙ Filters
            {(filterSeason !== "all" || filterBudget !== "all") && (
              <span style={{
                background: "#F59E0B", borderRadius: 999, width: 8, height: 8, display: "inline-block",
              }} />
            )}
          </button>

          {/* Result count */}
          <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap" as const }}>
            {visibleCrops.length} / {crops.length} crops
          </span>
        </div>

        {/* Row 2: filter chips — visible only when showFilters */}
        {showFilters && (
          <div style={{
            marginTop: 10, display: "flex", flexWrap: "wrap" as const, gap: 10,
            background: "rgba(8, 22, 26, 0.6)", border: "1px solid rgba(76,255,160,0.15)",
          borderRadius: 10, padding: "12px 14px",
          }}>
            {/* Season filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Season:</span>
              {(["all", "kharif", "rabi", "zaid"] as const).map((s) => (
                <button key={s}
                  onClick={() => setFilterSeason(s)}
                  style={{
                    background: filterSeason === s ? "rgba(76,255,160,0.25)" : "rgba(8, 22, 26, 0.7)",
                  border: "1px solid rgba(76,255,160,0.2)", borderRadius: 6, padding: "4px 10px",
                  color: filterSeason === s ? "#4CFFA0" : "#94A3B8",
                  fontSize: 12, cursor: "pointer", fontWeight: filterSeason === s ? 700 : 400,
                  }}
                >
                  {s === "all" ? "All" : s === "kharif" ? "🌧️ Kharif" : s === "rabi" ? "❄️ Rabi" : "☀️ Zaid"}
                </button>
              ))}
            </div>

            <div style={{ width: 1, background: "#334155", margin: "0 4px" }} />

            {/* Budget filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>Budget:</span>
              {(["all", "within_budget", "marginal", "over_budget"] as const).map((b) => (
                <button key={b}
                  onClick={() => setFilterBudget(b)}
                  style={{
                    background: filterBudget === b ? "rgba(76,255,160,0.25)" : "rgba(8, 22, 26, 0.7)",
                  border: "1px solid rgba(76,255,160,0.2)", borderRadius: 6, padding: "4px 10px",
                  color: filterBudget === b ? "#4CFFA0" : "#94A3B8",
                  fontSize: 12, cursor: "pointer", fontWeight: filterBudget === b ? 700 : 400,
                  }}
                >
                  {b === "all" ? "All" : b === "within_budget" ? "✅ Within" : b === "marginal" ? "⚠️ Marginal" : "❌ Over"}
                </button>
              ))}
            </div>

            {/* Reset filters */}
            {(filterSeason !== "all" || filterBudget !== "all" || search) && (
              <button
                onClick={() => { setFilterSeason("all"); setFilterBudget("all"); setSearch(""); }}
                style={{
                  marginLeft: "auto", background: "none", border: "1px solid #475569",
                  borderRadius: 6, padding: "4px 10px", color: "#64748B",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                ✕ Reset all
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Crop cards grid ── */}
      {visibleCrops.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          color: "rgba(242,247,239,0.4)", fontSize: 14,
          border: "1px dashed rgba(76,255,160,0.2)", borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
          <div style={{ fontWeight: 600, color: "#64748B" }}>No crops match your filters</div>
          <div style={{ marginTop: 4, fontSize: 12 }}>
            Try adjusting the search or clearing your filters.
          </div>
        </div>
      ) : (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {visibleCrops.map((crop) => {
          const isSelected = selected.has(crop.crop_id);
          const result     = simulationResults[crop.crop_id];
          const isOptimal  = crop.crop_id === optimalCropId && !!result;
          const expl       = explanations[crop.crop_id];
          const isOver     = crop.budget_flag === "over_budget";
          const isInSeason = crop.season === CURRENT_SEASON;

          return (
            <div
              key={crop.crop_id}
              onClick={() => toggleSelect(crop.crop_id)}
              style={{
                background: "linear-gradient(135deg, rgba(10, 34, 26, 0.85), rgba(6, 23, 19, 0.9))",
              border: `2px solid ${isSelected ? "#4CFFA0" : isOptimal ? "#F59E0B" : "rgba(76,255,160,0.2)"}`,
              borderRadius: 12,
              padding: 16,
              cursor: "pointer",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxShadow: isSelected ? "0 0 0 3px rgba(76,255,160,0.2)" : "none",
              position: "relative" as const,
              opacity: isInSeason ? 1 : 0.75,
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
                  <div style={{ color: "#F7FBF4", fontWeight: 700, fontSize: 15 }}>
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
                {isInSeason && (
                  <Badge variant="green">🌱 In Season</Badge>
                )}
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
                        background: "rgba(8, 22, 26, 0.7)", borderRadius: 8,
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

                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {/* Explain button */}
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleExplain(crop.crop_id).then(() => {
                          // After explanation loads, navigate to simulation with AI context
                          onCropSelected(crop.crop_id, result);
                        });
                      }}
                      style={{
                        flex: 1,
                        background: "rgba(6, 20, 50, 0.6)", border: "1px solid rgba(76,130,220,0.4)",
                        borderRadius: 8, padding: "7px 0",
                        color: "#93C5FD", fontSize: 12, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {explLoading === crop.crop_id
                        ? <><Spinner size={12} /> {t("askingAI")}</>
                        : t("explainBtn")}
                    </button>

                    {/* Agronomy Plan button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFetchAgronomyPlan(crop.crop_id); }}
                      style={{
                        background: "rgba(4, 50, 30, 0.7)", border: "1px solid rgba(16,185,129,0.45)",
                        borderRadius: 8, padding: "7px 0",
                        color: "#6EE7B7", fontSize: 12, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                    🧪 Care Plan
                    </button>
                  </div>

                  {/* Explanation box */}
                  {expl && (
                    <div style={{
                      marginTop: 10, background: "rgba(4, 20, 15, 0.7)",
                      borderRadius: 8, padding: "10px 12px",
                      border: "1px solid rgba(76, 255, 160, 0.15)",
                    }}>
                      {/* Dynamically get text corresponding to selected lang */}
                      {expl[`text_${lang}` as keyof typeof expl] && typeof expl[`text_${lang}` as keyof typeof expl] === "string" && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                          <p style={{ color: "#CBD5E1", fontSize: 12, margin: 0, lineHeight: 1.6, flex: 1 }}>
                            {expl[`text_${lang}` as keyof typeof expl] as string}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); speakExplanation(expl[`text_${lang}` as keyof typeof expl] as string); }}
                            style={{
                              background: "transparent", border: "none", color: "#94A3B8",
                              cursor: "pointer", padding: 0, fontSize: 14,
                            }}
                            title="Listen"
                          >
                            🔊
                          </button>
                        </div>
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
      )}

      {showAgronomyModal && (
        <AgronomyPlanModal
          plan={agronomyPlan}
          cropName={selectedCropForPlan}
          lang={lang}
          isLoading={agronomyLoading}
          onClose={() => {
            setShowAgronomyModal(false);
            setAgronomyPlan(null);
          }}
        />
      )}
    </div>
  );
}
