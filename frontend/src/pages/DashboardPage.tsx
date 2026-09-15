import { useState } from "react";
import { Sprout, Globe, LogOut, ArrowRight, User, Sparkles, CloudRain, Sun, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { FeatureCard } from "../components/ui";
import FarmerInputForm from "../components/FarmerInputForm";
import { FieldParamsModal } from "../components/FieldParamsModal";
import { useFarm } from "../context/FarmContext";
import { getTranslation } from "../i18n";
import type { FarmerRequest, FarmerResponse, CropCandidate } from "../types/api";

interface DashboardPageProps {
  onNavigateSimulation: () => void;
  onNavigateChatbot: () => void;
  onNavigateCropPlan: () => void;
  onNavigateMarket: () => void;
  onLogout: () => void;
}

// Season calculation helper
function getCurrentSeason(): { name: string; icon: string } {
  const m = new Date().getMonth() + 1;
  if (m >= 6 && m <= 10) return { name: "Kharif Season (Monsoon)", icon: "🌧️" };
  if (m === 11 || m === 12 || m <= 3) return { name: "Rabi Season (Winter)", icon: "❄️" };
  return { name: "Zaid Season (Summer)", icon: "☀️" };
}

export default function DashboardPage({
  onNavigateSimulation,
  onNavigateChatbot,
  onNavigateCropPlan,
  onNavigateMarket,
  onLogout,
}: DashboardPageProps) {
  const {
    user,
    farmerInput,
    farmerProfile,
    saveFarmerProfile,
    crops,
    lang,
    setShowLanguageModal,
    updateFarmSetup,
  } = useFarm();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showFieldParamsModal, setShowFieldParamsModal] = useState(false);

  const season = getCurrentSeason();
  const topCrop = crops[0] || null;

  const handleFarmerSuccess = (
    sess: FarmerResponse,
    candidateCrops: CropCandidate[],
    input: FarmerRequest
  ) => {
    updateFarmSetup(sess, candidateCrops, input);
    saveFarmerProfile({
      location: input.location,
      soil_type: input.soil_type,
      irrigation_type: input.water_availability,
      budget_inr: input.budget_inr,
      area_acres: +(input.plot_size_ha * 2.47105).toFixed(2),
    }).catch(() => { });
    setShowEditModal(false);
  };

  const getLanguageLabel = () => {
    if (lang === "hi") return "हिंदी";
    if ((lang as string) === "both") return "English + हिंदी";
    return "English";
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      color: "#F7FBF4",
    }}>
      {/* Top Command Center Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px clamp(20px, 4vw, 48px)",
        background: "rgba(4, 20, 15, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(76, 255, 160, 0.2)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: "10px",
            background: "rgba(76, 255, 160, 0.15)",
            border: "1px solid rgba(76, 255, 160, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4CFFA0",
          }}>
            <Sprout size={22} />
          </div>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em", color: "#FBFFFC" }}>
              AgriSaathi
            </div>
            <div style={{ fontSize: "11px", color: "#4CFFA0", fontWeight: 600 }}>
              Command Center
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Field Parameters Button */}
          <button
            onClick={() => setShowFieldParamsModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(76, 255, 160, 0.08)",
              border: "1px solid rgba(76, 255, 160, 0.25)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#A7F3D0",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.18)";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.08)";
              e.currentTarget.style.color = "#A7F3D0";
            }}
            title="Configure field parameters"
          >
            <SlidersHorizontal size={14} />
            <span>{getTranslation(lang, "fieldSetup")}</span>
          </button>

          {/* Language Switcher Button */}
          <button
            onClick={() => setShowLanguageModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(76, 255, 160, 0.08)",
              border: "1px solid rgba(76, 255, 160, 0.25)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#A7F3D0",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.18)";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.08)";
              e.currentTarget.style.color = "#A7F3D0";
            }}
            title="Change preferred language"
          >
            <Globe size={14} />
            <span>{getLanguageLabel()}</span>
          </button>

          {/* User Profile Pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(8, 22, 26, 0.5)",
            border: "1px solid rgba(76, 255, 160, 0.2)",
            borderRadius: "20px",
            padding: "5px 12px",
            fontSize: "12.5px",
            color: "#F7FBF4",
          }}>
            <User size={14} color="#4CFFA0" />
            <span>{user?.username || "Farmer"}</span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              padding: "6px 12px",
              color: "#FCA5A5",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
              e.currentTarget.style.borderColor = "#EF4444";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
            }}
            title="Sign out to starting screen"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main style={{
        maxWidth: "1340px",
        width: "100%",
        margin: "0 auto",
        padding: "32px clamp(20px, 4vw, 48px) 60px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}>
        {/* Welcome & Farm Health Overview Banner */}
        <section style={{
          background: "linear-gradient(135deg, rgba(14, 46, 36, 0.55), rgba(6, 23, 19, 0.65))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(76, 255, 160, 0.28)",
          borderRadius: 18,
          padding: "28px clamp(20px, 3vw, 36px)",
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 28,
          alignItems: "center",
          boxShadow: "0 16px 50px rgba(0, 0, 0, 0.35)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: "18px" }}>🌱</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#4CFFA0", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                Active Farm Twin
              </span>
              {farmerProfile ? (
                <span style={{ fontSize: "11px", background: "rgba(76, 255, 160, 0.15)", color: "#4CFFA0", padding: "2px 8px", borderRadius: "10px", border: "1px solid rgba(76, 255, 160, 0.3)" }}>
                  ✓ Cloud Synced
                </span>
              ) : (
                <span style={{ fontSize: "11px", background: "rgba(234, 179, 8, 0.15)", color: "#FDE047", padding: "2px 8px", borderRadius: "10px", border: "1px solid rgba(234, 179, 8, 0.3)" }}>
                  ⚡ Default Setup (Click Edit to save)
                </span>
              )}
            </div>
            <h1 style={{ fontSize: "clamp(24px, 2.5vw, 32px)", fontWeight: 700, margin: "0 0 10px", color: "#FBFFFC" }}>
              {getTranslation(lang, "welcomeBack")}, {user?.username || "Farmer"}
            </h1>
            <p style={{ fontSize: "14.5px", color: "rgba(242, 247, 239, 0.8)", margin: "0 0 18px", lineHeight: 1.6, maxWidth: "54ch" }}>
              {getTranslation(lang, "dashboardWelcomeDesc")}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={() => setShowEditModal(true)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid rgba(76, 255, 160, 0.4)",
                  background: "rgba(76, 255, 160, 0.12)",
                  color: "#4CFFA0",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(76, 255, 160, 0.22)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(76, 255, 160, 0.12)";
                }}
              >
                <span>✏️ {getTranslation(lang, "editFieldParams")}</span>
              </button>

              <button
                onClick={onNavigateCropPlan}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid rgba(76, 255, 160, 0.4)",
                  background: "linear-gradient(135deg, #D2DBCB, #6EDB9B)",
                  color: "#06251A",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                }}
              >
                <span>{getTranslation(lang, "optimizeCropPlan")}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Quick Telemetry Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}>
            <div style={{
              background: "rgba(8, 24, 18, 0.35)",
              border: "1px solid rgba(76, 255, 160, 0.18)",
              borderRadius: 12,
              padding: "14px",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(242, 247, 239, 0.6)", textTransform: "uppercase", fontWeight: 700 }}>
                Location & Area
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#FBFFFC", marginTop: 4 }}>
                {farmerInput?.location || farmerProfile?.location || (farmerProfile?.district ? `${farmerProfile.district}${farmerProfile.state ? ', ' + farmerProfile.state : ''}` : "Nashik, Maharashtra")}
              </div>
              <div style={{ fontSize: "12px", color: "#4CFFA0", marginTop: 2 }}>
                {farmerInput?.plot_size_ha ? `${farmerInput.plot_size_ha} Hectares` : (farmerProfile?.area_acres ? `${farmerProfile.area_acres} Acres` : "2.5 Hectares")}
              </div>
            </div>

            <div style={{
              background: "rgba(8, 24, 18, 0.35)",
              border: "1px solid rgba(76, 255, 160, 0.18)",
              borderRadius: 12,
              padding: "14px",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(242, 247, 239, 0.6)", textTransform: "uppercase", fontWeight: 700 }}>
                Season & Climate
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#FBFFFC", marginTop: 4 }}>
                {season.name.split(" ")[0]}
              </div>
              <div style={{ fontSize: "12px", color: "#86EFAC", marginTop: 2 }}>
                {season.icon} Optimal window
              </div>
            </div>

            <div style={{
              background: "rgba(8, 24, 18, 0.35)",
              border: "1px solid rgba(76, 255, 160, 0.18)",
              borderRadius: 12,
              padding: "14px",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(242, 247, 239, 0.6)", textTransform: "uppercase", fontWeight: 700 }}>
                Soil & Water
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#FBFFFC", marginTop: 4, textTransform: "capitalize" }}>
                {farmerInput?.soil_type || "black"} Soil
              </div>
              <div style={{ fontSize: "12px", color: "#93C5FD", marginTop: 2, textTransform: "capitalize" }}>
                {farmerInput?.water_availability || "normal"} Water
              </div>
            </div>

            <div style={{
              background: "rgba(8, 24, 18, 0.35)",
              border: "1px solid rgba(76, 255, 160, 0.18)",
              borderRadius: 12,
              padding: "14px",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(242, 247, 239, 0.6)", textTransform: "uppercase", fontWeight: 700 }}>
                Allocated Budget
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#4CFFA0", marginTop: 4 }}>
                ₹{(farmerInput?.budget_inr || 120000).toLocaleString()}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(242, 247, 239, 0.7)", marginTop: 2 }}>
                {topCrop?.budget_flag === "within_budget" ? "✓ Within Target" : "Under Review"}
              </div>
            </div>
          </div>
        </section>

        {/* AgriSaathi Tools Section Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#FBFFFC" }}>
                {getTranslation(lang, "quickAccess")}
              </h2>
              <p style={{ fontSize: "13.5px", color: "rgba(242, 247, 239, 0.68)", margin: "4px 0 0" }}>
                {getTranslation(lang, "toolsSubtitle")}
              </p>
            </div>
          </div>

          {/* 4 Core Feature Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {/* 1. 3D Digital Twin */}
            <FeatureCard
              icon={<Sprout size={24} />}
              title={`🌱 ${getTranslation(lang, "simTitle")}`}
              description={getTranslation(lang, "simCardDesc")}
              actionText={getTranslation(lang, "navSimulation")}
              onClick={onNavigateSimulation}
              badge="3D Immersive"
            />

            {/* 2. AI Farm Assistant */}
            <FeatureCard
              icon={<Sparkles size={24} />}
              title={`💬 ${getTranslation(lang, "chatTitle")}`}
              description={getTranslation(lang, "chatCardDesc")}
              actionText={getTranslation(lang, "navChatbot")}
              onClick={onNavigateChatbot}
              badge="watsonx.ai Granite"
            />

            {/* 3. Crop Planning & Economics */}
            <FeatureCard
              icon={<Sun size={24} />}
              title={`🌾 ${getTranslation(lang, "navCropPlan")}`}
              description={getTranslation(lang, "cropPlanDesc")}
              actionText={getTranslation(lang, "navCropPlan")}
              onClick={onNavigateCropPlan}
              badge={`${crops.length} Evaluated`}
            />

            {/* 4. Mandi Market Prices */}
            <FeatureCard
              icon={<CloudRain size={24} />}
              title={`📈 ${getTranslation(lang, "marketPrices")}`}
              description={getTranslation(lang, "marketPricesDesc")}
              actionText={getTranslation(lang, "navMarketPrices")}
              onClick={onNavigateMarket}
              badge="Live Agmarknet"
            />
          </div>
        </div>

        {/* Environmental & Diversification Security Brief */}
        <section style={{
          background: "rgba(10, 34, 26, 0.35)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(76, 255, 160, 0.2)",
          borderRadius: 16,
          padding: "24px 26px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 24,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#86EFAC", fontWeight: 700, fontSize: "14px", marginBottom: 8 }}>
              <ShieldCheck size={18} />
              <span> {getTranslation(lang, "cropGrowthSim")}</span>
            </div>
            <p style={{ fontSize: "13.5px", color: "rgba(242, 247, 239, 0.8)", lineHeight: 1.6, margin: 0 }}>
              {getTranslation(lang, "cropGrowthSimDesc")}
            </p>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#86EFAC", fontWeight: 700, fontSize: "14px", marginBottom: 8 }}>
              <CloudRain size={18} />
              <span>{getTranslation(lang, "telemetryTitle")}</span>
            </div>
            <p style={{ fontSize: "13.5px", color: "rgba(242, 247, 239, 0.8)", lineHeight: 1.6, margin: 0 }}>
              {getTranslation(lang, "telemetryDesc")}
            </p>
          </div>
        </section>
      </main>

      {/* Field Params Modal */}
      <FieldParamsModal
        isOpen={showFieldParamsModal}
        onClose={() => setShowFieldParamsModal(false)}
      />

      {/* Edit Setup Modal */}
      {showEditModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          background: "rgba(4, 20, 15, 0.8)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "rgba(10, 34, 26, 0.92)",
            border: "1px solid rgba(76, 255, 160, 0.3)",
            borderRadius: 16,
            padding: "28px",
            maxWidth: "500px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: "20px", color: "#FBFFFC" }}>
                Update Field Setup
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(242, 247, 239, 0.6)",
                  fontSize: "22px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <FarmerInputForm onSuccess={handleFarmerSuccess} lang={lang} initialValues={farmerInput} />
          </div>
        </div>
      )}
    </div>
  );
}
