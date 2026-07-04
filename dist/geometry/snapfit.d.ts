export interface SnapFitConstraints {
    deflectionDepth: number;
    beamThickness: number;
    maxStrain: number;
    width: number;
}
export declare function generateCantileverClip(constraints: SnapFitConstraints): unknown;
export declare function calculateRequiredLength(deflectionDepth: number, beamThickness: number, maxStrain: number): number;
//# sourceMappingURL=snapfit.d.ts.map