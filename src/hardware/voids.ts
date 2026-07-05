import pkg from '@jscad/modeling';
import type { FastenerProfile } from './registry.js';
import type { MaterialProfile } from '../types/pipeline.js';

const { primitives, booleans, transforms } = pkg;
const { cylinder } = primitives;
const { translate } = transforms;

export function generateFastenerVoid(
  fastener: FastenerProfile,
  depth: number,
  material: MaterialProfile,
) {
  const compensatedRadius = fastener.clearanceRadius + material.holeOffset;

  switch (fastener.type) {
    case 'heat_set_insert':
      return cylinder({
        radius: compensatedRadius,
        height: fastener.insertDepth ?? depth,
        segments: 32,
      });

    case 'bolt':
      return boltVoid(fastener, depth, material);

    case 'nut':
      return nutVoid(fastener, depth, material);

    case 'washer':
      return washerVoid(fastener, material);

    case 'threaded_rod':
      return cylinder({
        radius: compensatedRadius,
        height: fastener.rodLength ?? depth,
        segments: 32,
      });

    case 'self_tapping':
      return selfTapVoid(fastener, depth, material);

    case 'dowel_pin':
      return cylinder({
        radius: compensatedRadius,
        height: depth,
        segments: 32,
      });

    case 'magnet':
      return cylinder({
        radius: compensatedRadius,
        height: fastener.magnetDepth ?? depth,
        segments: 32,
      });

    case 'bearing':
      return bearingVoid(fastener, material);

    default:
      return cylinder({ radius: compensatedRadius, height: depth, segments: 32 });
  }
}

function boltVoid(fastener: FastenerProfile, depth: number, material: MaterialProfile): any {
  const r = fastener.clearanceRadius + material.holeOffset;
  const shaft = cylinder({ radius: r, height: depth, segments: 32 });
  const headR = (fastener.headRadius ?? r * 1.5) + material.holeOffset;
  const headD = fastener.headDepth ?? depth * 0.5;
  const head = translate(
    [0, 0, depth / 2],
    cylinder({ radius: headR, height: headD, segments: 32 }),
  );
  try {
    return booleans.union(shaft, head);
  } catch {
    return shaft;
  }
}

function nutVoid(fastener: FastenerProfile, depth: number, material: MaterialProfile): any {
  const nutRadius = fastener.clearanceRadius * 1.8 + material.holeOffset;
  const nutHeight = depth * 0.4;
  return translate(
    [0, 0, depth - nutHeight / 2],
    cylinder({ radius: nutRadius, height: nutHeight, segments: 6 }),
  );
}

function washerVoid(fastener: FastenerProfile, material: MaterialProfile): any {
  const od = (fastener.washerOD ?? 10) / 2 + material.holeOffset;
  const id = fastener.clearanceRadius + material.holeOffset;
  const thickness = fastener.washerThickness ?? 1;
  try {
    const outer = cylinder({ radius: od, height: thickness, segments: 32 });
    const inner = cylinder({ radius: id, height: thickness + 0.5, segments: 32, center: [0, 0, 0.25] });
    return booleans.subtract(outer, inner);
  } catch {
    return cylinder({ radius: od, height: thickness, segments: 32 });
  }
}

function selfTapVoid(fastener: FastenerProfile, depth: number, material: MaterialProfile): any {
  const pilotR = (fastener.pilotHoleRadius ?? fastener.clearanceRadius * 0.75) + material.holeOffset;
  const shaft = cylinder({ radius: pilotR, height: depth, segments: 32 });
  const headR = (fastener.headRadius ?? pilotR * 2) + material.holeOffset;
  const headD = fastener.headDepth ?? 2;
  try {
    const head = translate(
      [0, 0, depth / 2],
      cylinder({ radius: headR, height: headD, segments: 32 }),
    );
    return booleans.union(shaft, head);
  } catch {
    return shaft;
  }
}

function bearingVoid(fastener: FastenerProfile, material: MaterialProfile): any {
  const od = (fastener.bearingOD ?? 22) / 2 + material.holeOffset;
  const id = (fastener.bearingID ?? 8) / 2 + material.holeOffset;
  const width = fastener.bearingWidth ?? 7;
  try {
    const outer = cylinder({ radius: od, height: width, segments: 32 });
    const inner = cylinder({ radius: id, height: width + 0.5, segments: 32, center: [0, 0, 0.25] });
    return booleans.subtract(outer, inner);
  } catch {
    return cylinder({ radius: od, height: width, segments: 32 });
  }
}
