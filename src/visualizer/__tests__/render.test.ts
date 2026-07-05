import { test, expect } from 'vitest';
import { renderSTL } from '../render.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { makeCubeSTL, makeOverhangingSTL } from '../../test-utils/fixtures.js';

function writeTempSTL(buffer: Buffer): string {
  const dir = join(tmpdir(), `viz_test_${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'test.stl');
  writeFileSync(path, buffer);
  return path;
}

test('renderSTL returns 4 views for a valid cube STL', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const result = renderSTL(path);
  expect(result.errors).toHaveLength(0);
  expect(result.views).toHaveLength(4);
  expect(result.views[0].name).toBe('front');
  expect(result.views[1].name).toBe('top');
  expect(result.views[2].name).toBe('right');
  expect(result.views[3].name).toBe('iso');
});

test('renderSTL returns error for missing file', () => {
  const result = renderSTL('/nonexistent/path.stl');
  expect(result.views).toHaveLength(0);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain('not found');
});

test('renderSTL returns error for empty STL', () => {
  const path = writeTempSTL(Buffer.alloc(84, 0));
  const result = renderSTL(path);
  expect(result.errors.length).toBeGreaterThan(0);
});

test('render views contains valid SVG markup', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const result = renderSTL(path);
  for (const view of result.views) {
    expect(view.svg).toContain('<svg');
    expect(view.svg).toContain('</svg>');
    expect(view.svg).toContain('<line');
  }
});

test('render views contain data URIs', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const result = renderSTL(path);
  for (const view of result.views) {
    expect(view.dataUri).toContain('data:image/svg+xml;base64,');
  }
});

test('renderSTL handles complex overhanging geometry', () => {
  const path = writeTempSTL(makeOverhangingSTL());
  const result = renderSTL(path);
  expect(result.errors).toHaveLength(0);
  expect(result.views).toHaveLength(4);
});

test('rendered views include dimension info', () => {
  const path = writeTempSTL(makeCubeSTL(20));
  const result = renderSTL(path);
  for (const view of result.views) {
    expect(view.svg).toMatch(/\d+\.\d×\d+\.\d×\d+\.\d mm/);
  }
});
