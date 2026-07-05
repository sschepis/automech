import { readFileSync, existsSync } from 'fs';
import { parseSTLFacets, type STLFacet } from '../stl/shared.js';

export interface RenderedView {
  name: string;
  description: string;
  svg: string;
  dataUri: string;
}

export interface RenderResult {
  views: RenderedView[];
  errors: string[];
}

export function renderSTL(stlPath: string): RenderResult {
  const errors: string[] = [];

  if (!existsSync(stlPath)) {
    return { views: [], errors: ['STL file not found'] };
  }

  let facets: STLFacet[];
  try {
    const buffer = readFileSync(stlPath);
    facets = parseSTLFacets(buffer);
  } catch (err) {
    return { views: [], errors: [`STL parse error: ${err instanceof Error ? err.message : err}`] };
  }

  if (facets.length === 0) {
    return { views: [], errors: ['STL contains no facets'] };
  }

  const edges = extractEdges(facets);
  const bbox = computeBoundingBox(facets);

  const views: RenderedView[] = [
    buildView('front', 'Front view (XY plane, looking along +Z)', edges, bbox, projectFront),
    buildView('top', 'Top view (XZ plane, looking along -Y)', edges, bbox, projectTop),
    buildView('right', 'Right view (YZ plane, looking along -X)', edges, bbox, projectRight),
    buildView('iso', 'Isometric view (30° rotation)', edges, bbox, projectIsometric),
  ];

  return { views, errors };
}

interface Edge3D {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
}

interface Edge2D {
  x1: number; y1: number;
  x2: number; y2: number;
  zMid: number;
}

type Projector = (e: Edge3D) => Edge2D;

function extractEdges(facets: STLFacet[]): Edge3D[] {
  const edgeSet = new Set<string>();
  const edges: Edge3D[] = [];

  const key = (a: number, b: number, c: number, d: number, e: number, f: number) => {
    const lowX = Math.min(a, d), highX = Math.max(a, d);
    const lowY = Math.min(b, e), highY = Math.max(b, e);
    const lowZ = Math.min(c, f), highZ = Math.max(c, f);
    return `${lowX.toFixed(2)},${lowY.toFixed(2)},${lowZ.toFixed(2)}-${highX.toFixed(2)},${highY.toFixed(2)},${highZ.toFixed(2)}`;
  };

  for (const facet of facets) {
    const [v0, v1, v2] = facet.vertices;
    for (const [a, b] of [[v0, v1], [v1, v2], [v2, v0]]) {
      const k = Math.random() < 0.5 ? key(a[0], a[1], a[2], b[0], b[1], b[2]) : key(b[0], b[1], b[2], a[0], a[1], a[2]);
      if (!edgeSet.has(k)) {
        edgeSet.add(k);
        edges.push({ x1: a[0], y1: a[1], z1: a[2], x2: b[0], y2: b[1], z2: b[2] });
      }
    }
  }

  return edges;
}

function computeBoundingBox(facets: STLFacet[]) {
  const allVerts = facets.flatMap(f => f.vertices);
  const xs = allVerts.map(v => v[0]);
  const ys = allVerts.map(v => v[1]);
  const zs = allVerts.map(v => v[2]);
  return {
    min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)] as [number, number, number],
    max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)] as [number, number, number],
  };
}

function projectFront(e: Edge3D): Edge2D {
  return { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, zMid: (e.z1 + e.z2) / 2 };
}

function projectTop(e: Edge3D): Edge2D {
  return { x1: e.x1, y1: e.z1, x2: e.x2, y2: e.z2, zMid: (e.y1 + e.y2) / 2 };
}

function projectRight(e: Edge3D): Edge2D {
  return { x1: e.z1, y1: e.y1, x2: e.z2, y2: e.y2, zMid: (e.x1 + e.x2) / 2 };
}

function projectIsometric(e: Edge3D): Edge2D {
  const angle = Math.PI / 6;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const isoX = (p: [number, number, number]) => (p[0] - p[1]) * cosA;
  const isoY = (p: [number, number, number]) => (p[0] + p[1]) * sinA - p[2];
  const p1: [number, number, number] = [e.x1, e.y1, e.z1];
  const p2: [number, number, number] = [e.x2, e.y2, e.z2];
  return {
    x1: isoX(p1), y1: isoY(p1),
    x2: isoX(p2), y2: isoY(p2),
    zMid: (e.x1 + e.x2 + e.y1 + e.y2 + e.z1 + e.z2) / 6,
  };
}

function buildView(
  name: string,
  description: string,
  edges: Edge3D[],
  bbox: { min: [number, number, number]; max: [number, number, number] },
  projector: Projector,
): RenderedView {
  const projected: Edge2D[] = edges.map(projector);

  const xs = projected.flatMap(e => [e.x1, e.x2]);
  const ys = projected.flatMap(e => [e.y1, e.y2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const maxRange = Math.max(rangeX, rangeY);

  const margin = 40;
  const svgW = 500;
  const svgH = 500;
  const scale = (svgW - margin * 2) / maxRange;
  const cx = svgW / 2;
  const cy = svgH / 2;

  const tx = (v: number) => cx + (v - (minX + maxX) / 2) * scale;
  const ty = (v: number) => cy - (v - (minY + maxY) / 2) * scale;

  // Depth-sort edges (painter's algorithm — closer = lower opacity)
  const zVals = projected.map(e => e.zMid);
  const zMin = Math.min(...zVals);
  const zMax = Math.max(...zVals);
  const zRange = zMax - zMin || 1;

  const sorted = projected
    .map((e, i) => ({ e, i, zNorm: (e.zMid - zMin) / zRange }))
    .sort((a, b) => a.zNorm - b.zNorm);

  let svgPaths = '';
  for (const { e, zNorm } of sorted) {
    const alpha = 0.2 + zNorm * 0.8;
    const x1 = tx(e.x1); const y1 = ty(e.y1);
    const x2 = tx(e.x2); const y2 = ty(e.y2);
    svgPaths += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(30,60,120,${alpha.toFixed(2)})" stroke-width="1.2" />\n`;
  }

  const dimX = (bbox.max[0] - bbox.min[0]).toFixed(1);
  const dimY = (bbox.max[1] - bbox.min[1]).toFixed(1);
  const dimZ = (bbox.max[2] - bbox.min[2]).toFixed(1);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="${svgW}" height="${svgH}" fill="#f8f9fa" rx="8" />
  <text x="${svgW / 2}" y="18" text-anchor="middle" font-family="monospace" font-size="12" fill="#666">${name.toUpperCase()} — ${dimX}×${dimY}×${dimZ} mm</text>
  <line x1="${margin}" y1="${cy}" x2="${svgW - margin}" y2="${cy}" stroke="#ddd" stroke-width="0.5" stroke-dasharray="4,4" />
  <line x1="${cx}" y1="${margin}" x2="${cx}" y2="${svgH - margin}" stroke="#ddd" stroke-width="0.5" stroke-dasharray="4,4" />
  ${svgPaths}
</svg>`;

  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return { name, description, svg: svg.trim(), dataUri };
}
