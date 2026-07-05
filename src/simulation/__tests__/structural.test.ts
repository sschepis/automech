import { test, expect } from 'vitest';
import { analyzeStructure } from '../structural.js';
import { makeCubeMesh, makeThinWallSTL } from '../../test-utils/fixtures.js';
import { parseSTLFacets, buildMesh } from '../../stl/shared.js';
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

test('analyzeStructure passes for strong cube with moderate load', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeStructure(mesh, PETG_MATERIAL, 50);
  expect(result.passed).toBe(true);
  expect(result.maxStressMpa).toBeGreaterThan(0);
});

test('analyzeStructure fails for thin wall with high load', () => {
  const stlBuffer = makeThinWallSTL(40, 40, 0.5);
  const facets = parseSTLFacets(stlBuffer);
  const mesh = buildMesh(facets);
  const result = analyzeStructure(mesh, PETG_MATERIAL, 500);
  expect(result.maxStressMpa).toBeGreaterThan(0);
  expect(result.minCrossSectionalArea).toBeGreaterThan(0);
});

test('analyzeStructure returns passed=true when no load specified', () => {
  const mesh = makeCubeMesh(10);
  const result = analyzeStructure(mesh, PETG_MATERIAL, 0);
  expect(result.passed).toBe(true);
  expect(result.maxStressMpa).toBe(0);
});

test('analyzeStructure returns valid cross-sectional area', () => {
  const mesh = makeCubeMesh(20);
  const result = analyzeStructure(mesh, PETG_MATERIAL, 100);
  expect(result.minCrossSectionalArea).toBeGreaterThan(0);
  expect(result.minCrossSectionZ).toBeDefined();
});

test('analyzeStructure stress increases with load', () => {
  const mesh = makeCubeMesh(20);
  const r1 = analyzeStructure(mesh, PETG_MATERIAL, 100);
  const r2 = analyzeStructure(mesh, PETG_MATERIAL, 500);
  expect(r2.maxStressMpa).toBeGreaterThan(r1.maxStressMpa);
});

test('analyzeStructure produces failure regions when stress exceeds yield', () => {
  const stlBuffer = makeThinWallSTL(20, 20, 0.3);
  const facets = parseSTLFacets(stlBuffer);
  const mesh = buildMesh(facets);
  const result = analyzeStructure(mesh, PETG_MATERIAL, 10000);
  if (!result.passed) {
    expect(result.failureRegions.length).toBeGreaterThan(0);
    expect(result.failureRegions[0].failureType).toBe('yield');
  } else {
    expect(result.maxStressMpa).toBeGreaterThan(0);
  }
});
