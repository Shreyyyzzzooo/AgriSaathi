/**
 * CropVisualRegistry.ts
 *
 * Centralized visual profile registry and procedural geometry definitions
 * for 35+ Indian agricultural crops across 14 visual archetypes.
 */

import * as THREE from "three";

export type CropArchetype =
  | "tall_cereal"       // Maize, Jowar, Bajra, Sugarcane
  | "dense_cereal"      // Rice, Wheat, Ragi
  | "bushy_pulse"       // Soybean, Arhar, Moong, Urad, Gram, Lentil, Peas
  | "low_canopy"        // Groundnut, Potato, Onion, Garlic, Coriander
  | "branching_cash"    // Cotton
  | "flowering_oilseed" // Mustard, Sunflower, Sesame
  | "fruiting_shrub"    // Tomato, Okra
  | "vine_crawler"      // Watermelon, Muskmelon, Bitter Gourd
  | "large_leaf_tree"   // Banana
  | "crown_tree"        // Papaya
  | "orchard_shrub"     // Pomegranate
  | "trellis_vine"      // Grapes
  | "compact_head"      // Cabbage, Cauliflower
  | "broadleaf_herb";   // Turmeric, Ginger

export type LeafShape =
  | "lanceolate" // long arching blade (Maize, Cereals)
  | "fine_blade" // narrow upright grass (Wheat, Rice)
  | "oval"       // rounded/trifoliate (Pulses, Cotton)
  | "paddle"     // massive broad leaf (Banana)
  | "lobed"      // palmate/star (Papaya, Okra, Watermelon)
  | "tubular"    // hollow needle (Onion, Garlic)
  | "feathery";   // small compound (Gram, Coriander)

export type MatureFeatureType =
  | "cob"              // Maize
  | "grain_spike"      // Wheat, Ragi
  | "panicle"          // Rice
  | "seed_head"        // Bajra, Jowar
  | "boll"             // Cotton
  | "sunflower_head"   // Sunflower
  | "yellow_flowers"   // Mustard
  | "tomato_fruit"     // Tomato
  | "banana_bunch"     // Banana
  | "papaya_fruit"     // Papaya
  | "melon"            // Watermelon, Muskmelon
  | "pomegranate_fruit"// Pomegranate
  | "grape_cluster"    // Grapes
  | "cauliflower_curd" // Cauliflower
  | "cabbage_head"     // Cabbage
  | "pod"              // Okra, Peas, Moong
  | "capsule"          // Sesame
  | "none";

export interface CropVisualProfile {
  id: string;
  name: string;
  archetype: CropArchetype;

  // Planting density & agricultural layout
  rows: number;
  plantsPerRow: number;
  rowSpacingRatio: number; // >1 = defined furrows, 1 = uniform

  // Stem structure
  matureHeight: number;
  stemRadiusBottom: number;
  stemRadiusTop: number;
  stemColor: string;

  // Foliage
  leafShape: LeafShape;
  leafCount: number;
  leafLength: number;
  leafWidth: number;
  leafSpread: number;    // outward spread radius
  leafDroop: number;     // 0 = upright, 1 = heavily weeping
  baseColor: string;
  matureColor?: string;

  // Mature feature (fruit, ear, flower, boll)
  featureType: MatureFeatureType;
  featureColor: string;
  featureScale: number;
  featureAttachRatio: number; // 0 = ground, 0.5 = mid-stem, 1 = top
  featuresPerPlant: number;

  windSensitivity: number;
}

// ── 14 Archetype Base Profiles ────────────────────────────────────────────────

const BASE_PROFILES: Record<CropArchetype, Omit<CropVisualProfile, "id" | "name">> = {
  tall_cereal: {
    archetype: "tall_cereal",
    rows: 15,
    plantsPerRow: 18,
    rowSpacingRatio: 1.35,
    matureHeight: 1.85,
    stemRadiusBottom: 0.024,
    stemRadiusTop: 0.014,
    stemColor: "#4E7029",
    leafShape: "lanceolate",
    leafCount: 8,
    leafLength: 0.75,
    leafWidth: 0.10,
    leafSpread: 0.65,
    leafDroop: 0.45,
    baseColor: "#4C8C2B",
    matureColor: "#689F38",
    featureType: "cob",
    featureColor: "#FBC02D",
    featureScale: 0.22,
    featureAttachRatio: 0.55,
    featuresPerPlant: 2,
    windSensitivity: 1.0,
  },

  dense_cereal: {
    archetype: "dense_cereal",
    rows: 18,
    plantsPerRow: 20,
    rowSpacingRatio: 1.15,
    matureHeight: 1.05,
    stemRadiusBottom: 0.012,
    stemRadiusTop: 0.008,
    stemColor: "#5B8A3C",
    leafShape: "fine_blade",
    leafCount: 9,
    leafLength: 0.45,
    leafWidth: 0.04,
    leafSpread: 0.35,
    leafDroop: 0.35,
    baseColor: "#558B2F",
    matureColor: "#D4A017",
    featureType: "grain_spike",
    featureColor: "#E0B85C",
    featureScale: 0.16,
    featureAttachRatio: 0.98,
    featuresPerPlant: 2,
    windSensitivity: 1.4,
  },

  bushy_pulse: {
    archetype: "bushy_pulse",
    rows: 14,
    plantsPerRow: 16,
    rowSpacingRatio: 1.25,
    matureHeight: 0.85,
    stemRadiusBottom: 0.018,
    stemRadiusTop: 0.010,
    stemColor: "#3E6B27",
    leafShape: "oval",
    leafCount: 7,
    leafLength: 0.30,
    leafWidth: 0.14,
    leafSpread: 0.48,
    leafDroop: 0.25,
    baseColor: "#558B2F",
    matureColor: "#689F38",
    featureType: "pod",
    featureColor: "#8BC34A",
    featureScale: 0.12,
    featureAttachRatio: 0.60,
    featuresPerPlant: 3,
    windSensitivity: 0.7,
  },

  low_canopy: {
    archetype: "low_canopy",
    rows: 16,
    plantsPerRow: 18,
    rowSpacingRatio: 1.2,
    matureHeight: 0.45,
    stemRadiusBottom: 0.014,
    stemRadiusTop: 0.008,
    stemColor: "#33691E",
    leafShape: "oval",
    leafCount: 8,
    leafLength: 0.25,
    leafWidth: 0.12,
    leafSpread: 0.42,
    leafDroop: 0.2,
    baseColor: "#388E3C",
    matureColor: "#4CAF50",
    featureType: "none",
    featureColor: "#FF8F00",
    featureScale: 0.1,
    featureAttachRatio: 0.3,
    featuresPerPlant: 0,
    windSensitivity: 0.5,
  },

  branching_cash: {
    archetype: "branching_cash",
    rows: 13,
    plantsPerRow: 15,
    rowSpacingRatio: 1.4,
    matureHeight: 1.25,
    stemRadiusBottom: 0.028,
    stemRadiusTop: 0.012,
    stemColor: "#4E342E",
    leafShape: "lobed",
    leafCount: 8,
    leafLength: 0.35,
    leafWidth: 0.22,
    leafSpread: 0.60,
    leafDroop: 0.3,
    baseColor: "#2E7D32",
    matureColor: "#388E3C",
    featureType: "boll",
    featureColor: "#FAFAFA",
    featureScale: 0.14,
    featureAttachRatio: 0.70,
    featuresPerPlant: 4,
    windSensitivity: 0.6,
  },

  flowering_oilseed: {
    archetype: "flowering_oilseed",
    rows: 15,
    plantsPerRow: 18,
    rowSpacingRatio: 1.25,
    matureHeight: 1.35,
    stemRadiusBottom: 0.020,
    stemRadiusTop: 0.010,
    stemColor: "#558B2F",
    leafShape: "lanceolate",
    leafCount: 7,
    leafLength: 0.40,
    leafWidth: 0.10,
    leafSpread: 0.45,
    leafDroop: 0.25,
    baseColor: "#689F38",
    matureColor: "#FFEB3B",
    featureType: "yellow_flowers",
    featureColor: "#FDD835",
    featureScale: 0.18,
    featureAttachRatio: 0.95,
    featuresPerPlant: 3,
    windSensitivity: 0.9,
  },

  fruiting_shrub: {
    archetype: "fruiting_shrub",
    rows: 13,
    plantsPerRow: 15,
    rowSpacingRatio: 1.35,
    matureHeight: 1.05,
    stemRadiusBottom: 0.022,
    stemRadiusTop: 0.012,
    stemColor: "#33691E",
    leafShape: "lobed",
    leafCount: 8,
    leafLength: 0.32,
    leafWidth: 0.18,
    leafSpread: 0.55,
    leafDroop: 0.35,
    baseColor: "#2E7D32",
    matureColor: "#388E3C",
    featureType: "tomato_fruit",
    featureColor: "#E53935",
    featureScale: 0.13,
    featureAttachRatio: 0.55,
    featuresPerPlant: 4,
    windSensitivity: 0.65,
  },

  vine_crawler: {
    archetype: "vine_crawler",
    rows: 9,
    plantsPerRow: 11,
    rowSpacingRatio: 1.4,
    matureHeight: 0.32,
    stemRadiusBottom: 0.018,
    stemRadiusTop: 0.010,
    stemColor: "#2E7D32",
    leafShape: "lobed",
    leafCount: 9,
    leafLength: 0.38,
    leafWidth: 0.28,
    leafSpread: 0.75,
    leafDroop: 0.1,
    baseColor: "#1B5E20",
    matureColor: "#2E7D32",
    featureType: "melon",
    featureColor: "#2E7D32",
    featureScale: 0.28,
    featureAttachRatio: 0.1,
    featuresPerPlant: 2,
    windSensitivity: 0.4,
  },

  large_leaf_tree: {
    archetype: "large_leaf_tree",
    rows: 7,
    plantsPerRow: 8,
    rowSpacingRatio: 1.25,
    matureHeight: 2.45,
    stemRadiusBottom: 0.080,
    stemRadiusTop: 0.045,
    stemColor: "#558B2F",
    leafShape: "paddle",
    leafCount: 6,
    leafLength: 1.20,
    leafWidth: 0.42,
    leafSpread: 1.10,
    leafDroop: 0.55,
    baseColor: "#2E7D32",
    matureColor: "#43A047",
    featureType: "banana_bunch",
    featureColor: "#CDDC39",
    featureScale: 0.32,
    featureAttachRatio: 0.75,
    featuresPerPlant: 1,
    windSensitivity: 1.1,
  },

  crown_tree: {
    archetype: "crown_tree",
    rows: 8,
    plantsPerRow: 9,
    rowSpacingRatio: 1.2,
    matureHeight: 2.20,
    stemRadiusBottom: 0.060,
    stemRadiusTop: 0.035,
    stemColor: "#6D4C41",
    leafShape: "lobed",
    leafCount: 7,
    leafLength: 0.75,
    leafWidth: 0.35,
    leafSpread: 0.85,
    leafDroop: 0.4,
    baseColor: "#33691E",
    matureColor: "#558B2F",
    featureType: "papaya_fruit",
    featureColor: "#FFA726",
    featureScale: 0.20,
    featureAttachRatio: 0.80,
    featuresPerPlant: 3,
    windSensitivity: 0.8,
  },

  orchard_shrub: {
    archetype: "orchard_shrub",
    rows: 8,
    plantsPerRow: 9,
    rowSpacingRatio: 1.3,
    matureHeight: 1.65,
    stemRadiusBottom: 0.045,
    stemRadiusTop: 0.020,
    stemColor: "#4E342E",
    leafShape: "oval",
    leafCount: 9,
    leafLength: 0.35,
    leafWidth: 0.15,
    leafSpread: 0.75,
    leafDroop: 0.3,
    baseColor: "#2E7D32",
    matureColor: "#388E3C",
    featureType: "pomegranate_fruit",
    featureColor: "#C62828",
    featureScale: 0.16,
    featureAttachRatio: 0.65,
    featuresPerPlant: 4,
    windSensitivity: 0.5,
  },

  trellis_vine: {
    archetype: "trellis_vine",
    rows: 9,
    plantsPerRow: 12,
    rowSpacingRatio: 1.5,
    matureHeight: 1.45,
    stemRadiusBottom: 0.025,
    stemRadiusTop: 0.012,
    stemColor: "#5D4037",
    leafShape: "lobed",
    leafCount: 8,
    leafLength: 0.32,
    leafWidth: 0.24,
    leafSpread: 0.60,
    leafDroop: 0.3,
    baseColor: "#2E7D32",
    matureColor: "#388E3C",
    featureType: "grape_cluster",
    featureColor: "#6A1B9A",
    featureScale: 0.18,
    featureAttachRatio: 0.70,
    featuresPerPlant: 3,
    windSensitivity: 0.6,
  },

  compact_head: {
    archetype: "compact_head",
    rows: 15,
    plantsPerRow: 17,
    rowSpacingRatio: 1.25,
    matureHeight: 0.40,
    stemRadiusBottom: 0.030,
    stemRadiusTop: 0.020,
    stemColor: "#558B2F",
    leafShape: "oval",
    leafCount: 9,
    leafLength: 0.32,
    leafWidth: 0.22,
    leafSpread: 0.42,
    leafDroop: 0.15,
    baseColor: "#43A047",
    matureColor: "#81C784",
    featureType: "cabbage_head",
    featureColor: "#A5D6A7",
    featureScale: 0.24,
    featureAttachRatio: 0.35,
    featuresPerPlant: 1,
    windSensitivity: 0.4,
  },

  broadleaf_herb: {
    archetype: "broadleaf_herb",
    rows: 16,
    plantsPerRow: 18,
    rowSpacingRatio: 1.2,
    matureHeight: 0.85,
    stemRadiusBottom: 0.020,
    stemRadiusTop: 0.012,
    stemColor: "#33691E",
    leafShape: "lanceolate",
    leafCount: 6,
    leafLength: 0.55,
    leafWidth: 0.18,
    leafSpread: 0.45,
    leafDroop: 0.35,
    baseColor: "#2E7D32",
    matureColor: "#43A047",
    featureType: "none",
    featureColor: "#FFB300",
    featureScale: 0.1,
    featureAttachRatio: 0.5,
    featuresPerPlant: 0,
    windSensitivity: 0.8,
  },
};

// ── 36+ Specific Crop Overrides ───────────────────────────────────────────────

const CROP_CUSTOMIZATIONS: Record<string, Partial<CropVisualProfile>> = {
  // CEREALS
  maize: {
    name: "Maize (Corn)",
    archetype: "tall_cereal",
    matureHeight: 1.95,
    leafLength: 0.82,
    leafWidth: 0.11,
    leafSpread: 0.72,
    leafCount: 8,
    baseColor: "#4E8E27",
    matureColor: "#689F38",
    featureType: "cob",
    featureColor: "#FBC02D",
    featureScale: 0.22,
  },
  rice: {
    name: "Rice (Paddy)",
    archetype: "dense_cereal",
    rows: 19,
    plantsPerRow: 21,
    matureHeight: 0.95,
    leafLength: 0.48,
    leafWidth: 0.035,
    leafCount: 10,
    baseColor: "#388E3C",
    matureColor: "#8BC34A",
    featureType: "panicle",
    featureColor: "#C5CAE9",
    featureScale: 0.16,
  },
  wheat: {
    name: "Wheat",
    archetype: "dense_cereal",
    rows: 19,
    plantsPerRow: 21,
    matureHeight: 1.00,
    leafLength: 0.42,
    leafWidth: 0.035,
    baseColor: "#558B2F",
    matureColor: "#D4A017",
    featureType: "grain_spike",
    featureColor: "#E0B85C",
    featureScale: 0.17,
  },
  bajra: {
    name: "Pearl Millet (Bajra)",
    archetype: "tall_cereal",
    matureHeight: 1.90,
    leafLength: 0.65,
    leafWidth: 0.08,
    featureType: "seed_head",
    featureColor: "#8D6E63",
    featureScale: 0.28,
  },
  jowar: {
    name: "Sorghum (Jowar)",
    archetype: "tall_cereal",
    matureHeight: 1.80,
    leafLength: 0.70,
    leafWidth: 0.09,
    featureType: "seed_head",
    featureColor: "#BCAAA4",
    featureScale: 0.24,
  },
  ragi: {
    name: "Finger Millet (Ragi)",
    archetype: "dense_cereal",
    matureHeight: 0.90,
    leafCount: 8,
    featureType: "grain_spike",
    featureColor: "#8D6E63",
    featureScale: 0.14,
  },
  sugarcane: {
    name: "Sugarcane",
    archetype: "tall_cereal",
    matureHeight: 2.40,
    stemRadiusBottom: 0.040,
    stemRadiusTop: 0.025,
    leafLength: 1.05,
    leafWidth: 0.09,
    leafCount: 9,
    featureType: "none",
  },

  // PULSES
  soybean: {
    name: "Soybean",
    archetype: "bushy_pulse",
    matureHeight: 0.85,
    leafCount: 7,
    leafWidth: 0.16,
    baseColor: "#689F38",
    featureType: "pod",
    featureColor: "#9CCC65",
  },
  groundnut: {
    name: "Groundnut (Peanut)",
    archetype: "low_canopy",
    rows: 17,
    plantsPerRow: 19,
    matureHeight: 0.40,
    leafSpread: 0.45,
    leafCount: 9,
    baseColor: "#2E7D32",
    featureType: "none",
  },
  arhar: {
    name: "Pigeon Pea (Arhar/Tur)",
    archetype: "bushy_pulse",
    matureHeight: 1.30,
    leafCount: 8,
    stemRadiusBottom: 0.024,
  },
  moong: {
    name: "Green Gram (Moong)",
    archetype: "bushy_pulse",
    matureHeight: 0.65,
    leafCount: 6,
    featureType: "pod",
    featureColor: "#7CB342",
  },
  urad: {
    name: "Black Gram (Urad)",
    archetype: "bushy_pulse",
    matureHeight: 0.60,
    leafCount: 6,
    featureType: "pod",
    featureColor: "#558B2F",
  },
  gram: {
    name: "Chickpea (Gram/Chana)",
    archetype: "bushy_pulse",
    matureHeight: 0.70,
    leafShape: "feathery",
    leafCount: 8,
    featureType: "pod",
    featureColor: "#AED581",
  },
  chickpea: {
    name: "Chickpea",
    archetype: "bushy_pulse",
    matureHeight: 0.70,
    leafShape: "feathery",
    leafCount: 8,
    featureType: "pod",
    featureColor: "#AED581",
  },
  lentil: {
    name: "Lentil (Masoor)",
    archetype: "bushy_pulse",
    matureHeight: 0.65,
    leafShape: "feathery",
    leafCount: 7,
    featureType: "pod",
    featureColor: "#C5E1A5",
  },
  peas: {
    name: "Field Peas (Matar)",
    archetype: "bushy_pulse",
    matureHeight: 0.80,
    leafCount: 7,
    featureType: "pod",
    featureColor: "#7CB342",
  },

  // CASH & OILSEEDS
  cotton: {
    name: "Cotton",
    archetype: "branching_cash",
    matureHeight: 1.35,
    leafWidth: 0.24,
    leafSpread: 0.68,
    baseColor: "#2E7D32",
    featureType: "boll",
    featureColor: "#FAFAFA",
    featureScale: 0.16,
    featuresPerPlant: 4,
  },
  mustard: {
    name: "Mustard (Sarson)",
    archetype: "flowering_oilseed",
    matureHeight: 1.30,
    baseColor: "#558B2F",
    matureColor: "#FDD835",
    featureType: "yellow_flowers",
    featureColor: "#FFEE58",
    featureScale: 0.19,
  },
  sunflower: {
    name: "Sunflower",
    archetype: "flowering_oilseed",
    rows: 12,
    plantsPerRow: 14,
    matureHeight: 1.80,
    stemRadiusBottom: 0.035,
    stemRadiusTop: 0.020,
    leafLength: 0.50,
    leafWidth: 0.28,
    leafCount: 8,
    baseColor: "#33691E",
    featureType: "sunflower_head",
    featureColor: "#FFC107",
    featureScale: 0.32,
    featureAttachRatio: 0.98,
    featuresPerPlant: 1,
  },
  sesame: {
    name: "Sesame (Til)",
    archetype: "flowering_oilseed",
    matureHeight: 1.15,
    leafWidth: 0.08,
    featureType: "capsule",
    featureColor: "#DCE775",
  },

  // VEGETABLES
  potato: {
    name: "Potato",
    archetype: "low_canopy",
    matureHeight: 0.55,
    leafCount: 8,
    leafSpread: 0.50,
    baseColor: "#2E7D32",
  },
  onion: {
    name: "Onion",
    archetype: "low_canopy",
    rows: 18,
    plantsPerRow: 20,
    matureHeight: 0.42,
    leafShape: "tubular",
    leafCount: 7,
    leafLength: 0.38,
    leafWidth: 0.03,
    baseColor: "#43A047",
  },
  garlic: {
    name: "Garlic",
    archetype: "low_canopy",
    rows: 18,
    plantsPerRow: 20,
    matureHeight: 0.38,
    leafShape: "tubular",
    leafCount: 6,
    leafLength: 0.32,
    leafWidth: 0.025,
    baseColor: "#4CAF50",
  },
  coriander: {
    name: "Coriander (Dhaniya)",
    archetype: "low_canopy",
    rows: 20,
    plantsPerRow: 22,
    matureHeight: 0.32,
    leafShape: "feathery",
    leafCount: 9,
    baseColor: "#388E3C",
  },
  tomato: {
    name: "Tomato",
    archetype: "fruiting_shrub",
    matureHeight: 1.10,
    leafCount: 8,
    baseColor: "#2E7D32",
    featureType: "tomato_fruit",
    featureColor: "#E53935",
    featureScale: 0.14,
    featuresPerPlant: 4,
  },
  okra: {
    name: "Okra (Bhindi)",
    archetype: "fruiting_shrub",
    matureHeight: 1.25,
    leafShape: "lobed",
    featureType: "pod",
    featureColor: "#689F38",
    featureScale: 0.18,
    featuresPerPlant: 3,
  },
  cabbage: {
    name: "Cabbage",
    archetype: "compact_head",
    matureHeight: 0.38,
    featureType: "cabbage_head",
    featureColor: "#81C784",
    featureScale: 0.26,
  },
  cauliflower: {
    name: "Cauliflower",
    archetype: "compact_head",
    matureHeight: 0.42,
    featureType: "cauliflower_curd",
    featureColor: "#FFFDE7",
    featureScale: 0.25,
  },
  bitter_gourd: {
    name: "Bitter Gourd (Karela)",
    archetype: "vine_crawler",
    matureHeight: 0.50,
    featureType: "pod",
    featureColor: "#2E7D32",
    featureScale: 0.20,
  },

  // HERBS & ROOTS
  turmeric: {
    name: "Turmeric",
    archetype: "broadleaf_herb",
    matureHeight: 0.90,
    leafCount: 6,
    leafLength: 0.58,
    leafWidth: 0.18,
    baseColor: "#2E7D32",
  },
  ginger: {
    name: "Ginger",
    archetype: "broadleaf_herb",
    matureHeight: 0.80,
    leafCount: 7,
    leafLength: 0.45,
    leafWidth: 0.12,
    baseColor: "#388E3C",
  },

  // FRUITS & VINES
  banana: {
    name: "Banana",
    archetype: "large_leaf_tree",
    rows: 7,
    plantsPerRow: 8,
    matureHeight: 2.50,
    stemRadiusBottom: 0.085,
    stemRadiusTop: 0.045,
    leafLength: 1.25,
    leafWidth: 0.45,
    leafSpread: 1.15,
    baseColor: "#2E7D32",
    matureColor: "#43A047",
    featureType: "banana_bunch",
    featureColor: "#DCE775",
    featureScale: 0.36,
  },
  papaya: {
    name: "Papaya",
    archetype: "crown_tree",
    matureHeight: 2.30,
    featureType: "papaya_fruit",
    featureColor: "#FFA726",
  },
  pomegranate: {
    name: "Pomegranate",
    archetype: "orchard_shrub",
    matureHeight: 1.70,
    featureType: "pomegranate_fruit",
    featureColor: "#C62828",
  },
  grapes: {
    name: "Grapes",
    archetype: "trellis_vine",
    matureHeight: 1.50,
    featureType: "grape_cluster",
    featureColor: "#4A148C",
  },
  watermelon: {
    name: "Watermelon",
    archetype: "vine_crawler",
    matureHeight: 0.35,
    featureType: "melon",
    featureColor: "#1B5E20",
    featureScale: 0.32,
  },
  muskmelon: {
    name: "Muskmelon",
    archetype: "vine_crawler",
    matureHeight: 0.32,
    featureType: "melon",
    featureColor: "#FFB74D",
    featureScale: 0.26,
  },
};

// ── Profile Lookup Function ──────────────────────────────────────────────────

export function getCropVisualProfile(rawCropId: string): CropVisualProfile {
  // Normalize: strip season suffix (_kharif, _rabi, _zaid), lowercase, remove spaces
  const cleanKey = (rawCropId || "")
    .toLowerCase()
    .replace(/_(kharif|rabi|zaid)/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z_]/g, "");

  // Find exact or partial key in customizations
  let matchedKey = Object.keys(CROP_CUSTOMIZATIONS).find((k) => cleanKey.includes(k) || k.includes(cleanKey));

  if (!matchedKey) {
    // Keyword heuristics
    if (cleanKey.includes("corn") || cleanKey.includes("maize")) matchedKey = "maize";
    else if (cleanKey.includes("paddy") || cleanKey.includes("rice")) matchedKey = "rice";
    else if (cleanKey.includes("wheat")) matchedKey = "wheat";
    else if (cleanKey.includes("cotton")) matchedKey = "cotton";
    else if (cleanKey.includes("soy")) matchedKey = "soybean";
    else if (cleanKey.includes("bean") || cleanKey.includes("gram") || cleanKey.includes("dal") || cleanKey.includes("pulse")) matchedKey = "moong";
    else if (cleanKey.includes("melon")) matchedKey = "watermelon";
    else if (cleanKey.includes("fruit") || cleanKey.includes("tree")) matchedKey = "pomegranate";
    else matchedKey = "wheat"; // safe fallback
  }

  const custom = CROP_CUSTOMIZATIONS[matchedKey] || {};
  const archetype = custom.archetype || "dense_cereal";
  const base = BASE_PROFILES[archetype];

  return {
    id: rawCropId,
    name: custom.name || rawCropId.replace(/_/g, " "),
    ...base,
    ...custom,
  } as CropVisualProfile;
}

// ── Procedural Geometries Factory ────────────────────────────────────────────

export function createProceduralGeometries(profile: CropVisualProfile) {
  // 1. STEM GEOMETRY (unit height 1.0, pivot at bottom)
  const stemGeo = new THREE.CylinderGeometry(
    profile.stemRadiusTop,
    profile.stemRadiusBottom,
    1.0,
    5
  );
  stemGeo.translate(0, 0.5, 0); // Origin at base

  // 2. LEAF GEOMETRY based on LeafShape (unit length 1.0, pivot at base)
  let leafGeo: THREE.BufferGeometry;

  switch (profile.leafShape) {
    case "lanceolate": {
      // Long tapering ribbon with slight curve
      leafGeo = new THREE.ConeGeometry(0.12, 1.0, 4);
      leafGeo.scale(1.0, 1.0, 0.08); // flatten
      leafGeo.translate(0, 0.5, 0);
      break;
    }
    case "fine_blade": {
      // Very slender cereal blade
      leafGeo = new THREE.ConeGeometry(0.06, 1.0, 3);
      leafGeo.scale(1.0, 1.0, 0.06);
      leafGeo.translate(0, 0.5, 0);
      break;
    }
    case "paddle": {
      // Giant broad leaf (Banana)
      leafGeo = new THREE.CylinderGeometry(0.24, 0.12, 1.0, 5);
      leafGeo.scale(1.0, 1.0, 0.06);
      leafGeo.translate(0, 0.5, 0);
      break;
    }
    case "lobed": {
      // Wide star/palmate shape (Cotton, Papaya, Tomato)
      leafGeo = new THREE.DodecahedronGeometry(0.25, 0);
      leafGeo.scale(1.4, 0.1, 1.0);
      leafGeo.translate(0, 0.25, 0);
      break;
    }
    case "tubular": {
      // Slender hollow cylinder (Onion, Garlic)
      leafGeo = new THREE.CylinderGeometry(0.015, 0.03, 1.0, 4);
      leafGeo.translate(0, 0.5, 0);
      break;
    }
    case "feathery": {
      // Small multi-part leafy cluster
      leafGeo = new THREE.IcosahedronGeometry(0.2, 0);
      leafGeo.scale(1.2, 0.3, 0.8);
      leafGeo.translate(0, 0.2, 0);
      break;
    }
    case "oval":
    default: {
      // Broad oval/trifoliate pulse leaf
      leafGeo = new THREE.SphereGeometry(0.22, 5, 4);
      leafGeo.scale(1.0, 1.5, 0.15);
      leafGeo.translate(0, 0.3, 0);
      break;
    }
  }

  // 3. MATURE FEATURE GEOMETRY
  let featureGeo: THREE.BufferGeometry;

  switch (profile.featureType) {
    case "cob": {
      // Corn Cob: cylindrical ear with husk
      featureGeo = new THREE.CylinderGeometry(0.20, 0.25, 1.0, 6);
      featureGeo.scale(1.0, 1.0, 0.8);
      break;
    }
    case "grain_spike":
    case "seed_head": {
      // Wheat spike / Bajra cylindrical head
      featureGeo = new THREE.CylinderGeometry(0.12, 0.20, 1.0, 5);
      break;
    }
    case "panicle": {
      // Drooping rice head
      featureGeo = new THREE.ConeGeometry(0.18, 1.0, 4);
      featureGeo.rotateX(Math.PI); // inverted cone drooping down
      break;
    }
    case "boll": {
      // Fluffy cotton boll (sphere)
      featureGeo = new THREE.DodecahedronGeometry(0.35, 1);
      break;
    }
    case "sunflower_head": {
      // Wide circular flower disk
      featureGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10);
      featureGeo.rotateX(Math.PI / 4); // angled towards sun
      break;
    }
    case "yellow_flowers": {
      // Clustered mustard florets
      featureGeo = new THREE.IcosahedronGeometry(0.32, 0);
      break;
    }
    case "tomato_fruit":
    case "pomegranate_fruit": {
      // Globe fruit
      featureGeo = new THREE.SphereGeometry(0.30, 6, 5);
      break;
    }
    case "banana_bunch": {
      // Hanging elongated bunch
      featureGeo = new THREE.CylinderGeometry(0.25, 0.40, 1.0, 5);
      break;
    }
    case "melon": {
      // Large melon sphere
      featureGeo = new THREE.SphereGeometry(0.40, 7, 6);
      featureGeo.scale(1.1, 0.9, 1.1);
      break;
    }
    case "cabbage_head":
    case "cauliflower_curd": {
      // Dense compact head
      featureGeo = new THREE.SphereGeometry(0.35, 6, 5);
      featureGeo.scale(1.2, 0.9, 1.2);
      break;
    }
    case "pod":
    case "capsule": {
      // Elongated pod
      featureGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 4);
      break;
    }
    case "grape_cluster": {
      // Hanging cone cluster
      featureGeo = new THREE.ConeGeometry(0.28, 0.8, 5);
      featureGeo.rotateX(Math.PI);
      break;
    }
    case "none":
    default: {
      featureGeo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
      break;
    }
  }

  return { stemGeo, leafGeo, featureGeo };
}
