/**
 * GroundMesh — low-poly displaced soil plane.
 *
 * Renders a PlaneGeometry with procedural vertex displacement applied via
 * a useMemo-cached Float32Array. Scale is driven by plotSize (hectares).
 * No external assets — pure Three.js primitives only.
 */

import { useMemo, useRef } from "react";
import * as THREE from "three";

interface GroundMeshProps {
  /** Plot size in hectares. 1 ha ≈ 100 m × 100 m → scale by sqrt(ha)*10. */
  plotSize: number;
  recentRainfall?: number;
}

/** Convert hectares to scene units (roughly metres at 1:1 scale). */
function haToUnits(ha: number): number {
  return Math.sqrt(Math.max(0.1, ha)) * 10;
}

export default function GroundMesh({ plotSize, recentRainfall = 0 }: GroundMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = haToUnits(plotSize);

  // Build displaced geometry once per plotSize change.
  const geometry = useMemo(() => {
    const segments = 20; // low-poly: 20×20 grid
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // lay flat

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const count = pos.count;

    // Procedural vertex displacement — pseudo-random furrow noise.
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Combine two sine waves for furrow-like agricultural terrain.
      const noise =
        Math.sin(x * 1.2 + 0.3) * 0.08 +
        Math.sin(z * 1.5 + 0.7) * 0.06 +
        Math.sin((x + z) * 0.9) * 0.04;
      pos.setY(i, noise);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [size]);

  const color = useMemo(() => {
    const wetness = Math.min(1, recentRainfall / 20); // 20mm is fully saturated
    const r = 0x8B - wetness * (0x8B - 0x5C);
    const g = 0x69 - wetness * (0x69 - 0x40);
    const b = 0x14 - wetness * (0x14 - 0x33);
    return new THREE.Color(r / 255, g / 255, b / 255);
  }, [recentRainfall]);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshLambertMaterial
        color={color}
        side={THREE.FrontSide}
        flatShading
      />
    </mesh>
  );
}
