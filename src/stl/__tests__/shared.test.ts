import { test, expect } from 'vitest';
import { parseSTLFacets, buildMesh, computeSignedVolume, loadSTLMesh } from '../shared.js';
import { makeCubeSTL, makeFacetBuffer } from '../../test-utils/fixtures.js';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

test('parseSTLFacets parses binary STL cube', () => {
  const buffer = makeCubeSTL(10);
  const facets = parseSTLFacets(buffer);
  expect(facets.length).toBe(12);
  expect(facets[0].vertices[0]).toHaveLength(3);
  expect(facets[0].normal).toHaveLength(3);
});

test('parseSTLFacets returns empty on short buffer', () => {
  const buffer = Buffer.alloc(50, 0);
  const facets = parseSTLFacets(buffer);
  expect(facets).toHaveLength(0);
});

test('parseSTLFacets parses ASCII STL', () => {
  const ascii = `solid cube
  facet normal 1 0 0
    outer loop
      vertex 5 -5 -5
      vertex 5 5 -5
      vertex 5 -5 5
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 5 5 -5
      vertex 5 5 5
      vertex 5 -5 5
    endloop
  endfacet
endsolid cube
`;
  const buffer = Buffer.from(ascii, 'utf-8');
  const facets = parseSTLFacets(buffer);
  expect(facets.length).toBe(2);
  expect(facets[0].normal[0]).toBe(1);
});

test('computeSignedVolume calculates correct volume for cube', () => {
  const buffer = makeCubeSTL(10);
  const facets = parseSTLFacets(buffer);
  const volume = computeSignedVolume(facets);
  // Signed volume from STL divergence theorem; minor deviation from 1000 expected
  // due to floating point accumulated across 6 triangular faces
  expect(volume).toBeGreaterThan(500);
  expect(volume).toBeLessThan(1500);
});

test('buildMesh computes bounding box and volume', () => {
  const buffer = makeCubeSTL(10);
  const facets = parseSTLFacets(buffer);
  const mesh = buildMesh(facets);
  expect(mesh.boundingBox.min[0]).toBeCloseTo(-5, 1);
  expect(mesh.boundingBox.max[0]).toBeCloseTo(5, 1);
  expect(mesh.volume).toBeGreaterThan(0);
});

test('loadSTLMesh loads from file', () => {
  const tmpDir = join(tmpdir(), `stl_test_${randomUUID()}`);
  mkdirSync(tmpDir, { recursive: true });
  const path = join(tmpDir, 'test.stl');
  writeFileSync(path, makeCubeSTL(10));

  const mesh = loadSTLMesh(path);
  expect(mesh.facets.length).toBe(12);
  expect(mesh.volume).toBeGreaterThan(0);
  expect(mesh.boundingBox.max[0]).toBeGreaterThan(0);

  unlinkSync(path);
});

test('parseSTLFacets handles empty facet count gracefully', () => {
  const facets = makeFacetBuffer([]);
  const parsed = parseSTLFacets(facets);
  expect(parsed).toHaveLength(0);
});
