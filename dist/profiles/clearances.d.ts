import type { ClearanceProfile } from '../types/pipeline.js';
export declare const STANDARD_CLEARANCES: ClearanceProfile;
export declare const PCLEARANCES: ClearanceProfile;
export declare const PETG_CLEARANCES: ClearanceProfile;
export declare const PACF_CLEARANCES: ClearanceProfile;
export declare const TPU_CLEARANCES: ClearanceProfile;
export declare const CLEARANCE_REGISTRY: Record<string, ClearanceProfile>;
export declare function getClearanceProfile(materialId: string): ClearanceProfile;
//# sourceMappingURL=clearances.d.ts.map