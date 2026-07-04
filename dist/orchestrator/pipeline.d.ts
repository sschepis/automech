import type { LLMClient } from '../nodes/architect.js';
import type { CADPipelineEvent, ArchitectOutput } from '../types/pipeline.js';
import type { EmpiricalTestEvent } from '../types/technician.js';
export interface PipelineResult {
    status: 'completed' | 'failed' | 'blocked' | 'max_iterations';
    stlPath?: string;
    errors: string[];
    finalState: CADPipelineEvent | null;
}
export declare function runPipeline(llmClient: LLMClient, userPrompt: string, empiricalTest?: EmpiricalTestEvent): Promise<PipelineResult>;
export declare function createInitialState(architectOutput: ArchitectOutput): CADPipelineEvent;
//# sourceMappingURL=pipeline.d.ts.map