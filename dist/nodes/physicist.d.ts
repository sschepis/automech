import type { LLMClient } from './architect.js';
import type { CADPipelineEvent, SimulationData } from '../types/pipeline.js';
export interface SolverInput {
    stlPath: string;
    constraints: {
        maxLoadNewtons?: number;
        targetResonanceHz?: number;
    };
}
export declare function executePhysicistNode(llmClient: LLMClient, state: CADPipelineEvent, stlPath: string): Promise<{
    simulationResults: SimulationData;
    manufacturingFlags: string[];
}>;
//# sourceMappingURL=physicist.d.ts.map