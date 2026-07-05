import type { CADPipelineEvent } from '../types/pipeline.js';
import { readFileSync, existsSync } from 'fs';
import { parseSTLFacets, type STLFacet } from '../stl/shared.js';
import { sliceStl } from '../slicer/index.js';

export async function executeMachinistNode(
  state: CADPipelineEvent,
  stlPath: string,
): Promise<{ manufacturingFlags: string[] }> {
  const flags: string[] = [];

  if (!existsSync(stlPath)) {
    flags.push('CRITICAL: STL file not found for manufacturing analysis.');
    return { manufacturingFlags: flags };
  }

  const emptyFlag = checkEmptyStl(stlPath);
  if (emptyFlag) {
    flags.push(emptyFlag);
    return { manufacturingFlags: flags };
  }

  flags.push(...analyzeOverhangs(stlPath, state));
  flags.push(...checkDisconnectedComponents(stlPath));
  flags.push(...checkWallThickness(stlPath, state));
  flags.push(...checkBuildVolume(state));
  flags.push(...(await runHeadlessSlicerCheck(stlPath, state)));

  return { manufacturingFlags: flags };
}

function checkEmptyStl(stlPath: string): string | null {
  try {
    const buffer = readFileSync(stlPath);
    if (buffer.length < 84) {
      return `CRITICAL: STL file is only ${buffer.length} bytes — no geometry produced.`;
    }
    const isAscii = buffer.toString('utf-8', 0, 80).includes('solid');
    if (isAscii) {
      const content = buffer.toString('utf-8');
      if (!content.includes('facet')) {
        return 'CRITICAL: ASCII STL contains no facets — geometry is empty.';
      }
    } else {
      const facetCount = buffer.readUInt32LE(80);
      if (facetCount === 0) {
        return 'CRITICAL: Binary STL has 0 facets — geometry is empty.';
      }
    }
    return null;
  } catch {
    return 'CRITICAL: Could not read STL file for empty-check.';
  }
}

function analyzeOverhangs(stlPath: string, state: CADPipelineEvent): string[] {
  const flags: string[] = [];
  const maxAngle = state.globalConstraints.materialProfile.maxOverhangDeg;
  const threshold = Math.cos((90 - maxAngle) * (Math.PI / 180));

  try {
    const buffer = readFileSync(stlPath);
    const facets = parseSTLFacets(buffer);

    if (facets.length === 0) {
      flags.push('OVERHANG_CHECK_FAILED: Could not parse facets for analysis.');
      return flags;
    }

    // Find the bottom of the mesh (build plate plane)
    const allZVals = facets.flatMap(f => f.vertices.map(v => v[2]));
    const minZ = Math.min(...allZVals);
    const buildPlateTolerance = 0.5; // 0.5mm above build plate is first layer

    let overhangCount = 0;
    let bottomCount = 0;
    const maxOverhangPercent = 15;

    for (const facet of facets) {
      const [nx, ny, nz] = facet.normal;
      const zVals = facet.vertices.map(v => v[2]);
      const avgZ = (zVals[0] + zVals[1] + zVals[2]) / 3;
      const isBottomFace = avgZ <= minZ + buildPlateTolerance;

      if (nz < -threshold) {
        if (isBottomFace) {
          bottomCount++;
        } else {
          overhangCount++;
        }
      }
    }

    const evaluableFacets = facets.length - bottomCount;
    if (evaluableFacets === 0) return flags;

    const overhangPercent = (overhangCount / evaluableFacets) * 100;
    if (overhangPercent > maxOverhangPercent) {
      flags.push(`OVERHANG_WARNING: ${overhangPercent.toFixed(1)}% of evaluable facets exceed ${maxAngle}° limit for ${state.globalConstraints.materialProfile.name} (max allowed: ${maxOverhangPercent}%). ${bottomCount} build-plate facets excluded. Consider support or redesign.`);
    }
  } catch {
    flags.push('OVERHANG_CHECK_FAILED: Could not parse STL for face normal analysis.');
  }

  return flags;
}

function checkWallThickness(stlPath: string, state: CADPipelineEvent): string[] {
  const flags: string[] = [];
  const minWall = state.globalConstraints.materialProfile.minWallThickness;

  try {
    const buffer = readFileSync(stlPath);
    const facets = parseSTLFacets(buffer);
    if (facets.length === 0) return flags;

    const thinSpots: { x: number; y: number; z: number; thickness: number }[] = [];
    const maxSamples = 200;
    const step = Math.max(1, Math.floor(facets.length / maxSamples));

    for (let i = 0; i < facets.length; i += step) {
      const facet = facets[i];
      const centroid: [number, number, number] = [
        (facet.vertices[0][0] + facet.vertices[1][0] + facet.vertices[2][0]) / 3,
        (facet.vertices[0][1] + facet.vertices[1][1] + facet.vertices[2][1]) / 3,
        (facet.vertices[0][2] + facet.vertices[1][2] + facet.vertices[2][2]) / 3,
      ];
      const inward: [number, number, number] = [
        -facet.normal[0],
        -facet.normal[1],
        -facet.normal[2],
      ];

      const hitDist = wallRayHit(facets, i, centroid, inward);
      if (hitDist !== null && hitDist < minWall && hitDist > 0.001) {
        thinSpots.push({
          x: centroid[0],
          y: centroid[1],
          z: centroid[2],
          thickness: hitDist,
        });
      }
    }

    const thinPercent = (thinSpots.length / Math.min(facets.length, maxSamples)) * 100;
    if (thinPercent > 10 || (thinSpots.length >= 3 && thinSpots.length / Math.min(facets.length, maxSamples) > 0.05)) {
      flags.push(`WALL_THICKNESS_WARNING: ${thinSpots.length} thin regions detected below ${minWall}mm minimum. Thin spots at: ${thinSpots.slice(0, 3).map(s => `[${s.x.toFixed(0)},${s.y.toFixed(0)},${s.z.toFixed(0)}]@${s.thickness.toFixed(2)}mm`).join(', ')}`);
    } else if (thinSpots.length > 0) {
      flags.push(`WALL_THICKNESS_ADVISORY: ${thinSpots.length} thin regions border ${minWall}mm minimum. Check ${thinSpots.slice(0, 2).map(s => `[${s.x.toFixed(0)},${s.y.toFixed(0)},${s.z.toFixed(0)}]`).join(', ')}`);
    }
  } catch {
    flags.push('WALL_THICKNESS_CHECK_FAILED: Could not analyze STL for wall thickness.');
  }

  return flags;
}

function wallRayHit(
  allFacets: STLFacet[],
  skipIndex: number,
  origin: [number, number, number],
  direction: [number, number, number],
): number | null {
  let closestT = Infinity;

  for (let j = 0; j < allFacets.length; j++) {
    if (j === skipIndex) continue;
    const t = rayTriangleIntersection(origin, direction, allFacets[j].vertices);
    if (t !== null && t > 0.0001 && t < closestT) {
      closestT = t;
    }
  }

  return isFinite(closestT) ? closestT : null;
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

function checkDisconnectedComponents(stlPath: string): string[] {
  const flags: string[] = [];
  try {
    const buffer = readFileSync(stlPath);
    const facets = parseSTLFacets(buffer);
    if (facets.length === 0) return flags;

    const vertexMap = new Map<string, number[]>();
    for (const facet of facets) {
      for (const v of facet.vertices) {
        const key = v.map(c => c.toFixed(2)).join(',');
        if (!vertexMap.has(key)) vertexMap.set(key, []);
        vertexMap.get(key)!.push(facets.indexOf(facet));
      }
    }

    if (vertexMap.size < 3) return flags;

    const allVerts = facets.flatMap(f => f.vertices);
    const sortedZ = allVerts.map(v => v[2]).sort((a, b) => a - b);

    const gaps: { start: number; end: number; size: number }[] = [];
    for (let i = 1; i < sortedZ.length; i++) {
      const gap = sortedZ[i] - sortedZ[i - 1];
      if (gap > 20) {
        gaps.push({ start: sortedZ[i - 1], end: sortedZ[i], size: gap });
      }
    }

    if (gaps.length > 0) {
      const gapDescs = gaps.slice(0, 3).map(g => `${g.size.toFixed(0)}mm gap at Z=${g.start.toFixed(0)}–${g.end.toFixed(0)}`);
      flags.push(`FLOATING_COMPONENTS: Detected ${gaps.length} disconnected geometry gap(s): ${gapDescs.join('; ')}. Ensure all parts are translated and unioned into one connected solid.`);
    }
  } catch {
    // skip if can't parse
  }
  return flags;
}

function checkBuildVolume(state: CADPipelineEvent): string[] {
  const flags: string[] = [];
  const [x, y, z] = state.globalConstraints.maxBoundingBox;
  const maxBuild = 256;

  if (x > maxBuild || y > maxBuild || z > maxBuild) {
    flags.push(`BUILD_VOLUME_EXCEEDED: Max dimension exceeds ${maxBuild}x${maxBuild}x${maxBuild}mm Bambu P2S build volume.`);
  }

  return flags;
}

async function runHeadlessSlicerCheck(stlPath: string, state: CADPipelineEvent): Promise<string[]> {
  const result = await sliceStl(stlPath, state.globalConstraints.materialProfile);

  if (!result.slicerName) return [];

  const flags: string[] = [...result.errors, ...result.warnings];

  if (result.success && result.metrics) {
    flags.push(`SLICER_INFO: ${result.slicerName} — ${result.metrics.filamentUsedGrams.toFixed(1)}g filament, ${result.metrics.printTimeMinutes.toFixed(0)}min, ${result.metrics.totalLayers} layers`);
  }

  return flags;
}
