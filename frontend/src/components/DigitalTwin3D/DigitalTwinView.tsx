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

// ── Component ─────────────────────────────────────────────────────────────────

interface DigitalTwinViewProps {
  plotSize?: number;
  durationDays?: number;
  weatherByDay?: WeatherDay[];
  cropType?: string;
}

export default function DigitalTwinView({
  plotSize = 2.5,
  durationDays = 120,
  weatherByDay,
  cropType = "wheat_rabi",
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
        />
      </div>

      {/* ── Info overlay: crop type + day ── */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: "rgba(15, 23, 42, 0.75)",
          borderRadius: "8px",
          padding: "6px 12px",
          color: "#94A3B8",
          fontSize: "12px",
          fontFamily: "system-ui, sans-serif",
          pointerEvents: "none",
        }}
      >
        <span style={{ color: "#F8FAFC", fontWeight: 600 }}>
          {cropType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        {"  "}·{"  "}
        {plotSize} ha{"  "}·{"  "}
        {durationDays} days
        {!weatherByDay || weatherByDay.length === 0 ? (
          <span style={{ marginLeft: "8px", color: "#F59E0B" }}>
            [mock data]
          </span>
        ) : null}
      </div>

      {/* ── Timeline scrubber overlaid at bottom ── */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "clamp(300px, 70%, 600px)",
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
