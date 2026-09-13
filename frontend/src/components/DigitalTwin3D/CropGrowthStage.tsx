/**
 * CropGrowthStage.tsx
 *
 * Facade component preserving the existing CropGrowthStage interface,
 * delegating to the upgraded InstancedCropField renderer.
 */

import InstancedCropField from "./InstancedCropField";

interface CropGrowthStageProps {
  currentDay: number;
  durationDays: number;
  cropType: string;
  plotSize: number; // hectares
  healthScore?: number;
}

export default function CropGrowthStage(props: CropGrowthStageProps) {
  return <InstancedCropField {...props} />;
}
