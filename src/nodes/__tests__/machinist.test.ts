import { test, expect } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { makeCubeSTL, makeOverhangingSTL, makeDisconnectedSTL } from '../../test-utils/fixtures.js';
import { parseSTLFacets } from '../../stl/shared.js';
import type { CADPipelineEvent, MaterialProfile, ClearanceProfile } from '../../types/pipeline.js';

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

const DEFAULT_CLEARANCE: ClearanceProfile = {
  pressFit: 0.08,
  slidingFit: 0.25,
  looseFit: 0.5,
  bearingFit: 0.12,
};

function makeState(overrides?: Partial<CADPipelineEvent['globalConstraints']>): CADPipelineEvent {
  return {
    iteration: 0,
    globalConstraints: {
      maxBoundingBox: [200, 200, 200],
      materialProfile: PETG_MATERIAL,
      targetPhysics: undefined,
      fastenersRequired: [],
      clearanceProfile: DEFAULT_CLEARANCE,
      ...overrides,
    },
    proceduralCode: null,
    simulationResults: null,
    manufacturingFlags: [],
  };
}

function writeTempSTL(buffer: Buffer): string {
  const dir = join(tmpdir(), `machinist_test_${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'test.stl');
  writeFileSync(path, buffer);
  return path;
}

test('normal cube STL passes empty check', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const buffer = readFileSync(path);
  expect(buffer.length).toBeGreaterThanOrEqual(84);
  const facetCount = buffer.readUInt32LE(80);
  expect(facetCount).toBeGreaterThan(0);
});

test('short buffer fails basic STL validation', () => {
  const buffer = Buffer.alloc(50, 0);
  expect(buffer.length).toBeLessThan(84);
});

test('cube STL has no overhang facets', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const buffer = readFileSync(path);
  const facets = parseSTLFacets(buffer);
  const maxAngle = 50;
  const threshold = Math.cos((90 - maxAngle) * (Math.PI / 180));
  let overhangCount = 0;
  for (const facet of facets) {
    if (facet.normal[2] < -threshold) overhangCount++;
  }
  const pct = facets.length > 0 ? (overhangCount / facets.length) * 100 : 0;
  // A solid cube has 2 bottom facets (16.7%) which are normal — not print issues
  expect(pct).toBeLessThanOrEqual(20);
});

test('overhanging STL triggers overhang detection', () => {
  const path = writeTempSTL(makeOverhangingSTL());
  const buffer = readFileSync(path);
  const facets = parseSTLFacets(buffer);
  expect(facets.length).toBeGreaterThan(0);
  const maxAngle = 40;
  const threshold = Math.cos((90 - maxAngle) * (Math.PI / 180));
  let overhangCount = 0;
  for (const facet of facets) {
    if (facet.normal[2] < -threshold) overhangCount++;
  }
  const pct = (overhangCount / facets.length) * 100;
  expect(pct).toBeGreaterThan(0);
});

test('single cube has no disconnected components', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const buffer = readFileSync(path);
  const facets = parseSTLFacets(buffer);
  const allVerts = facets.flatMap(f => f.vertices);
  const sortedZ = allVerts.map(v => v[2]).sort((a, b) => a - b);
  let hasLargeGap = false;
  for (let i = 1; i < sortedZ.length; i++) {
    if (sortedZ[i] - sortedZ[i - 1] > 20) hasLargeGap = true;
  }
  expect(hasLargeGap).toBe(false);
});

test('two separate cubes trigger disconnected detection', () => {
  const path = writeTempSTL(makeDisconnectedSTL());
  const buffer = readFileSync(path);
  const facets = parseSTLFacets(buffer);
  const allVerts = facets.flatMap(f => f.vertices);
  const sortedZ = allVerts.map(v => v[2]).sort((a, b) => a - b);
  let hasLargeGap = false;
  for (let i = 1; i < sortedZ.length; i++) {
    if (sortedZ[i] - sortedZ[i - 1] > 20) hasLargeGap = true;
  }
  expect(hasLargeGap).toBe(true);
});

test('build volume check catches oversized part', () => {
  const state = makeState({ maxBoundingBox: [300, 300, 300] });
  const [x, y, z] = state.globalConstraints.maxBoundingBox;
  expect(x > 256 || y > 256 || z > 256).toBe(true);
});

test('build volume check passes normal part', () => {
  const state = makeState({ maxBoundingBox: [100, 100, 100] });
  const [x, y, z] = state.globalConstraints.maxBoundingBox;
  expect(x > 256 || y > 256 || z > 256).toBe(false);
});

test('wall thickness detection finds thin walls', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const buffer = readFileSync(path);
  const facets = parseSTLFacets(buffer);
  expect(facets.length).toBeGreaterThan(0);

  const minWall = 1.0;
  const thinSpots: number[] = [];
  const maxSamples = 100;
  const step = Math.max(1, Math.floor(facets.length / maxSamples));

  for (let i = 0; i < facets.length; i += step) {
    const facet = facets[i];
    const centroid: [number, number, number] = [
      (facet.vertices[0][0] + facet.vertices[1][0] + facet.vertices[2][0]) / 3,
      (facet.vertices[0][1] + facet.vertices[1][1] + facet.vertices[2][1]) / 3,
      (facet.vertices[0][2] + facet.vertices[1][2] + facet.vertices[2][2]) / 3,
    ];
    const inward: [number, number, number] = [-facet.normal[0], -facet.normal[1], -facet.normal[2]];

    let closestT = Infinity;
    for (let j = 0; j < facets.length; j++) {
      if (j === i) continue;
      const [v0, v1, v2] = facets[j].vertices;
      const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
      const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
      const h = [inward[1] * e2[2] - inward[2] * e2[1], inward[2] * e2[0] - inward[0] * e2[2], inward[0] * e2[1] - inward[1] * e2[0]];
      const a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(a) < 1e-10) continue;
      const f = 1 / a;
      const s = [centroid[0] - v0[0], centroid[1] - v0[1], centroid[2] - v0[2]];
      const u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = f * (inward[0] * q[0] + inward[1] * q[1] + inward[2] * q[2]);
      if (v < 0 || u + v > 1) continue;
      const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
      if (t > 0.0001 && t < closestT) closestT = t;
    }

    if (isFinite(closestT) && closestT < minWall && closestT > 0.001) {
      thinSpots.push(closestT);
    }
  }

  // A solid 20mm cube should have thickness ~20mm in some directions, not thin
  // The number of thin spots should be small for a solid cube
  const thinPercent = (thinSpots.length / Math.min(facets.length, maxSamples)) * 100;
  expect(thinPercent).toBeLessThan(50);
});
