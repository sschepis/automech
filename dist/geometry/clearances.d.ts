import type { ClearanceProfile, MaterialProfile } from '../types/pipeline.js';
export interface NodeParams {
    width: number;
    length: number;
    depth: number;
}
export declare function generateMatingVoid(node: NodeParams, clearance: number, material: MaterialProfile): unknown;
export declare function generateClearanceVoid(node: NodeParams, clearanceProfile: ClearanceProfile, material: MaterialProfile, fitType?: 'pressFit' | 'slidingFit' | 'looseFit' | 'bearingFit'): unknown;
//# sourceMappingURL=clearances.d.ts.map