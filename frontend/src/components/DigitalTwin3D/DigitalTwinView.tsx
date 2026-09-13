/**
 * DigitalTwinView — top-level 3D Digital Twin component.
 *
 * Wires PlotScene + TimelineScrubber together. Works standalone with mock
 * fallback data when props are initially empty (e.g. before simulation runs).
 *
 * Props:
 *   plotSize        hectares (default 2.5)
 *   durationDays    total growing days (default 120)
 *   weatherByDay    WeatherDay[] from /simulate; falls back to MOCK_WEATHER
 *   cropType        crop_id string (default "wheat_rabi")
 *   activeCropResult simulation result object for HUD display
 *
 * Internal state:
 *   currentDay      managed here; passed down to PlotScene + TimelineScrubber
 *   activeWeather   the currently active scenario array (p50 or p10)
 *
 * NO fetch / axios / hooks from useAgriTwin inside this file.
 */

import { useState, useCallback, useMemo } from "react";
import PlotScene from "./PlotScene";
import TimelineScrubber from "./TimelineScrubber";
import { getCropVisualProfile } from "./CropVisualRegistry";
import type { WeatherDay } from "../../types/api";

// ── Mock fallback data (used when weatherByDay is empty) ──────────────────────

function generateMockWeather(days: number): WeatherDay[] {
  return Array.from({ length: days }, (_, i) => {
    const cycle = i % 14;
    const isRainy = cycle >= 5 && cycle <= 7;
    const isHot = i > days * 0.6 && i % 5 === 0;
    return {
      day: i + 1,
      rainfall_mm: isRainy ? 8 + Math.random() * 10 : 0,
      temp_c: isHot ? 36 + Math.random() * 3 : 24 + Math.random() * 8,
      condition: isRainy
        ? "rainy"
        : isHot
        ? "stormy"
        : i % 3 === 0
        ? "cloudy"
        : "sunny",
    };
  });
}

/**
 * Generate a stressed p10 weather array from the baseline by amplifying heat
 * and reducing rainfall (simulates a severe stress year).
 */
function stressWeather(weather: WeatherDay[]): WeatherDay[] {
  return weather.map((d) => ({
    ...d,
    rainfall_mm: d.rainfall_mm * 0.35,         // 65% rainfall reduction
    temp_c: d.temp_c + (d.temp_c > 30 ? 4 : 0), // +4°C on hot days
    condition:
      d.condition === "rainy" && d.rainfall_mm * 0.35 < 2
        ? "sunny"
        : d.condition === "sunny" && d.temp_c + 4 > 38
        ? "stormy"
        : d.condition,
  }));
}

function calculateHealth(currentDay: number, weatherByDay: WeatherDay[]): number {
  if (!weatherByDay || weatherByDay.length === 0) return 100;
  let health = 100;
  const maxDay = Math.min(currentDay, weatherByDay.length - 1);
  for (let i = 0; i <= maxDay; i++) {
    const w = weatherByDay[i];
    if (w.temp_c > 35) health -= (w.temp_c - 35) * 0.3; // heat stress
    if (w.temp_c < 10) health -= (10 - w.temp_c) * 0.2; // cold stress
    if (w.condition === "stormy") health -= 2;          // storm damage
    if (w.rainfall_mm === 0 && w.temp_c > 32) health -= 0.5; // drought
    if (w.rainfall_mm > 5 && health < 100) health += 1; // recovery
  }
  return Math.max(0, Math.min(100, Math.round(health)));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DigitalTwinViewProps {
  plotSize?: number;
  durationDays?: number;
  weatherByDay?: WeatherDay[];
  cropType?: string;
  activeCropResult?: any;
}

export default function DigitalTwinView({
  plotSize = 2.5,
  durationDays = 120,
  weatherByDay,
  cropType = "wheat_rabi",
  activeCropResult,
}: DigitalTwinViewProps) {
  const [currentDay, setCurrentDay] = useState(0);
  const [activeWeather, setActiveWeather] = useState<WeatherDay[]>([]);

  // Use provided weather or generate mock fallback
  const baseWeather = useMemo<WeatherDay[]>(() => {
    if (weatherByDay && weatherByDay.length > 0) return weatherByDay;
    return generateMockWeather(durationDays);
  }, [weatherByDay, durationDays]);

  const stressedWeather = useMemo(() => stressWeather(baseWeather), [baseWeather]);

  const handleDayChange = useCallback((day: number) => {
    setCurrentDay(day);
  }, []);

  const handleWeatherChange = useCallback((weather: WeatherDay[]) => {
    setActiveWeather(weather);
  }, []);

  // Decide which weather to show in the scene: active (from scrubber) or base
  const sceneWeather = activeWeather.length > 0 ? activeWeather : baseWeather;
  const healthScore = calculateHealth(currentDay, sceneWeather);
  
  const cropProfile = useMemo(() => getCropVisualProfile(cropType), [cropType]);

  // HUD Data
  const growthPercent = Math.min(100, Math.round((currentDay / Math.max(1, durationDays)) * 100));
  const stageLabel =
    growthPercent < 10
      ? "Germination"
      : growthPercent < 35
      ? "Seedling"
      : growthPercent < 70
      ? "Vegetative"
      : growthPercent < 88
      ? "Flowering"
      : "Mature Canopy";

  const todayWeather = sceneWeather[Math.min(currentDay, sceneWeather.length - 1)];
  const currentTemp = todayWeather?.temp_c.toFixed(1) || "--";
  
  let recentRainfall = 0;
  for (let i = Math.max(0, currentDay - 2); i <= currentDay; i++) {
    recentRainfall += sceneWeather[i]?.rainfall_mm || 0;
  }

  const expectedYield = activeCropResult?.stats?.p50 
    ? `₹${(activeCropResult.stats.p50 / 1000).toFixed(1)}K` 
    : "--";
  const risk = activeCropResult?.market_crash_risk ? "High Risk (Market)" : "Normal";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: "400px",
        background: "#0F172A",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── 3D Canvas (fills available height) ── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <PlotScene
          plotSize={plotSize}
          cropDurationDays={durationDays}
          weatherByDay={sceneWeather}
          currentDay={currentDay}
          cropType={cropType}
          healthScore={healthScore}
          recentRainfall={recentRainfall}
        />
      </div>

      {/* ── Info HUD ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(6px)",
          border: "1px solid #334155",
          borderRadius: "10px",
          padding: "12px 16px",
          color: "#94A3B8",
          fontSize: "12px",
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minWidth: "230px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155", paddingBottom: "6px", marginBottom: "4px" }}>
          <span style={{ color: "#F8FAFC", fontWeight: 700, fontSize: "14px" }}>
            {cropProfile.name}
          </span>
          <span style={{
            background: growthPercent >= 88 ? "rgba(34, 197, 94, 0.2)" : "rgba(59, 130, 246, 0.2)",
            color: growthPercent >= 88 ? "#4ADE80" : "#60A5FA",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
          }}>
            {stageLabel}
          </span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Simulation Day</span>
          <strong style={{ color: "#E2E8F0" }}>{currentDay} / {durationDays}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Growth Progress</span>
          <strong style={{ color: "#22C55E" }}>{growthPercent}%</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Health Score</span>
          <strong style={{ color: healthScore > 80 ? "#22C55E" : healthScore > 50 ? "#F59E0B" : "#EF4444" }}>
            {healthScore}/100
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Temperature</span>
          <strong style={{ color: "#E2E8F0" }}>{currentTemp}°C</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Soil Moisture</span>
          <strong style={{ color: recentRainfall > 15 ? "#3B82F6" : recentRainfall > 5 ? "#E2E8F0" : "#F59E0B" }}>
            {recentRainfall > 15 ? "High" : recentRainfall > 5 ? "Optimal" : "Low"}
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "8px", borderTop: "1px solid #334155" }}>
          <span>Expected Yield</span>
          <strong style={{ color: "#E2E8F0" }}>{expectedYield}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Risk Level</span>
          <strong style={{ color: risk === "Normal" ? "#22C55E" : "#EF4444" }}>{risk}</strong>
        </div>
      </div>

      {/* ── Timeline scrubber overlaid at bottom ── */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          right: "24px",
          zIndex: 10,
          width: "400px",
        }}
      >
        <TimelineScrubber
          durationDays={durationDays}
          weatherP50={baseWeather}
          weatherP10={stressedWeather}
          onDayChange={handleDayChange}
          onWeatherChange={handleWeatherChange}
        />
      </div>
    </div>
  );
}
