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
}

/** Convert hectares to scene units (roughly metres at 1:1 scale). */
function haToUnits(ha: number): number {
  return Math.sqrt(Math.max(0.1, ha)) * 10;
}

export default function GroundMesh({ plotSize }: GroundMeshProps) {
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

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshLambertMaterial
        color="#8B6914"
        side={THREE.FrontSide}
        flatShading
      />
    </mesh>
  );
}
