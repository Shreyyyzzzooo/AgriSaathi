/**
 * WeatherParticles.tsx
 *
 * Dynamic environmental lighting, sky atmosphere, rain streaks,
 * and heat shimmer driven by daily simulation weather.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WeatherDay } from "../../types/api";

interface WeatherParticlesProps {
  weather: WeatherDay | null;
  plotSize: number;
}

const RAIN_COUNT = 500;
const HEAT_PARTICLE_COUNT = 80;

// ── Rain Particle System ──────────────────────────────────────────────────────

function RainParticles({ plotSize }: { plotSize: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const spread = Math.sqrt(Math.max(0.1, plotSize)) * 10;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      velocities[i] = 0.07 + Math.random() * 0.05;
    }
    return { positions, velocities };
  }, [spread]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = pos.getY(i) - velocities[i];
      if (y < -0.1) {
        y = 7 + Math.random() * 2;
      }
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
        color="#B0BEC5"
        size={0.06}
        transparent
        opacity={0.65}
        sizeAttenuation
      />
    </points>
  );
}

// ── Heat Shimmer Particles ────────────────────────────────────────────────────

function HeatParticles({ plotSize }: { plotSize: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const spread = Math.sqrt(Math.max(0.1, plotSize)) * 8;

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(HEAT_PARTICLE_COUNT * 3);
    const velocities = new Float32Array(HEAT_PARTICLE_COUNT);
    for (let i = 0; i < HEAT_PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 2.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      velocities[i] = 0.006 + Math.random() * 0.008;
    }
    return { positions, velocities };
  }, [spread]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < HEAT_PARTICLE_COUNT; i++) {
      let y = pos.getY(i) + velocities[i];
      const x = pos.getX(i) + Math.sin(Date.now() * 0.001 + i) * 0.002;
      if (y > 3.2) {
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
        color="#FFE082"
        size={0.08}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function WeatherParticles({ weather, plotSize }: WeatherParticlesProps) {
  if (!weather) {
    return (
      <>
        <ambientLight intensity={1.5} color="#FFFFFF" />
        <hemisphereLight args={["#87CEEB", "#3E2723", 0.8]} />
        <directionalLight
          position={[6, 12, 6]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-bias={-0.0005}
        />
      </>
    );
  }

  const isRainy = weather.rainfall_mm > 2.0;
  const isHot = weather.temp_c > 35.0;
  const isStormy = weather.condition === "stormy";
  const isDry = !isRainy && weather.condition === "sunny" && weather.temp_c < 30;

  const ambientIntensity = isStormy ? 1.0 : isDry ? 1.5 : isRainy ? 1.2 : 1.8;

  const dirColor = isHot || isStormy
    ? new THREE.Color("#FFA726")
    : isRainy
    ? new THREE.Color("#90CAF9")
    : new THREE.Color("#FFFDE7");

  const dirIntensity = isStormy ? 2.5 : isHot ? 2.8 : isRainy ? 1.8 : 2.5;

  const fogColor = isStormy
    ? "#37474F"
    : isRainy
    ? "#546E7A"
    : isHot
    ? "#795548"
    : "#0F172A";

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={isDry ? "#BDBDBD" : "#FFFFFF"} />
      <hemisphereLight args={["#B0BEC5", "#3E2723", isRainy ? 0.8 : 1.0]} />
      <directionalLight
        position={isRainy ? [3, 9, 4] : [7, 13, 6]}
        intensity={dirIntensity}
        color={dirColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />

      <fog attach="fog" args={[fogColor, 20, 55]} />

      {(isRainy || isStormy) && <RainParticles plotSize={plotSize} />}
      {isHot && <HeatParticles plotSize={plotSize} />}
    </>
  );
}
