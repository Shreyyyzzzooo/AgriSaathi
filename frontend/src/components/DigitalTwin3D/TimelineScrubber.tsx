/**
 * TimelineScrubber — day slider with play/pause and scenario toggle.
 *
 * Controls:
 *   - Range slider: Day 0 → durationDays
 *   - Play / Pause button: auto-animates at ~2 days per second
 *   - Mode toggle: "Typical (p50)" vs "Severe Stress (p10)"
 *     Swaps the active weatherByDay array passed up via onWeatherChange.
 *
 * No API calls — pure UI state.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { WeatherDay } from "../../types/api";

interface TimelineScrubberProps {
  durationDays: number;
  /** Typical season weather (p50 scenario). */
  weatherP50: WeatherDay[];
  /** Severe stress weather (p10 scenario — caller generates from p50 with stress). */
  weatherP10: WeatherDay[];
  /** Called with the active day index whenever day changes. */
  onDayChange: (day: number) => void;
  /** Called with the active weather array whenever mode or day changes. */
  onWeatherChange: (weather: WeatherDay[]) => void;
}

type ScenarioMode = "p50" | "p10";

const PLAY_SPEED_MS = 500; // advance 1 day every 500 ms

export default function TimelineScrubber({
  durationDays,
  weatherP50,
  weatherP10,
  onDayChange,
  onWeatherChange,
}: TimelineScrubberProps) {
  const [currentDay, setCurrentDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<ScenarioMode>("p50");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeWeather = mode === "p50" ? weatherP50 : weatherP10;

  // Notify parent whenever day or mode changes
  useEffect(() => {
    onDayChange(currentDay);
    onWeatherChange(activeWeather);
  }, [currentDay, activeWeather, onDayChange, onWeatherChange]);

  // Auto-advance playback
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentDay((d) => {
          if (d >= durationDays) {
            setIsPlaying(false);
            return d;
          }
          return d + 1;
        });
      }, PLAY_SPEED_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, durationDays]);

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentDay(Number(e.target.value));
      setIsPlaying(false);
    },
    []
  );

  const handleModeToggle = useCallback((newMode: ScenarioMode) => {
    setMode(newMode);
    setCurrentDay(0);
    setIsPlaying(false);
  }, []);

  const progress = durationDays > 0 ? (currentDay / durationDays) * 100 : 0;

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.88)",
        borderRadius: "12px",
        padding: "14px 20px",
        color: "#F8FAFC",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        userSelect: "none",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        minWidth: "320px",
      }}
    >
      {/* ── Day indicator ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "8px",
          color: "#94A3B8",
        }}
      >
        <span>Day {currentDay}</span>
        <span style={{ color: "#64748B" }}>/ {durationDays} days</span>
      </div>

      {/* ── Progress bar + slider ── */}
      <div style={{ position: "relative", marginBottom: "12px" }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            height: "4px",
            width: `${progress}%`,
            background: mode === "p50" ? "#22C55E" : "#EF4444",
            borderRadius: "2px",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <input
          type="range"
          min={0}
          max={durationDays}
          value={currentDay}
          onChange={handleSlider}
          style={{
            width: "100%",
            appearance: "none" as React.CSSProperties["appearance"],
            height: "4px",
            borderRadius: "2px",
            background: "transparent",
            outline: "none",
            cursor: "pointer",
            position: "relative",
            zIndex: 2,
          }}
        />
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {/* Play / Pause */}
        <button
          onClick={() => setIsPlaying((p) => !p)}
          style={{
            background: isPlaying ? "#3B82F6" : "#22C55E",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            padding: "6px 14px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        {/* Reset */}
        <button
          onClick={() => { setCurrentDay(0); setIsPlaying(false); }}
          style={{
            background: "#334155",
            border: "none",
            borderRadius: "8px",
            color: "#94A3B8",
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: "12px",
            flexShrink: 0,
          }}
        >
          ↺
        </button>

        {/* Scenario mode toggle */}
        <div
          style={{
            display: "flex",
            background: "#1E293B",
            borderRadius: "8px",
            padding: "2px",
            gap: "2px",
            flexGrow: 1,
          }}
        >
          {(["p50", "p10"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeToggle(m)}
              style={{
                flex: 1,
                background: mode === m ? (m === "p50" ? "#166534" : "#991B1B") : "transparent",
                border: "none",
                borderRadius: "6px",
                color: mode === m ? "#DCFCE7" : "#64748B",
                padding: "5px 8px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: mode === m ? 700 : 400,
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {m === "p50" ? "🌤 Typical (p50)" : "🌩 Severe Stress (p10)"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Current weather badge ── */}
      {activeWeather[currentDay] && (
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            gap: "12px",
            color: "#CBD5E1",
            fontSize: "11px",
          }}
        >
          <span>🌧 {activeWeather[currentDay].rainfall_mm.toFixed(1)} mm</span>
          <span>🌡 {activeWeather[currentDay].temp_c.toFixed(1)} °C</span>
          <span style={{ textTransform: "capitalize" }}>
            {activeWeather[currentDay].condition}
          </span>
        </div>
      )}
    </div>
  );
}
