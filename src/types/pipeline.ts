export interface MaterialProfile {
  id: string;
  name: string;
  densityGcm3: number;
  tensileStrengthMpa: number;
  flexuralModulusMpa: number;
  maxStrain: number;
  maxOverhangDeg: number;
  minWallThickness: number;
  nozzleTempC: number;
  bedTempC: number;
  shrinkageXY: number;
  shrinkageZ: number;
  holeOffset: number;
  buildPlateAdhesion: 'smooth_pei' | 'textured_pei' | 'engineering' | 'cool_plate';
}

export interface SimulationData {
  passed: boolean;
  maxStressMpa: number;
  maxDisplacement: number;
  failureRegions: FailureRegion[];
  resonanceFrequenciesHz: number[];
}

export interface FailureRegion {
  coordinates: [number, number, number];
  stressValue: number;
  failureType: 'yield' | 'fatigue' | 'buckling';
}

export interface ClearanceProfile {
  pressFit: number;
  slidingFit: number;
  looseFit: number;
  bearingFit: number;
}

export interface CADPipelineEvent {
  iteration: number;
  globalConstraints: GlobalConstraints;
  proceduralCode: string | null;
  simulationResults: SimulationData | null;
  manufacturingFlags: string[];
}

export interface GlobalConstraints {
  maxBoundingBox: [number, number, number];
  materialProfile: MaterialProfile;
  targetPhysics?: TargetPhysics;
  fastenersRequired: string[];
  clearanceProfile: ClearanceProfile;
}

export interface TargetPhysics {
  targetResonanceHz?: number;
  maxLoadNewtons?: number;
  appliedPressureNewtons?: number;
}

export interface ArchitectOutput {
  targetMaterial: string;
  maxBoundingBox: [number, number, number];
  fastenersRequired: string[];
  environmentalPhysics?: TargetPhysics;
  clarificationNeeded: string[];
  assemblyType?: 'single_part' | 'modular' | 'snap_fit' | 'bolt_together';
}

export interface SandboxResult {
  passed: boolean;
  stlPath?: string;
  errorLog?: string;
  flags: string[];
}

export type MaterialId = 'PLA' | 'PETG' | 'PA-CF' | 'TPU';
