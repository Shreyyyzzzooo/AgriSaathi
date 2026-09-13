import { useState } from "react";
import { PageHeader, Badge } from "../components/ui";
import CropComparisonDashboard from "../components/CropComparisonDashboard";
import FarmerInputForm from "../components/FarmerInputForm";
import { useFarm } from "../context/FarmContext";
import type { CropResult, FarmerRequest, FarmerResponse, CropCandidate } from "../types/api";

interface CropPlanPageProps {
  onBack: () => void;
  onNavigateSimulation: () => void;
}

export default function CropPlanPage({ onBack, onNavigateSimulation }: CropPlanPageProps) {
  const {
    farmerInput,
    farmerProfile,
    saveFarmerProfile,
    session,
    crops,
    simResults,
    setSimResults,
    setActiveCrop,
    lang,
    setLanguage,
    updateFarmSetup,
  } = useFarm();

  const [showEditModal, setShowEditModal] = useState(false);

  const sessionId = session?.session_id || "sess_demo_default";
  const budget = farmerInput?.budget_inr || 120000;

  const handleSimulated = (results: Record<string, CropResult & { market_crash_risk?: boolean }>) => {
    setSimResults(results);
  };

  const handleCropSelected = (_cropId: string, result: CropResult) => {
    setActiveCrop(result);
    onNavigateSimulation();
  };

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
    }).catch(() => {});
    setShowEditModal(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "linear-gradient(180deg, #04140F 0%, #0A2A1E 26%, #123D2A 50%, #061713 100%)",
      display: "flex",
      flexDirection: "column",
      color: "#F7FBF4",
    }}>
      <PageHeader
        title="🌾 Crop Planning & Economics"
        subtitle="Explore ICAR-benchmarked crops suited to your field, compare profit distributions, and simulate yield"
        onBack={onBack}
        actions={
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(76, 255, 160, 0.3)",
              background: "rgba(76, 255, 160, 0.12)",
              color: "#4CFFA0",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.22)";
              e.currentTarget.style.borderColor = "#4CFFA0";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(76, 255, 160, 0.12)";
              e.currentTarget.style.borderColor = "rgba(76, 255, 160, 0.3)";
            }}
          >
            ✏️ Edit Farm Setup
          </button>
        }
      />

      {/* Farm Context Summary Strip */}
      <div style={{
        padding: "16px 28px",
        background: "rgba(10, 34, 26, 0.55)",
        borderBottom: "1px solid rgba(76, 255, 160, 0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Badge variant="green">
            📍 {farmerInput?.location || farmerProfile?.location || (farmerProfile?.district ? `${farmerProfile.district}${farmerProfile.state ? ', ' + farmerProfile.state : ''}` : "Nashik, Maharashtra")}
          </Badge>
          <Badge variant="blue">
            🌱 Soil: {farmerInput?.soil_type || "black"}
          </Badge>
          <Badge variant="muted">
            💧 Water: {farmerInput?.water_availability || "normal"}
          </Badge>
          <Badge variant="muted">
            📐 Plot: {farmerInput?.plot_size_ha || 2.5} ha
          </Badge>
          <Badge variant="amber">
            💰 Budget: ₹{(farmerInput?.budget_inr || 120000).toLocaleString()}
          </Badge>
        </div>

        <div style={{ fontSize: "13px", color: "rgba(242, 247, 239, 0.7)" }}>
          {crops.length} Recommended crops evaluated
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        maxWidth: "1400px",
        width: "100%",
        margin: "0 auto",
        padding: "28px 24px 60px",
      }}>
        <CropComparisonDashboard
          sessionId={sessionId}
          crops={crops}
          budget={budget}
          simulationResults={simResults}
          onSimulated={handleSimulated}
          onCropSelected={handleCropSelected}
          lang={lang}
          setLang={setLanguage}
        />
      </div>

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
