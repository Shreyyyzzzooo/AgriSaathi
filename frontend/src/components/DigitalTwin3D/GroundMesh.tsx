/**
 * GroundMesh.tsx
 *
 * Procedural agricultural soil mesh with parallel furrow ridges,
 * rich loamy soil materials, and dynamic wetness response.
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";

interface GroundMeshProps {
  plotSize: number;
  recentRainfall?: number;
}

function haToUnits(ha: number): number {
  return Math.sqrt(Math.max(0.1, ha)) * 10;
}

export default function GroundMesh({ plotSize, recentRainfall = 0 }: GroundMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = haToUnits(plotSize);

  // Build displaced furrow geometry
  const geometry = useMemo(() => {
    const segments = 48; // Crisp furrow ridges
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const count = pos.count;

    // Ridge frequency roughly aligned with crop rows
    const furrowFreq = (Math.PI * 2) / (size / 15);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // 1. Parallel agricultural furrow ridges
      const furrow = Math.sin(x * furrowFreq) * 0.07;

      // 2. Gentle field roll / drainage slope
      const fieldRoll =
        Math.sin(x * 0.18 + 0.4) * 0.08 +
        Math.cos(z * 0.15 + 0.2) * 0.08;

      // 3. Subtle micro-roughness
      const micro = (Math.sin(x * 4.5) * Math.cos(z * 4.5)) * 0.02;

      pos.setY(i, furrow + fieldRoll + micro);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [size]);

  // Soil color & wetness response
  const { color, roughness } = useMemo(() => {
    const wetness = Math.min(1.0, recentRainfall / 18); // 18mm+ is soaked earth

    // Rich dark fertile loam: #3A2518 dry -> #1C120B wet
    const dryColor = new THREE.Color("#352216");
    const wetColor = new THREE.Color("#1B110A");
    const soilColor = dryColor.clone().lerp(wetColor, wetness);

    // Wet soil becomes smoother and has subtle specular sheen
    const soilRoughness = 0.92 - wetness * 0.35;

    return { color: soilColor, roughness: soilRoughness };
  }, [recentRainfall]);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={0.04}
        flatShading
      />
    </mesh>
  );
}
