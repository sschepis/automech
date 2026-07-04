import pkg from '@jscad/modeling';
import type { ClearanceProfile, MaterialProfile } from '../types/pipeline.js';

const { primitives, booleans } = pkg;

export interface NodeParams {
  width: number;
  length: number;
  depth: number;
}

export function generateMatingVoid(
  node: NodeParams,
  clearance: number,
  material: MaterialProfile,
) {
  const totalOffset = clearance + material.holeOffset;

  const voidBody = primitives.cuboid({
    size: [
      node.width + totalOffset * 2,
      node.length + totalOffset * 2,
      node.depth + totalOffset * 2,
    ],
    center: [0, 0, node.depth / 2],
  });

  return voidBody;
}

export function generateClearanceVoid(
  node: NodeParams,
  clearanceProfile: ClearanceProfile,
  material: MaterialProfile,
  fitType: 'pressFit' | 'slidingFit' | 'looseFit' | 'bearingFit' = 'slidingFit',
) {
  return generateMatingVoid(node, clearanceProfile[fitType], material);
}
