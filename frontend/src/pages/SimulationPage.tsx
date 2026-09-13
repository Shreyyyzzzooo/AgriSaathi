import { useState, useMemo, useRef, useEffect } from "react";
import { Volume2, Square } from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { DigitalTwinView } from "../components/DigitalTwin3D";
import { useFarm } from "../context/FarmContext";
import { getTranslation } from "../i18n";

interface SimulationPageProps {
  onBack: () => void;
}

export default function SimulationPage({ onBack }: SimulationPageProps) {
  const { farmerInput, farmerProfile, crops, simResults, activeCrop, setActiveCrop, aiExplanation, lang } = useFarm();
  const simulationRef = useRef<HTMLDivElement>(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Selected crop ID for 3D visualization
  const availableCrops = useMemo(() => {
    if (crops && crops.length > 0) return crops;
    return [
      { crop_id: "wheat_rabi", name: "Wheat (गेहूं)", season: "rabi" as const, duration_days: 120, budget_flag: "within_budget" as const },
      { crop_id: "cotton_kharif", name: "Cotton (कपास)", season: "kharif" as const, duration_days: 160, budget_flag: "within_budget" as const },
      { crop_id: "soybean_kharif", name: "Soybean (सोयाबीन)", season: "kharif" as const, duration_days: 100, budget_flag: "within_budget" as const },
    ];
  }, [crops]);

  const [selectedCropId, setSelectedCropId] = useState<string>(() => {
    if (activeCrop) return activeCrop.crop_id;
    if (Object.keys(simResults).length > 0) return Object.keys(simResults)[0];
    return availableCrops[0]?.crop_id || "wheat_rabi";
  });

  // Current crop data
  const currentCandidate = availableCrops.find((c) => c.crop_id === selectedCropId) || availableCrops[0];
  const currentResult = simResults[selectedCropId] || activeCrop || null;
  const weatherDays = currentResult?.weather_by_day || [];
  const duration = currentCandidate?.duration_days || 120;
  const plotSize = farmerInput?.plot_size_ha || 2.5;

  const handleSelectCrop = (id: string) => {
    setSelectedCropId(id);
    if (simResults[id]) {
      setActiveCrop(simResults[id]);
    }
  };

  // Check if there's an AI explanation for the currently selected crop
  const hasAiExplanation = aiExplanation && aiExplanation.cropId === selectedCropId;
  const explanationText = hasAiExplanation
    ? (aiExplanation.explanation[`text_${lang}` as keyof typeof aiExplanation.explanation] as string | null) ||
      aiExplanation.explanation.text_en ||
      null
    : null;
  const explanationBullets = hasAiExplanation ? aiExplanation.explanation.reasoning_bullets : [];

  const scrollToSimulation = () => {
    simulationRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleTTS = () => {
    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
    } else {
      if (explanationText) {
        const fullText = explanationText + " " + explanationBullets.join(". ");
        const utterance = new SpeechSynthesisUtterance(fullText);
        
        if (lang === "hi") utterance.lang = "hi-IN";
        else if (lang === "mr") utterance.lang = "mr-IN";
        else if (lang === "bn") utterance.lang = "bn-IN";
        else if (lang === "ta") utterance.lang = "ta-IN";
        else if (lang === "te") utterance.lang = "te-IN";
        else if (lang === "gu") utterance.lang = "gu-IN";
        else if (lang === "kn") utterance.lang = "kn-IN";
        else if (lang === "ml") utterance.lang = "ml-IN";
        else utterance.lang = "en-IN";

        utterance.onend = () => setIsPlayingTTS(false);
        utterance.onerror = () => setIsPlayingTTS(false);
        window.speechSynthesis.speak(utterance);
        setIsPlayingTTS(true);
      }
    }
  };

  return (
    <div style={{
      width: "100%",
      display: "flex",
      flexDirection: "column",
      color: "#F7FBF4",
    }}>
      {/* Top UI Section */}
      <div style={{ display: "flex", flexDirection: "column" }}>


        <div style={{ background: "rgba(4, 20, 15, 0.75)", backdropFilter: "blur(8px)" }}>
          <PageHeader
            title={`🌱 ${getTranslation(lang, "simTitle")}`}
            subtitle={getTranslation(lang, "simSubtitle")}
            onBack={onBack}
            actions={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge variant="green">
                  📍 {farmerInput?.location || farmerProfile?.location || (farmerProfile?.district ? `${farmerProfile.district}${farmerProfile.state ? ', ' + farmerProfile.state : ''}` : "Nashik, Maharashtra")} ({plotSize} ha)
                </Badge>
              </div>
            }
          />
        </div>

      {/* AI Explanation Panel — shown when coming via "Explain with AI" */}
      {hasAiExplanation && (
        <div style={{
          background: "linear-gradient(135deg, rgba(10, 34, 26, 0.92), rgba(6, 23, 19, 0.95))",
          borderBottom: "1px solid rgba(76, 255, 160, 0.25)",
          padding: "24px clamp(16px, 4vw, 40px)",
        }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(76,255,160,0.12)",
                border: "1px solid rgba(76,255,160,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#4CFFA0",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 20 }}>✨</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#FBFFFC" }}>
                  AI Analysis — {currentCandidate?.name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(242,247,239,0.6)" }}>
                  watsonx.ai Granite agronomic insights for your field
                </div>
              </div>
              <button
                onClick={handleTTS}
                style={{
                  marginLeft: "auto",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: isPlayingTTS ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(139,92,246,0.35)",
                  background: isPlayingTTS ? "rgba(239,68,68,0.12)" : "rgba(139,92,246,0.12)",
                  color: isPlayingTTS ? "#FCA5A5" : "#A78BFA",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isPlayingTTS ? (
                  <>
                    <Square size={16} fill="currentColor" /> Stop Audio
                  </>
                ) : (
                  <>
                    <Volume2 size={16} /> Read Aloud
                  </>
                )}
              </button>

              <button
                onClick={scrollToSimulation}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(76,255,160,0.35)",
                  background: "rgba(76,255,160,0.12)",
                  color: "#4CFFA0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ↓ Jump to Simulation
              </button>
            </div>

            {/* Main explanation text */}
            {explanationText && (
              <div style={{
                background: "rgba(4, 20, 15, 0.6)",
                border: "1px solid rgba(76,255,160,0.2)",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 14,
                color: "rgba(242,247,239,0.9)",
                lineHeight: 1.7,
                marginBottom: 14,
              }}>
                {explanationText}
              </div>
            )}

            {/* Reasoning bullets */}
            {explanationBullets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(76,255,160,0.8)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
                  Key Insights
                </div>
                {explanationBullets.map((bullet, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    background: "rgba(4, 20, 15, 0.5)",
                    border: "1px solid rgba(76,255,160,0.12)",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "rgba(76,255,160,0.15)",
                      border: "1px solid rgba(76,255,160,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#4CFFA0",
                      flexShrink: 0, marginTop: 1,
                    }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: 13.5, color: "rgba(242,247,239,0.85)", lineHeight: 1.6 }}>
                      {bullet}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

        <div style={{
          padding: "12px 28px",
          background: "rgba(4, 20, 15, 0.65)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(76, 255, 160, 0.15)",
          display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "13px", color: "rgba(242, 247, 239, 0.7)", fontWeight: 600 }}>
            Visualized Crop:
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableCrops.map((c) => {
              const isSelected = c.crop_id === selectedCropId;
              return (
                <button
                  key={c.crop_id}
                  onClick={() => handleSelectCrop(c.crop_id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    border: isSelected
                      ? "1px solid #4CFFA0"
                      : "1px solid rgba(76, 255, 160, 0.2)",
                    background: isSelected
                      ? "rgba(76, 255, 160, 0.2)"
                      : "rgba(8, 22, 26, 0.5)",
                    color: isSelected ? "#4CFFA0" : "#F7FBF4",
                    fontSize: "12.5px",
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 0 12px rgba(76, 255, 160, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "12.5px", color: "rgba(242, 247, 239, 0.75)" }}>
          <span>Duration: <strong style={{ color: "#4CFFA0" }}>{duration} Days</strong></span>
          <span>•</span>
          <span>Soil: <strong style={{ color: "#4CFFA0" }}>{farmerInput?.soil_type || "clay"}</strong></span>
          <span>•</span>
          <span>Water: <strong style={{ color: "#4CFFA0" }}>{farmerInput?.water_availability || "irrigated"}</strong></span>
        </div>
        </div>
      </div>

      {/* Full-Screen Simulation Section */}
      <div 
        ref={simulationRef}
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
        }}
      >
        <DigitalTwinView
          plotSize={plotSize}
          durationDays={duration}
          weatherByDay={weatherDays}
          cropType={selectedCropId}
          activeCropResult={currentResult}
        />
      </div>
    </div>
  );
}
