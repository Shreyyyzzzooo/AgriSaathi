/**
 * PlotScene — R3F Canvas scene containing ground + crops + weather.
 *
 * This component is STRICTLY props-only. Zero fetch/axios/hook imports.
 * Parent passes weather_by_day directly from SimulateResponse.
 *
 * Props:
 *   plotSize        hectares — drives GroundMesh scale
 *   cropDurationDays total growing days — drives CropGrowthStage
 *   weatherByDay    direct slice from /simulate response
 *   currentDay      active day index (from TimelineScrubber)
 *   cropType        crop_id string for colour palette
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

import GroundMesh from "./GroundMesh";
import CropGrowthStage from "./CropGrowthStage";
import WeatherParticles from "./WeatherParticles";
import type { WeatherDay } from "../../types/api";

interface PlotSceneProps {
  plotSize: number;
  cropDurationDays: number;
  weatherByDay: WeatherDay[];
  currentDay: number;
  cropType: string;
}

function SceneContents({
  plotSize,
  cropDurationDays,
  weatherByDay,
  currentDay,
  cropType,
}: PlotSceneProps) {
  const today = weatherByDay[Math.min(currentDay, weatherByDay.length - 1)] ?? null;

  return (
    <>
      {/* Weather-driven lighting + particles */}
      <WeatherParticles weather={today} plotSize={plotSize} />

      {/* Ground plane */}
      <GroundMesh plotSize={plotSize} />

      {/* Crop instances */}
      <CropGrowthStage
        currentDay={currentDay}
        durationDays={cropDurationDays}
        cropType={cropType}
        plotSize={plotSize}
      />
    </>
  );
}

export default function PlotScene(props: PlotSceneProps) {
  return (
    <Canvas
      shadows
      style={{ width: "100%", height: "100%", background: "#0F172A" }}
      gl={{ antialias: true, alpha: false }}
    >
      <PerspectiveCamera makeDefault position={[0, 8, 14]} fov={45} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />

      <Suspense fallback={null}>
        <SceneContents {...props} />
      </Suspense>
    </Canvas>
  );
}
