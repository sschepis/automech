import { test, expect } from 'vitest';
import { getClearanceProfile } from '../clearances.js';

test('getClearanceProfile returns profile for known material', () => {
  const profile = getClearanceProfile('PLA');
  expect(profile.pressFit).toBeGreaterThan(0);
  expect(profile.slidingFit).toBeGreaterThan(profile.pressFit);
  expect(profile.looseFit).toBeGreaterThan(profile.slidingFit);
  expect(profile.bearingFit).toBeGreaterThan(0);
});

test('getClearanceProfile returns standard fallback for unknown', () => {
  const profile = getClearanceProfile('UNKNOWN');
  expect(profile.pressFit).toBe(0.05);
  expect(profile.slidingFit).toBe(0.2);
});

test('clearance profiles maintain press < sliding < loose for all materials', () => {
  for (const id of ['pla', 'petg', 'pa-cf', 'tpu', 'standard']) {
    const p = getClearanceProfile(id as any);
    expect(p.pressFit).toBeLessThan(p.slidingFit);
    expect(p.slidingFit).toBeLessThan(p.looseFit);
  }
});
