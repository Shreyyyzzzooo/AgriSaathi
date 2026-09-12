/**
 * CropGrowthStage — instanced low-poly crop mesh on a 10×10 grid.
 *
 * Growth stages driven by progress = min(1, currentDay / durationDays):
 *   0.00–0.15  bare soil   (no mesh rendered — ground only)
 *   0.15–0.45  seedlings   (small sphere clusters)
 *   0.45–0.85  vegetative  (medium cone — stalk + canopy)
 *   0.85–1.00  mature      (tall cone + wide disc — grain head)
 *
 * All meshes are procedural Three.js primitives. No .gltf / .obj imports.
 * Uses InstancedMesh for the 10×10 grid (100 instances = 1 draw call).
 */

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

interface CropGrowthStageProps {
  currentDay: number;
  durationDays: number;
  cropType: string;
  plotSize: number; // hectares — to space instances across the plot
}

type Stage = "bare" | "seedling" | "vegetative" | "mature";

function getStage(progress: number): Stage {
  if (progress < 0.15) return "bare";
  if (progress < 0.45) return "seedling";
  if (progress < 0.85) return "vegetative";
  return "mature";
}

const GRID = 10; // 10×10 instances
const INSTANCE_COUNT = GRID * GRID;

/** Crop-type tint map — low-poly palette. */
const CROP_COLORS: Record<string, string> = {
  wheat_rabi:      "#D4A017",
  rice_kharif:     "#4CAF50",
  cotton_kharif:   "#ECEFF1",
  maize_kharif:    "#FFC107",
  soybean_kharif:  "#8BC34A",
  chickpea_rabi:   "#A5D6A7",
  mustard_rabi:    "#FFEB3B",
  sugarcane:       "#2E7D32",
  groundnut_kharif:"#FF8F00",
  onion_rabi:      "#CE93D8",
};

function getCropColor(cropType: string): string {
  return CROP_COLORS[cropType] ?? "#66BB6A";
}

export default function CropGrowthStage({
  currentDay,
  durationDays,
  cropType,
  plotSize,
}: CropGrowthStageProps) {
  const progress = Math.min(1.0, currentDay / Math.max(1, durationDays));
  const stage = getStage(progress);
  const color = getCropColor(cropType);

  // Grid spacing based on plot size
  const plotUnits = Math.sqrt(Math.max(0.1, plotSize)) * 10;
  const spacing = plotUnits / GRID;
  const offset = -plotUnits / 2 + spacing / 2;

  // Build geometry for each stage — remade only when stage changes.
  const geometry = useMemo(() => {
    switch (stage) {
      case "seedling":
        // Tiny sphere — emerging seedling node
        return new THREE.SphereGeometry(0.06, 4, 3);
      case "vegetative":
        // Cone — stalk + canopy, height proportional to progress
        return new THREE.ConeGeometry(0.12, 0.35, 5);
      case "mature":
        // Taller cone for grain stalk
        return new THREE.ConeGeometry(0.10, 0.55, 6);
      default:
        // bare: return a degenerate geometry (nothing visible)
        return new THREE.BufferGeometry();
    }
  }, [stage]);

  // Secondary disc for mature grain head
  const headGeometry = useMemo(() => {
    if (stage !== "mature") return null;
    return new THREE.CylinderGeometry(0.18, 0.18, 0.05, 6);
  }, [stage]);

  // Instanced mesh refs
  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

  // Position all instances across the grid
  useEffect(() => {
    if (!instanceRef.current) return;
    const dummy = new THREE.Object3D();

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const idx = row * GRID + col;
        const x = offset + col * spacing + (Math.random() - 0.5) * spacing * 0.3;
        const z = offset + row * spacing + (Math.random() - 0.5) * spacing * 0.3;

        let y = 0;
        switch (stage) {
          case "seedling":   y = 0.06;  break;
          case "vegetative": y = 0.175; break;
          case "mature":     y = 0.275; break;
        }

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(stage === "bare" ? 0 : 1);
        dummy.updateMatrix();
        instanceRef.current.setMatrixAt(idx, dummy.matrix);
      }
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
  }, [stage, offset, spacing]);

  // Position the mature grain-head disc instances
  useEffect(() => {
    if (!headRef.current || stage !== "mature") return;
    const dummy = new THREE.Object3D();

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const idx = row * GRID + col;
        const x = offset + col * spacing + (Math.random() - 0.5) * spacing * 0.3;
        const z = offset + row * spacing + (Math.random() - 0.5) * spacing * 0.3;
        dummy.position.set(x, 0.575, z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        headRef.current.setMatrixAt(idx, dummy.matrix);
      }
    }
    headRef.current.instanceMatrix.needsUpdate = true;
  }, [stage, offset, spacing]);

  if (stage === "bare") return null;

  return (
    <group>
      <instancedMesh
        ref={instanceRef}
        args={[geometry, undefined, INSTANCE_COUNT]}
        castShadow
      >
        <meshLambertMaterial color={color} flatShading />
      </instancedMesh>

      {stage === "mature" && headGeometry && (
        <instancedMesh
          ref={headRef}
          args={[headGeometry, undefined, INSTANCE_COUNT]}
          castShadow
        >
          <meshLambertMaterial color="#F9A825" flatShading />
        </instancedMesh>
      )}
    </group>
  );
}
