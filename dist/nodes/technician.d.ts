import type { EmpiricalTestEvent, ConstraintUpdates } from '../types/technician.js';
import type { MaterialId } from '../types/pipeline.js';
export declare function evaluateEmpiricalFeedback(testData: EmpiricalTestEvent, materialId: MaterialId): ConstraintUpdates;
export declare function calculateRequiredVolumeShift(deltaHz: number, measuredFrequencyHz: number): number;
//# sourceMappingURL=technician.d.ts.map