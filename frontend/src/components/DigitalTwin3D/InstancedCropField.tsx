/**
 * InstancedCropField.tsx
 *
 * High-performance, multi-archetype agricultural field renderer.
 * Dynamically builds realistic agricultural rows with overlapping canopy,
 * crop-specific foliage, and mature features (cobs, bolls, fruits, heads).
 */

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getCropVisualProfile,
  createProceduralGeometries,
  type CropVisualProfile,
} from "./CropVisualRegistry";

interface InstancedCropFieldProps {
  currentDay: number;
  durationDays: number;
  cropType: string;
  plotSize: number; // hectares
  healthScore?: number;
}

type GrowthStage = "bare" | "seedling" | "vegetative" | "flowering" | "mature";

function getGrowthStage(progress: number): GrowthStage {
  if (progress < 0.08) return "bare";
  if (progress < 0.28) return "seedling";
  if (progress < 0.65) return "vegetative";
  if (progress < 0.85) return "flowering";
  return "mature";
}

function getTintedColor(baseHex: string, matureHex: string | undefined, progress: number, health: number): THREE.Color {
  const c = new THREE.Color(baseHex);

  // Transition towards mature color in flowering & mature stages (progress > 0.7)
  if (matureHex && progress > 0.7) {
    const matureC = new THREE.Color(matureHex);
    const matureFactor = Math.min(1.0, (progress - 0.7) / 0.3);
    c.lerp(matureC, matureFactor * 0.85);
  }

  // Health stress modulation
  if (health < 80) {
    const stressColor = new THREE.Color("#A08E44"); // Chlorotic dry yellow-brown
    const stressFactor = Math.min(1.0, (80 - health) / 60);
    c.lerp(stressColor, stressFactor * 0.65);
  }

  return c;
}

export default function InstancedCropField({
  currentDay,
  durationDays,
  cropType,
  plotSize,
  healthScore = 100,
}: InstancedCropFieldProps) {
  const profile: CropVisualProfile = useMemo(() => getCropVisualProfile(cropType), [cropType]);

  const progress = Math.min(1.0, currentDay / Math.max(1, durationDays));
  const stage = getGrowthStage(progress);

  // Plot dimensions
  const plotUnits = Math.sqrt(Math.max(0.1, plotSize)) * 10;
  const rows = profile.rows;
  const cols = profile.plantsPerRow;
  const totalPlants = rows * cols;
  const maxLeaves = totalPlants * profile.leafCount;
  const maxFeatures = totalPlants * Math.max(1, profile.featuresPerPlant);

  // Procedural geometries for this crop archetype
  const { stemGeo, leafGeo, featureGeo } = useMemo(
    () => createProceduralGeometries(profile),
    [profile]
  );

  // Colors & health scaling
  const plantColor = useMemo(
    () => getTintedColor(profile.baseColor, profile.matureColor, progress, healthScore),
    [profile.baseColor, profile.matureColor, progress, healthScore]
  );

  const stemColor = useMemo(() => {
    const c = new THREE.Color(profile.stemColor);
    if (healthScore < 80) {
      c.lerp(new THREE.Color("#6B5B3B"), 0.4);
    }
    return c;
  }, [profile.stemColor, healthScore]);

  // Mesh refs
  const stemMeshRef = useRef<THREE.InstancedMesh>(null);
  const leafMeshRef = useRef<THREE.InstancedMesh>(null);
  const featureMeshRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Spacing
  const spacingX = (plotUnits * 0.88) / rows;
  const spacingZ = (plotUnits * 0.88) / cols;
  const offsetX = -(plotUnits * 0.88) / 2 + spacingX / 2;
  const offsetZ = -(plotUnits * 0.88) / 2 + spacingZ / 2;

  // Growth-stage specific scaling factors
  const stageParams = useMemo(() => {
    let heightRatio = 0;
    let leafCountActive = 0;
    let leafScale = 0;
    let featureActive = false;
    let featureScale = 0;

    switch (stage) {
      case "seedling": {
        // Small shoots, 2-3 leaves
        const t = (progress - 0.08) / 0.20;
        heightRatio = 0.15 + t * 0.15;
        leafCountActive = Math.min(3, Math.max(2, Math.round(t * profile.leafCount * 0.4)));
        leafScale = 0.25 + t * 0.20;
        break;
      }
      case "vegetative": {
        // Rapid growth & spreading leaves
        const t = (progress - 0.28) / 0.37;
        heightRatio = 0.35 + t * 0.40;
        leafCountActive = Math.min(profile.leafCount, Math.max(3, Math.round(profile.leafCount * (0.4 + t * 0.5))));
        leafScale = 0.45 + t * 0.35;
        break;
      }
      case "flowering": {
        // Near full height, flowers/tassels emerge
        const t = (progress - 0.65) / 0.20;
        heightRatio = 0.75 + t * 0.18;
        leafCountActive = profile.leafCount;
        leafScale = 0.80 + t * 0.15;
        featureActive = profile.featureType !== "none";
        featureScale = profile.featureScale * (0.4 + t * 0.4);
        break;
      }
      case "mature": {
        // Full height, mature features, full canopy coverage
        const t = (progress - 0.85) / 0.15;
        heightRatio = 0.93 + t * 0.07;
        leafCountActive = profile.leafCount;
        leafScale = 0.95 + t * 0.15; // wide leaves close the canopy
        featureActive = profile.featureType !== "none";
        featureScale = profile.featureScale * (0.8 + t * 0.2);
        break;
      }
      case "bare":
      default:
        break;
    }

    // Health stress scaling: 0.7x to 1.05x
    const healthMultiplier = 0.7 + (healthScore / 100) * 0.35;
    heightRatio *= healthMultiplier;
    leafScale *= healthMultiplier;
    featureScale *= healthMultiplier;

    return { heightRatio, leafCountActive, leafScale, featureActive, featureScale };
  }, [stage, progress, profile, healthScore]);

  // Update instanced mesh matrices
  useEffect(() => {
    if (!stemMeshRef.current || stage === "bare") return;

    const dummy = new THREE.Object3D();
    const leafDummy = new THREE.Object3D();
    const featureDummy = new THREE.Object3D();

    let leafIdx = 0;
    let featureIdx = 0;

    const actualMatureHeight = profile.matureHeight;
    const currentHeight = actualMatureHeight * stageParams.heightRatio;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const plantIdx = r * cols + c;

        // Deterministic pseudo-random seed per plant location
        const seedVal = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        const hash1 = seedVal - Math.floor(seedVal);
        const hash2 = (seedVal * 1.618) - Math.floor(seedVal * 1.618);
        const hash3 = (seedVal * 2.718) - Math.floor(seedVal * 2.718);

        // Agricultural row positioning with slight organic jitter
        const jitterX = (hash1 - 0.5) * spacingX * 0.28;
        const jitterZ = (hash2 - 0.5) * spacingZ * 0.28;
        const posX = offsetX + r * spacingX + jitterX;
        const posZ = offsetZ + c * spacingZ + jitterZ;

        // Individual plant height & rotation variation
        const heightVar = 0.90 + hash3 * 0.20;
        const plantH = currentHeight * heightVar;
        const rotY = hash1 * Math.PI * 2;

        // 1. STEM
        dummy.position.set(posX, 0, posZ);
        dummy.rotation.set((hash2 - 0.5) * 0.08, rotY, (hash3 - 0.5) * 0.08);
        dummy.scale.set(1.0, plantH, 1.0);
        dummy.updateMatrix();
        stemMeshRef.current.setMatrixAt(plantIdx, dummy.matrix);

        // 2. LEAVES
        if (leafMeshRef.current && stageParams.leafCountActive > 0) {
          const numL = stageParams.leafCountActive;
          for (let l = 0; l < numL; l++) {
            const frac = (l + 1) / (numL + 1); // distribution up the stem
            const leafY = plantH * (0.15 + frac * 0.80);

            // Spiral angle around the stem
            const goldenAngle = 2.39996; // ~137.5 degrees
            const leafAngle = rotY + l * goldenAngle + (hash2 - 0.5) * 0.3;

            // Droop angle: lower leaves arch outward/downward, upper leaves point upward
            const droop = (Math.PI / 2.3) * profile.leafDroop * (1.1 - frac * 0.6);

            leafDummy.position.set(posX, leafY, posZ);
            leafDummy.rotation.set(0, leafAngle, 0);
            leafDummy.rotateX(droop);

            // Scale leaf
            const len = profile.leafLength * stageParams.leafScale * (0.7 + frac * 0.5);
            const wid = profile.leafWidth * stageParams.leafScale * (0.8 + frac * 0.4);
            leafDummy.scale.set(wid, len, wid);

            leafDummy.updateMatrix();
            leafMeshRef.current.setMatrixAt(leafIdx++, leafDummy.matrix);
          }
        }

        // 3. MATURE FEATURES (Cobs, Bolls, Heads, Fruits)
        if (featureMeshRef.current && stageParams.featureActive && profile.featuresPerPlant > 0) {
          const numF = profile.featuresPerPlant;
          for (let f = 0; f < numF; f++) {
            const attachY = plantH * profile.featureAttachRatio;
            const fAngle = rotY + (f * (Math.PI * 2 / numF)) + (hash3 - 0.5) * 0.5;

            // Offset slightly outward from stem
            const outwardDist = profile.stemRadiusBottom * 1.5 + 0.04;
            const fx = posX + Math.cos(fAngle) * outwardDist;
            const fz = posZ + Math.sin(fAngle) * outwardDist;

            featureDummy.position.set(fx, attachY, fz);
            featureDummy.rotation.set(0.2, fAngle, (hash1 - 0.5) * 0.3);
            featureDummy.scale.setScalar(stageParams.featureScale * (0.9 + hash2 * 0.2));
            featureDummy.updateMatrix();

            featureMeshRef.current.setMatrixAt(featureIdx++, featureDummy.matrix);
          }
        }
      }
    }

    // Update GPU instance buffers
    stemMeshRef.current.count = totalPlants;
    stemMeshRef.current.instanceMatrix.needsUpdate = true;

    if (leafMeshRef.current) {
      leafMeshRef.current.count = leafIdx;
      leafMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (featureMeshRef.current) {
      featureMeshRef.current.count = featureIdx;
      featureMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [
    stage,
    stageParams,
    profile,
    rows,
    cols,
    totalPlants,
    spacingX,
    spacingZ,
    offsetX,
    offsetZ,
  ]);

  // Subtle natural wind sway
  useFrame(({ clock }) => {
    if (!groupRef.current || stage === "bare") return;
    const t = clock.getElapsedTime() * 1.6;
    const sway = Math.sin(t) * 0.015 * profile.windSensitivity;
    groupRef.current.rotation.z = sway;
    groupRef.current.rotation.x = Math.cos(t * 0.7) * 0.008 * profile.windSensitivity;
  });

  if (stage === "bare") return null;

  return (
    <group ref={groupRef}>
      {/* 1. Stems / Trunks */}
      <instancedMesh
        ref={stemMeshRef}
        args={[stemGeo, undefined, totalPlants]}
        castShadow
        receiveShadow
      >
        <meshLambertMaterial color={stemColor} flatShading />
      </instancedMesh>

      {/* 2. Leaves / Foliage */}
      <instancedMesh
        ref={leafMeshRef}
        args={[leafGeo, undefined, maxLeaves]}
        castShadow
        receiveShadow
      >
        <meshLambertMaterial color={plantColor} flatShading side={THREE.DoubleSide} />
      </instancedMesh>

      {/* 3. Mature Features (Cobs, Bolls, Flowers, Fruits) */}
      {profile.featureType !== "none" && (
        <instancedMesh
          ref={featureMeshRef}
          args={[featureGeo, undefined, maxFeatures]}
          castShadow
          receiveShadow
        >
          <meshLambertMaterial color={profile.featureColor} flatShading />
        </instancedMesh>
      )}
    </group>
  );
}
