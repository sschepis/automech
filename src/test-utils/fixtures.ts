import type { STLFacet, STLMesh } from '../stl/shared.js';

export function makeCubeSTL(size: number): Buffer {
  const h = size / 2;
  return makeFacetBuffer(makeBoxFacets(h));
}

export function makeThinWallSTL(width: number, height: number, thickness: number): Buffer {
  const hw = width / 2;
  const hh = height / 2;
  const ht = thickness / 2;

  const facets: STLFacet[] = [];

  const f = (v0: [number, number, number], v1: [number, number, number], v2: [number, number, number]) => {
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    facets.push({
      normal: [nx / len, ny / len, nz / len],
      vertices: [v0, v1, v2],
    });
  };

  // front face (+x)
  f([hw, -hh, -ht], [hw, hh, -ht], [hw, -hh, ht]);
  f([hw, hh, -ht], [hw, hh, ht], [hw, -hh, ht]);
  // back face (-x)
  f([-hw, -hh, -ht], [-hw, -hh, ht], [-hw, hh, -ht]);
  f([-hw, hh, -ht], [-hw, -hh, ht], [-hw, hh, ht]);
  // top (+y)
  f([-hw, hh, -ht], [hw, hh, ht], [hw, hh, -ht]);
  f([-hw, hh, -ht], [-hw, hh, ht], [hw, hh, ht]);
  // bottom (-y)
  f([-hw, -hh, -ht], [hw, -hh, -ht], [hw, -hh, ht]);
  f([-hw, -hh, -ht], [hw, -hh, ht], [-hw, -hh, ht]);
  // right (+z)
  f([-hw, -hh, ht], [hw, hh, ht], [-hw, hh, ht]);
  f([-hw, -hh, ht], [hw, -hh, ht], [hw, hh, ht]);
  // left (-z)
  f([-hw, -hh, -ht], [-hw, hh, -ht], [hw, hh, -ht]);
  f([-hw, -hh, -ht], [hw, hh, -ht], [hw, -hh, -ht]);

  return makeFacetBuffer(facets);
}

function makeBoxFacets(halfSize: number): STLFacet[] {
  const hs = halfSize;
  const faces: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]][] = [
    [[hs, -hs, -hs], [hs, hs, -hs], [hs, hs, hs], [hs, -hs, hs]],
    [[-hs, -hs, -hs], [-hs, -hs, hs], [-hs, hs, hs], [-hs, hs, -hs]],
    [[-hs, hs, -hs], [hs, hs, -hs], [hs, hs, hs], [-hs, hs, hs]],
    [[-hs, -hs, -hs], [-hs, hs, -hs], [hs, hs, -hs], [hs, -hs, -hs]],
    [[-hs, -hs, hs], [hs, -hs, hs], [hs, hs, hs], [-hs, hs, hs]],
    [[-hs, -hs, -hs], [hs, -hs, -hs], [hs, -hs, hs], [-hs, -hs, hs]],
  ];

  const normals: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];

  const facets: STLFacet[] = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const fv = faces[fi];
    const n = normals[fi];
    facets.push({ normal: n, vertices: [[fv[0][0], fv[0][1], fv[0][2]], [fv[1][0], fv[1][1], fv[1][2]], [fv[2][0], fv[2][1], fv[2][2]]] });
    facets.push({ normal: n, vertices: [[fv[0][0], fv[0][1], fv[0][2]], [fv[2][0], fv[2][1], fv[2][2]], [fv[3][0], fv[3][1], fv[3][2]]] });
  }
  return facets;
}

export function makeOverhangingSTL(): Buffer {
  const facets: STLFacet[] = [];

  const tri = (
    v0: [number, number, number], v1: [number, number, number], v2: [number, number, number],
  ) => {
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    const nz = e1[0] * e2[1] - e1[1] * e2[0];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    facets.push({ normal: [nx / len, ny / len, nz / len], vertices: [v0, v1, v2] });
  };

  const s = 20;
  const overhangWidth = 30;

  // bottom plate
  tri([0, 0, 0], [s, 0, 0], [0, s, 0]);
  tri([s, 0, 0], [s, s, 0], [0, s, 0]);
  // top plate (z = s)
  tri([0, 0, s], [0, s, s], [s, 0, s]);
  tri([s, 0, s], [0, s, s], [s, s, s]);
  // walls
  tri([0, 0, 0], [0, 0, s], [s, 0, 0]);
  tri([s, 0, 0], [0, 0, s], [s, 0, s]);
  tri([0, s, 0], [s, s, 0], [0, s, s]);
  tri([s, s, 0], [s, s, s], [0, s, s]);
  tri([0, 0, 0], [0, s, 0], [0, 0, s]);
  tri([0, s, 0], [0, s, s], [0, 0, s]);
  tri([s, 0, 0], [0, 0, 0], [s, s, 0]);
  tri([s, 0, 0], [s, s, 0], [0, s, 0]);

  // overhang lip at z = s, extending past x = s with 60° underside
  tri([s, 0, s], [s + overhangWidth, 0, s - overhangWidth * Math.tan(Math.PI / 6)], [s, s, s]);
  tri([s + overhangWidth, 0, s - overhangWidth * Math.tan(Math.PI / 6)], [s + overhangWidth, s, s - overhangWidth * Math.tan(Math.PI / 6)], [s, s, s]);
  tri([s + overhangWidth, 0, s - overhangWidth * Math.tan(Math.PI / 6)], [s + overhangWidth, 0, s], [s + overhangWidth, s, s - overhangWidth * Math.tan(Math.PI / 6)]);
  tri([s + overhangWidth, s, s], [s + overhangWidth, 0, s], [s + overhangWidth, s, s - overhangWidth * Math.tan(Math.PI / 6)]);

  return makeFacetBuffer(facets);
}

export function makeDisconnectedSTL(): Buffer {
  const cube1 = makeBoxFacets(10);
  const cube2 = makeBoxFacets(5).map(f => ({
    normal: f.normal,
    vertices: f.vertices.map(v => [v[0] + 20, v[1], v[2] + 40] as [number, number, number]),
  }) as STLFacet);
  return makeFacetBuffer([...cube1, ...cube2]);
}

export function makeFacetBuffer(facets: STLFacet[]): Buffer {
  const headerSize = 84;
  const facetSize = 50;
  const totalSize = headerSize + facets.length * facetSize;
  const buffer = Buffer.alloc(totalSize, 0);

  buffer.write('Binary STL test file' + '\0'.repeat(80 - 21), 0, 80, 'utf-8');
  buffer.writeUInt32LE(facets.length, 80);

  let offset = 84;
  for (const facet of facets) {
    buffer.writeFloatLE(facet.normal[0], offset); offset += 4;
    buffer.writeFloatLE(facet.normal[1], offset); offset += 4;
    buffer.writeFloatLE(facet.normal[2], offset); offset += 4;
    for (const v of facet.vertices) {
      buffer.writeFloatLE(v[0], offset); offset += 4;
      buffer.writeFloatLE(v[1], offset); offset += 4;
      buffer.writeFloatLE(v[2], offset); offset += 4;
    }
    offset += 2;
  }

  return buffer;
}

export function makeCubeMesh(size: number): STLMesh {
  const hs = size / 2;
  const facets = makeBoxFacets(hs);
  return {
    facets,
    boundingBox: { min: [-hs, -hs, -hs], max: [hs, hs, hs] },
    volume: size * size * size,
  };
}

export function makeThinWallMesh(width: number, height: number, thickness: number): STLMesh {
  const hw = width / 2;
  const hh = height / 2;
  const ht = thickness / 2;
  const facets = makeBoxFacets(Math.min(hw, hh, ht));
  return {
    facets,
    boundingBox: { min: [-Math.min(hw, ht), -Math.min(hh, ht), -ht], max: [Math.min(hw, ht), Math.min(hh, ht), ht] },
    volume: Math.min(width, thickness) * Math.min(height, thickness) * thickness,
  };
}
