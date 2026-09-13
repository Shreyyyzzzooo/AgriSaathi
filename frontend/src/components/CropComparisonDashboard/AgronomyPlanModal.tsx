import React from "react";
import type { AgronomyPlanResponse } from "../../types/api";

interface AgronomyPlanModalProps {
  plan: AgronomyPlanResponse | null;
  cropName: string;
  onClose: () => void;
  isLoading: boolean;
  lang: string;
}

export default function AgronomyPlanModal({ plan, cropName, onClose, isLoading, lang }: AgronomyPlanModalProps) {
  if (!isLoading && !plan) return null;

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: "en-IN", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN", ta: "ta-IN",
      te: "te-IN", gu: "gu-IN", kn: "kn-IN", pa: "pa-IN", ml: "ml-IN"
    };
    utterance.lang = langMap[lang] || "en-IN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.6)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20
    }}>
      <div style={{
        background: "#0F172A", border: "1px solid #1E293B", borderRadius: 16,
        width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 24px", borderBottom: "1px solid #1E293B",
          position: "sticky", top: 0, background: "#0F172A", zIndex: 10
        }}>
          <h2 style={{ margin: 0, color: "#F1F5F9", fontSize: 18 }}>
            🧪 Care Plan: {cropName.replace("_", " ").toUpperCase()}
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#64748B", fontSize: 24, cursor: "pointer"
          }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {isLoading ? (
            <div style={{ textAlign: "center", color: "#94A3B8", padding: "40px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>🧠</div>
              <div>Generating expert agronomy plan...</div>
            </div>
          ) : plan ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* General Advice */}
              <div style={{ background: "#1E293B", padding: 16, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, color: "#38BDF8", fontSize: 14 }}>ℹ️ General Advice</h3>
                  <button onClick={() => speakText(plan.general_advice)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8" }}>🔊</button>
                </div>
                <p style={{ margin: 0, color: "#CBD5E1", fontSize: 13, lineHeight: 1.6 }}>
                  {plan.general_advice}
                </p>
              </div>

              {/* Fertilizers */}
              <div>
                <h3 style={{ margin: "0 0 12px 0", color: "#22C55E", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  🌿 Fertilizer Schedule
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {plan.fertilizers.map((f, i) => (
                    <div key={i} style={{ border: "1px solid #334155", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong style={{ color: "#F1F5F9", fontSize: 13 }}>{f.name}</strong>
                        <span style={{ background: "#064E3B", color: "#34D399", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>{f.timing}</span>
                      </div>
                      <div style={{ color: "#94A3B8", fontSize: 12, marginBottom: 4 }}><strong>Dosage:</strong> {f.dosage}</div>
                      <div style={{ color: "#CBD5E1", fontSize: 12 }}>{f.reasoning}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pesticides */}
              <div>
                <h3 style={{ margin: "0 0 12px 0", color: "#F59E0B", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  🛡️ Plant Protection
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {plan.pesticides.map((p, i) => (
                    <div key={i} style={{ border: "1px solid #334155", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <strong style={{ color: "#F1F5F9", fontSize: 13 }}>{p.name}</strong>
                        <span style={{ background: "#78350F", color: "#FBBF24", padding: "2px 8px", borderRadius: 999, fontSize: 11 }}>{p.target}</span>
                      </div>
                      <div style={{ color: "#94A3B8", fontSize: 12, marginBottom: 4 }}><strong>Dosage:</strong> {p.dosage}</div>
                      <div style={{ color: "#CBD5E1", fontSize: 12 }}>{p.reasoning}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
