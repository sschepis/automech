import { test, expect } from 'vitest';
import { analyzeResonance } from '../acoustic.js';
import { makeCubeMesh } from '../../test-utils/fixtures.js';
import type { MaterialProfile } from '../../types/pipeline.js';

const PETG_MATERIAL: MaterialProfile = {
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

test('analyzeResonance returns valid frequency for cube', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeResonance(mesh, PETG_MATERIAL);
  expect(result.resonanceFrequencyHz).toBeGreaterThan(0);
  expect(result.resonanceFrequencyHz).toBeLessThan(1e6);
});

test('analyzeResonance passes when no target specified', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeResonance(mesh, PETG_MATERIAL);
  expect(result.passed).toBe(true);
});

test('analyzeResonance detects off-target frequency', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeResonance(mesh, PETG_MATERIAL, 100);
  expect(result.targetFrequencyHz).toBe(100);
  expect(Math.abs(result.frequencyDeltaPercent)).toBeGreaterThan(0);
});

test('analyzeResonance handles zero volume gracefully', () => {
  const mesh = makeCubeMesh(20);
  mesh.volume = 0;
  const result = analyzeResonance(mesh, PETG_MATERIAL, 100);
  expect(result.resonanceFrequencyHz).toBe(0);
});

test('analyzeResonance larger object has lower frequency', () => {
  const smallCube = makeCubeMesh(10);
  const largeCube = makeCubeMesh(30);
  const r1 = analyzeResonance(smallCube, PETG_MATERIAL);
  const r2 = analyzeResonance(largeCube, PETG_MATERIAL);
  expect(r1.resonanceFrequencyHz).toBeGreaterThan(r2.resonanceFrequencyHz);
});

test('analyzeResonance includes stiffness estimate', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeResonance(mesh, PETG_MATERIAL, 500);
  expect(result.stiffnessEstimate).toBeGreaterThan(0);
});
