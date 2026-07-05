import type { STLMesh } from '../stl/shared.js';
import type { MaterialProfile } from '../types/pipeline.js';

export interface AcousticResult {
  passed: boolean;
  resonanceFrequencyHz: number;
  targetFrequencyHz?: number;
  frequencyDeltaPercent: number;
  stiffnessEstimate: number;
}

export function analyzeResonance(
  mesh: STLMesh,
  material: MaterialProfile,
  targetResonanceHz?: number,
): AcousticResult {
  const volume = mesh.volume;

  if (volume <= 0) {
    return {
      passed: true,
      resonanceFrequencyHz: 0,
      targetFrequencyHz: targetResonanceHz,
      frequencyDeltaPercent: 0,
      stiffnessEstimate: 0,
    };
  }

  const { min, max } = mesh.boundingBox;
  const dims: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  const charLength = dims[2];

  const crossSection = computeAverageCrossSection(mesh);

  const massGrams = volume * material.densityGcm3 / 1000;

  const modulusMpa = material.flexuralModulusMpa || material.tensileStrengthMpa * 70;
  const stiffness = (modulusMpa * crossSection) / Math.max(charLength, 1);

  const resonanceHz = Math.sqrt(stiffness / Math.max(massGrams, 0.001)) / (2 * Math.PI) * 1000;

  const passed = targetResonanceHz
    ? Math.abs(resonanceHz - targetResonanceHz) / targetResonanceHz <= 0.25
    : true;

  const frequencyDeltaPercent = targetResonanceHz
    ? ((resonanceHz - targetResonanceHz) / targetResonanceHz) * 100
    : 0;

  return {
    passed,
    resonanceFrequencyHz: resonanceHz,
    targetFrequencyHz: targetResonanceHz,
    frequencyDeltaPercent,
    stiffnessEstimate: stiffness,
  };
}

function computeAverageCrossSection(mesh: STLMesh): number {
  const { min, max } = mesh.boundingBox;
  const height = max[2] - min[2];
  if (height <= 0) return 0;

  const slices = 16;
  const sliceHeight = height / slices;
  let totalArea = 0;
  let nonZeroSlices = 0;

  for (let i = 0; i <= slices; i++) {
    const zPlane = min[2] + i * sliceHeight;
    const area = estimateSliceArea(mesh, zPlane);
    if (area > 0) {
      totalArea += area;
      nonZeroSlices++;
    }
  }

  return nonZeroSlices > 0 ? totalArea / nonZeroSlices : 0;
}

function estimateSliceArea(mesh: STLMesh, zPlane: number): number {
  const eps = 0.001;
  const cx = (mesh.boundingBox.min[0] + mesh.boundingBox.max[0]) / 2;
  const cy = (mesh.boundingBox.min[1] + mesh.boundingBox.max[1]) / 2;
  const rx = (mesh.boundingBox.max[0] - mesh.boundingBox.min[0]) / 2;
  const ry = (mesh.boundingBox.max[1] - mesh.boundingBox.min[1]) / 2;
  const radius = Math.min(rx, ry) * 0.9;

  const testRays = 16;
  let totalThickness = 0;
  let hitCount = 0;

  for (let i = 0; i < testRays; i++) {
    const angle = (2 * Math.PI * i) / testRays;
    const originX = cx + radius * Math.cos(angle);
    const originY = cy + radius * Math.sin(angle);
    const origin: [number, number, number] = [originX, originY, zPlane + eps];

    let innerHit: number | null = null;
    let outerHit: number | null = null;

    for (const facet of mesh.facets) {
      const t = rayTriangleIntersect(origin, [0, 0, -1], facet.vertices);
      if (t !== null && t > 0.0001) {
        const zHit = zPlane + eps - t;
        if (innerHit === null || zHit < innerHit) innerHit = zHit;
        if (outerHit === null || zHit > outerHit) outerHit = zHit;
      }
    }

    if (innerHit !== null && outerHit !== null) {
      const thickness = outerHit - innerHit;
      if (thickness > 0) {
        totalThickness += thickness;
        hitCount++;
      }
    }
  }

  if (hitCount < 2) return 0;
  const avgThickness = totalThickness / hitCount;

  const actualRx = (mesh.boundingBox.max[0] - mesh.boundingBox.min[0]) / 2;
  const actualRy = (mesh.boundingBox.max[1] - mesh.boundingBox.min[1]) / 2;
  const circumference = 2 * Math.PI * Math.sqrt((actualRx * actualRx + actualRy * actualRy) / 2);
  return circumference * avgThickness;
}

function rayTriangleIntersect(
  origin: [number, number, number],
  direction: [number, number, number],
  vertices: [[number, number, number], [number, number, number], [number, number, number]],
): number | null {
  const [v0, v1, v2] = vertices;
  const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
  const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
  const h = cross3(direction, e2);
  const a = dot3(e1, h);
  if (Math.abs(a) < 1e-10) return null;
  const f = 1 / a;
  const s = [origin[0] - v0[0], origin[1] - v0[1], origin[2] - v0[2]];
  const u = f * dot3(s, h);
  if (u < 0 || u > 1) return null;
  const q = cross3(s, e1);
  const v = f * dot3(direction, q);
  if (v < 0 || u + v > 1) return null;
  const t = f * dot3(e2, q);
  return t > 1e-10 ? t : null;
}

function cross3(a: number[], b: number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
