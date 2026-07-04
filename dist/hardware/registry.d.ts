export interface FastenerProfile {
    id: string;
    type: 'bolt' | 'heat_set_insert' | 'nut';
    threadSize: string;
    clearanceRadius: number;
    headRadius?: number;
    headDepth?: number;
    insertTaperAngle?: number;
    insertDepth?: number;
}
export declare const HARDWARE_REGISTRY: Record<string, FastenerProfile>;
//# sourceMappingURL=registry.d.ts.map