/**
 * WeatherParticles — dynamic weather effects driven by daily weather data.
 *
 * Rules (per api_contract.md condition field):
 *   rainfall_mm > 2.0  → animated vertical rain particle system
 *   temp_c > 35.0      → warm golden directional light + sun-glare tint
 *   condition == "stormy" → both rain particles and intense orange light
 *   drought/sunny dry  → ambient light dimmed to a dry, muted palette
 *
 * No external assets. Pure Three.js BufferGeometry Points + lights.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WeatherDay } from "../../types/api";

interface WeatherParticlesProps {
  weather: WeatherDay | null;
  plotSize: number;
}

const RAIN_COUNT = 400;
const HEAT_PARTICLE_COUNT = 80;

// ── Rain particle system ──────────────────────────────────────────────────────

function RainParticles({ plotSize }: { plotSize: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const spread = Math.sqrt(Math.max(0.1, plotSize)) * 10;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      velocities[i] = 0.04 + Math.random() * 0.04;
    }
    return { positions, velocities };
  }, [spread]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = pos.getY(i) - velocities[i];
      if (y < -0.2) y = 6 + Math.random() * 2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#A8D8EA"
        size={0.04}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

// ── Heat shimmer particles ────────────────────────────────────────────────────

function HeatParticles({ plotSize }: { plotSize: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const spread = Math.sqrt(Math.max(0.1, plotSize)) * 8;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(HEAT_PARTICLE_COUNT * 3);
    const velocities = new Float32Array(HEAT_PARTICLE_COUNT);
    for (let i = 0; i < HEAT_PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      velocities[i] = 0.005 + Math.random() * 0.01;
    }
    return { positions, velocities };
  }, [spread]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < HEAT_PARTICLE_COUNT; i++) {
      let y = pos.getY(i) + velocities[i];
      // Gentle horizontal drift
      const x = pos.getX(i) + Math.sin(Date.now() * 0.001 + i) * 0.003;
      if (y > 3) {
        y = 0;
        pos.setX(i, (Math.random() - 0.5) * spread);
      }
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#FFD54F"
        size={0.09}
        transparent
        opacity={0.45}
        sizeAttenuation
      />
    </points>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WeatherParticles({
  weather,
  plotSize,
}: WeatherParticlesProps) {
  if (!weather) {
    // No weather data — neutral lighting only
    return (
      <>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      </>
    );
  }

  const isRainy = weather.rainfall_mm > 2.0;
  const isHot   = weather.temp_c > 35.0;
  const isStormy = weather.condition === "stormy";
  const isDry   = !isRainy && weather.condition === "sunny" && weather.temp_c < 30;

  // Ambient intensity: dim for drought/dry, boost for stormy
  const ambientIntensity = isStormy ? 0.25 : isDry ? 0.35 : isRainy ? 0.55 : 0.65;

  // Directional light colour: golden for heat, cool-blue for rain, warm-white normal
  const dirColor = isHot || isStormy
    ? new THREE.Color("#FF8F00")
    : isRainy
    ? new THREE.Color("#90CAF9")
    : new THREE.Color("#FFF9C4");

  const dirIntensity = isStormy ? 1.4 : isHot ? 1.2 : isRainy ? 0.5 : 0.9;

  // Sky background tint via fog
  const fogColor = isStormy
    ? "#546E7A"
    : isRainy
    ? "#78909C"
    : isHot
    ? "#FF8F00"
    : "#E3F2FD";

  return (
    <>
      {/* Lighting */}
      <ambientLight
        intensity={ambientIntensity}
        color={isDry ? "#9E9E9E" : "#FFFFFF"}
      />
      <directionalLight
        position={isRainy ? [2, 8, 3] : [5, 12, 5]}
        intensity={dirIntensity}
        color={dirColor}
        castShadow
        shadow-mapSize={[512, 512]}
      />

      {/* Atmospheric fog tint */}
      <fog attach="fog" args={[fogColor, 20, 60]} />

      {/* Particles */}
      {(isRainy || isStormy) && <RainParticles plotSize={plotSize} />}
      {isHot && <HeatParticles plotSize={plotSize} />}
    </>
  );
}
