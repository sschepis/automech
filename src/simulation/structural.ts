import type { STLMesh, STLFacet } from '../stl/shared.js';
import type { MaterialProfile, FailureRegion } from '../types/pipeline.js';

const SAFETY_FACTOR = 3.0;

export interface StructuralResult {
  passed: boolean;
  maxStressMpa: number;
  maxDisplacement: number;
  failureRegions: FailureRegion[];
  minCrossSectionalArea: number;
  minCrossSectionZ: number;
}

export function analyzeStructure(
  mesh: STLMesh,
  material: MaterialProfile,
  maxLoadNewtons: number,
): StructuralResult {
  if (!maxLoadNewtons || maxLoadNewtons <= 0) {
    return { passed: true, maxStressMpa: 0, maxDisplacement: 0, failureRegions: [], minCrossSectionalArea: Infinity, minCrossSectionZ: 0 };
  }

  const { min, max } = mesh.boundingBox;
  const height = max[2] - min[2];
  if (height <= 0) {
    return { passed: true, maxStressMpa: 0, maxDisplacement: 0, failureRegions: [], minCrossSectionalArea: Infinity, minCrossSectionZ: 0 };
  }

  const slices = 64;
  const sliceHeight = height / slices;
  let minArea = Infinity;
  let minAreaZ = 0;

  for (let i = 0; i <= slices; i++) {
    const zPlane = min[2] + i * sliceHeight;
    const area = computeCrossSectionalArea(mesh, zPlane);
    if (area > 0 && area < minArea) {
      minArea = area;
      minAreaZ = zPlane;
    }
  }

  if (!isFinite(minArea) || minArea <= 0) {
    return { passed: true, maxStressMpa: 0, maxDisplacement: 0, failureRegions: [], minCrossSectionalArea: 0, minCrossSectionZ: 0 };
  }

  const stressMpa = maxLoadNewtons / minArea;
  const allowableStress = material.tensileStrengthMpa / SAFETY_FACTOR;
  const passed = stressMpa <= allowableStress;

  const modulus = material.flexuralModulusMpa || material.tensileStrengthMpa * 70;
  const displacement = maxLoadNewtons * height / (modulus * minArea);

  const failureRegions: FailureRegion[] = [];
  if (!passed) {
    failureRegions.push({
      coordinates: [
        (max[0] + min[0]) / 2,
        (max[1] + min[1]) / 2,
        minAreaZ,
      ],
      stressValue: stressMpa,
      failureType: 'yield',
    });
  }

  return {
    passed,
    maxStressMpa: stressMpa,
    maxDisplacement: displacement,
    failureRegions,
    minCrossSectionalArea: minArea,
    minCrossSectionZ: minAreaZ,
  };
}

function computeCrossSectionalArea(mesh: STLMesh, zPlane: number): number {
  const intersections: number[] = [];
  const eps = 0.001;

  const testRays = 32;
  const cx = (mesh.boundingBox.min[0] + mesh.boundingBox.max[0]) / 2;
  const cy = (mesh.boundingBox.min[1] + mesh.boundingBox.max[1]) / 2;
  const rx = (mesh.boundingBox.max[0] - mesh.boundingBox.min[0]) / 2;
  const ry = (mesh.boundingBox.max[1] - mesh.boundingBox.min[1]) / 2;

  const radius = Math.min(rx, ry) * 0.9;

  for (let i = 0; i < testRays; i++) {
    const angle = (2 * Math.PI * i) / testRays;
    const originX = cx + radius * Math.cos(angle);
    const originY = cy + radius * Math.sin(angle);
    const origin: [number, number, number] = [originX, originY, zPlane + eps];
    const direction: [number, number, number] = [0, 0, -1];

    const hitZ = firstRayHit(mesh.facets, origin, direction);
    if (hitZ !== null) {
      const signedDist = zPlane - hitZ;
      if (signedDist > 0) {
        intersections.push(signedDist);
      }
    }
  }

  if (intersections.length < 3) return 0;

  intersections.sort((a, b) => a - b);
  const median = intersections[Math.floor(intersections.length / 2)];

  const actualRx = (mesh.boundingBox.max[0] - mesh.boundingBox.min[0]) / 2;
  const actualRy = (mesh.boundingBox.max[1] - mesh.boundingBox.min[1]) / 2;
  return Math.PI * actualRx * actualRy * (median / Math.max(actualRx, actualRy));
}

function firstRayHit(
  facets: STLFacet[],
  origin: [number, number, number],
  direction: [number, number, number],
): number | null {
  let closestT = Infinity;

  for (const facet of facets) {
    const t = rayTriangleIntersection(origin, direction, facet.vertices);
    if (t !== null && t > 0.0001 && t < closestT) {
      closestT = t;
    }
  }

  if (!isFinite(closestT)) return null;
  return origin[2] - closestT;
}

function rayTriangleIntersection(
  origin: [number, number, number],
  direction: [number, number, number],
  vertices: [[number, number, number], [number, number, number], [number, number, number]],
): number | null {
  const [v0, v1, v2] = vertices;
  const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
  const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

  const h = cross(direction, e2);
  const a = dot(e1, h);

  if (Math.abs(a) < 1e-10) return null;

  const f = 1 / a;
  const s = [origin[0] - v0[0], origin[1] - v0[1], origin[2] - v0[2]];
  const u = f * dot(s, h);

  if (u < 0 || u > 1) return null;

  const q = cross(s, e1);
  const v = f * dot(direction, q);

  if (v < 0 || u + v > 1) return null;

  const t = f * dot(e2, q);
  return t > 1e-10 ? t : null;
}

function cross(a: number[], b: number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
