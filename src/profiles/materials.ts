import type { MaterialProfile, MaterialId } from '../types/pipeline.js';

export const PLAPROFILE: MaterialProfile = {
  id: 'pla',
  name: 'PLA',
  densityGcm3: 1.24,
  tensileStrengthMpa: 50,
  flexuralModulusMpa: 3500,
  maxStrain: 0.03,
  maxOverhangDeg: 55,
  minWallThickness: 0.8,
  nozzleTempC: 210,
  bedTempC: 60,
  shrinkageXY: 0.003,
  shrinkageZ: 0.005,
  holeOffset: 0.1,
  buildPlateAdhesion: 'textured_pei',
};

export const PETGPROFILE: MaterialProfile = {
  id: 'petg',
  name: 'PETG',
  densityGcm3: 1.27,
  tensileStrengthMpa: 48,
  flexuralModulusMpa: 2800,
  maxStrain: 0.05,
  maxOverhangDeg: 50,
  minWallThickness: 1.0,
  nozzleTempC: 245,
  bedTempC: 80,
  shrinkageXY: 0.004,
  shrinkageZ: 0.006,
  holeOffset: 0.15,
  buildPlateAdhesion: 'textured_pei',
};

export const PACFPROFILE: MaterialProfile = {
  id: 'pa-cf',
  name: 'PA-CF',
  densityGcm3: 1.20,
  tensileStrengthMpa: 110,
  flexuralModulusMpa: 7500,
  maxStrain: 0.015,
  maxOverhangDeg: 40,
  minWallThickness: 1.2,
  nozzleTempC: 290,
  bedTempC: 90,
  shrinkageXY: 0.002,
  shrinkageZ: 0.003,
  holeOffset: 0.05,
  buildPlateAdhesion: 'engineering',
};

export const TPUPROFILE: MaterialProfile = {
  id: 'tpu',
  name: 'TPU',
  densityGcm3: 1.21,
  tensileStrengthMpa: 35,
  flexuralModulusMpa: 80,
  maxStrain: 0.6,
  maxOverhangDeg: 35,
  minWallThickness: 1.2,
  nozzleTempC: 235,
  bedTempC: 40,
  shrinkageXY: 0.006,
  shrinkageZ: 0.008,
  holeOffset: 0.2,
  buildPlateAdhesion: 'smooth_pei',
};

export const MATERIAL_REGISTRY: Record<MaterialId, MaterialProfile> = {
  'PLA': PLAPROFILE,
  'PETG': PETGPROFILE,
  'PA-CF': PACFPROFILE,
  'TPU': TPUPROFILE,
};

export function loadMaterialProfile(id: string): MaterialProfile {
  const profile = MATERIAL_REGISTRY[id as MaterialId];
  if (!profile) {
    throw new Error(`Unknown material: ${id}. Available: ${Object.keys(MATERIAL_REGISTRY).join(', ')}`);
  }
  return profile;
}

export function updateMaterialProfileFromFabrication(
  materialId: MaterialId,
  metrics: { measuredXY: number; measuredZ: number; measuredHoleRadius: number }
): void {
  const profile = MATERIAL_REGISTRY[materialId];
  const idealXY = 20;
  const idealZ = 20;
  const idealHoleRadius = 4;
  profile.shrinkageXY = (idealXY - metrics.measuredXY) / idealXY;
  profile.shrinkageZ = (idealZ - metrics.measuredZ) / idealZ;
  profile.holeOffset = idealHoleRadius - metrics.measuredHoleRadius;
}

export { MaterialId };
