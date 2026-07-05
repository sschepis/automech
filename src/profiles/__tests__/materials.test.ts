import { test, expect } from 'vitest';
import { loadMaterialProfile, updateMaterialProfileFromFabrication, MATERIAL_REGISTRY } from '../materials.js';
import type { MaterialId } from '../../types/pipeline.js';

test('loadMaterialProfile returns PLA profile', () => {
  const profile = loadMaterialProfile('PLA');
  expect(profile.name).toBe('PLA');
  expect(profile.tensileStrengthMpa).toBe(50);
  expect(profile.minWallThickness).toBe(0.8);
});

test('loadMaterialProfile returns PETG profile', () => {
  const profile = loadMaterialProfile('PETG');
  expect(profile.name).toBe('PETG');
  expect(profile.maxOverhangDeg).toBe(50);
});

test('loadMaterialProfile throws for unknown material', () => {
  expect(() => loadMaterialProfile('UNOBTAINIUM')).toThrow('Unknown material');
});

test('updateMaterialProfileFromFabrication recalibrates shrinkage', () => {
  const original = { ...MATERIAL_REGISTRY['PLA'] };
  updateMaterialProfileFromFabrication('PLA', {
    measuredXY: 19.5,
    measuredZ: 19.5,
    measuredHoleRadius: 3.8,
  });
  const profile = MATERIAL_REGISTRY['PLA'];
  expect(profile.shrinkageXY).not.toBe(original.shrinkageXY);
  expect(profile.holeOffset).not.toBe(original.holeOffset);
  Object.assign(MATERIAL_REGISTRY['PLA'], original);
});

test('all registered materials have required fields', () => {
  const required: MaterialId[] = ['PLA', 'PETG', 'PA-CF', 'TPU'];
  for (const id of required) {
    const p = loadMaterialProfile(id);
    expect(p.tensileStrengthMpa).toBeGreaterThan(0);
    expect(p.minWallThickness).toBeGreaterThan(0);
    expect(p.maxOverhangDeg).toBeGreaterThan(0);
    expect(p.maxStrain).toBeGreaterThan(0);
    expect(p.densityGcm3).toBeGreaterThan(0);
  }
});
