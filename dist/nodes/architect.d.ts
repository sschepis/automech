import type { ArchitectOutput } from '../types/pipeline.js';
export interface LLMClient {
    generateStructured<T>(systemPrompt: string, userPrompt: string, schema: Record<string, unknown>): Promise<T>;
    generateText(systemPrompt: string, userPrompt: string): Promise<string>;
}
export declare function executeArchitectNode(llmClient: LLMClient, userPrompt: string): Promise<{
    status: 'BLOCKED_PENDING_USER_INPUT';
    questions: string[];
} | ArchitectOutput>;
//# sourceMappingURL=architect.d.ts.map