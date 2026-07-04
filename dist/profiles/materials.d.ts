import type { MaterialProfile, MaterialId } from '../types/pipeline.js';
export declare const PLAPROFILE: MaterialProfile;
export declare const PETGPROFILE: MaterialProfile;
export declare const PACFPROFILE: MaterialProfile;
export declare const TPUPROFILE: MaterialProfile;
export declare const MATERIAL_REGISTRY: Record<MaterialId, MaterialProfile>;
export declare function loadMaterialProfile(id: string): MaterialProfile;
export declare function updateMaterialProfileFromFabrication(materialId: MaterialId, metrics: {
    measuredXY: number;
    measuredZ: number;
    measuredHoleRadius: number;
}): void;
export { MaterialId };
//# sourceMappingURL=materials.d.ts.map