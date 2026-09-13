/**
 * CropGrowthStage — instanced low-poly crop mesh on a 10×10 grid.
 *
 * Growth stages driven by progress = min(1, currentDay / durationDays):
 *   0.00–0.10  bare        (no mesh rendered)
 *   0.10–0.35  seedling    (small clusters)
 *   0.35–0.65  vegetative  (medium cone + leaves)
 *   0.65–0.85  flowering   (cone + flower buds)
 *   0.85–1.00  mature      (tall cone + grain head)
 *
 * Uses InstancedMesh for the 10×10 grid (100 instances = 1 draw call).
 * Health score maps to scale (size) and color tint (yellow/brown stress).
 */

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

interface CropGrowthStageProps {
  currentDay: number;
  durationDays: number;
  cropType: string;
  plotSize: number; // hectares
  healthScore?: number;
}

type Stage = "bare" | "seedling" | "vegetative" | "flowering" | "mature";

function getStage(progress: number): Stage {
  if (progress < 0.10) return "bare";
  if (progress < 0.35) return "seedling";
  if (progress < 0.65) return "vegetative";
  if (progress < 0.85) return "flowering";
  return "mature";
}

const GRID = 10;
const INSTANCE_COUNT = GRID * GRID;

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

function getTintedColor(baseColor: string, health: number): THREE.Color {
  const c = new THREE.Color(baseColor);
  if (health < 80) {
    const stressColor = new THREE.Color("#A09040");
    const factor = Math.min(1, Math.max(0, (80 - health) / 80));
    c.lerp(stressColor, factor * 0.7);
  }
  return c;
}

export default function CropGrowthStage({
  currentDay,
  durationDays,
  cropType,
  plotSize,
  healthScore = 100,
}: CropGrowthStageProps) {
  const progress = Math.min(1.0, currentDay / Math.max(1, durationDays));
  const stage = getStage(progress);
  const baseColorHex = getCropColor(cropType);
  const color = useMemo(() => getTintedColor(baseColorHex, healthScore), [baseColorHex, healthScore]);
  const scaleMultiplier = 0.6 + (healthScore / 250); // scales from 0.6 to 1.0 based on health

  const plotUnits = Math.sqrt(Math.max(0.1, plotSize)) * 10;
  const spacing = plotUnits / GRID;
  const offset = -plotUnits / 2 + spacing / 2;

  // Base geometry (stalk/canopy)
  const geometry = useMemo(() => {
    switch (stage) {
      case "seedling":
        return new THREE.DodecahedronGeometry(0.08, 0);
      case "vegetative":
      case "flowering":
        return new THREE.ConeGeometry(0.15, 0.45, 6);
      case "mature":
        return new THREE.ConeGeometry(0.12, 0.60, 6);
      default:
        return new THREE.BufferGeometry();
    }
  }, [stage]);

  // Secondary geometry (flower bud or mature head)
  const headGeometry = useMemo(() => {
    if (stage === "flowering") return new THREE.SphereGeometry(0.06, 4, 4);
    if (stage === "mature") return new THREE.CylinderGeometry(0.18, 0.18, 0.05, 6);
    return null;
  }, [stage]);

  const instanceRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);

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
          case "seedling":   y = 0.08 * scaleMultiplier; break;
          case "vegetative": 
          case "flowering":  y = 0.225 * scaleMultiplier; break;
          case "mature":     y = 0.300 * scaleMultiplier; break;
        }

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(stage === "bare" ? 0 : scaleMultiplier);
        dummy.updateMatrix();
        instanceRef.current.setMatrixAt(idx, dummy.matrix);
      }
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
  }, [stage, offset, spacing, scaleMultiplier]);

  useEffect(() => {
    if (!headRef.current || !headGeometry) return;
    const dummy = new THREE.Object3D();

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const idx = row * GRID + col;
        const x = offset + col * spacing + (Math.random() - 0.5) * spacing * 0.3;
        const z = offset + row * spacing + (Math.random() - 0.5) * spacing * 0.3;
        
        let y = 0;
        if (stage === "flowering") y = 0.45 * scaleMultiplier;
        if (stage === "mature") y = 0.60 * scaleMultiplier;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(scaleMultiplier);
        dummy.updateMatrix();
        headRef.current.setMatrixAt(idx, dummy.matrix);
      }
    }
    headRef.current.instanceMatrix.needsUpdate = true;
  }, [stage, offset, spacing, scaleMultiplier, headGeometry]);

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

      {headGeometry && (
        <instancedMesh
          ref={headRef}
          args={[headGeometry, undefined, INSTANCE_COUNT]}
          castShadow
        >
          <meshLambertMaterial 
            color={stage === "flowering" ? "#FFFFFF" : "#F9A825"} 
            flatShading 
          />
        </instancedMesh>
      )}
    </group>
  );
}
