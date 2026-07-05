import { readFileSync } from 'fs';

export interface STLFacet {
  normal: [number, number, number];
  vertices: [[number, number, number], [number, number, number], [number, number, number]];
}

export interface STLMesh {
  facets: STLFacet[];
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  volume: number;
}

export function parseSTLFacets(buffer: Buffer): STLFacet[] {
  if (buffer.length < 84) return [];
  const isAscii = buffer.toString('utf-8', 0, 80).includes('solid');
  if (isAscii) return parseSTLAscii(buffer.toString('utf-8'));
  return parseSTLBinary(buffer);
}

export function loadSTLMesh(stlPath: string): STLMesh {
  const buffer = readFileSync(stlPath);
  const facets = parseSTLFacets(buffer);
  return buildMesh(facets);
}

export function buildMesh(facets: STLFacet[]): STLMesh {
  const allVerts = facets.flatMap(f => f.vertices);
  const xs = allVerts.map(v => v[0]);
  const ys = allVerts.map(v => v[1]);
  const zs = allVerts.map(v => v[2]);
  return {
    facets,
    boundingBox: {
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    },
    volume: computeSignedVolume(facets),
  };
}

export function computeSignedVolume(facets: STLFacet[]): number {
  let volume = 0;
  for (const facet of facets) {
    const [v0, v1, v2] = facet.vertices;
    volume += (
      v0[0] * v1[1] * v2[2] +
      v0[1] * v1[2] * v2[0] +
      v0[2] * v1[0] * v2[1] -
      v0[2] * v1[1] * v2[0] -
      v0[1] * v1[0] * v2[2] -
      v0[0] * v1[2] * v2[1]
    );
  }
  return Math.abs(volume) / 6;
}

function parseSTLAscii(content: string): STLFacet[] {
  const facets: STLFacet[] = [];
  const lines = content.split('\n').map(l => l.trim());
  let currentFacet: { normal: STLFacet['normal']; vertices: STLFacet['vertices'] } | null = null;
  let vertexIndex = 0;

  for (const line of lines) {
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/).slice(2).map(Number);
      currentFacet = { normal: parts as STLFacet['normal'], vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
      vertexIndex = 0;
    } else if (line.startsWith('vertex') && currentFacet) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      currentFacet.vertices[vertexIndex] = parts as [number, number, number];
      vertexIndex++;
    } else if (line.startsWith('endfacet') && currentFacet) {
      facets.push(currentFacet as STLFacet);
      currentFacet = null;
    }
  }

  return facets;
}

function parseSTLBinary(buffer: Buffer): STLFacet[] {
  const facets: STLFacet[] = [];
  const count = buffer.readUInt32LE(80);
  let offset = 84;

  for (let i = 0; i < count; i++) {
    const nx = buffer.readFloatLE(offset); offset += 4;
    const ny = buffer.readFloatLE(offset); offset += 4;
    const nz = buffer.readFloatLE(offset); offset += 4;
    const v1: [number, number, number] = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)]; offset += 12;
    const v2: [number, number, number] = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)]; offset += 12;
    const v3: [number, number, number] = [buffer.readFloatLE(offset), buffer.readFloatLE(offset + 4), buffer.readFloatLE(offset + 8)]; offset += 12;
    offset += 2;
    facets.push({ normal: [nx, ny, nz], vertices: [v1, v2, v3] });
  }

  return facets;
}
