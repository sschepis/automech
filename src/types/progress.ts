import type { ArchitectOutput } from './pipeline.js';
import type { SimulationData } from './pipeline.js';

export type PipelineProgressEvent =
  | { type: 'architect_start' }
  | { type: 'architect_complete'; output: ArchitectOutput }
  | { type: 'architect_blocked'; questions: string[] }
  | { type: 'iteration_start'; iteration: number; maxIterations: number }
  | { type: 'draftsman_start'; iteration: number }
  | { type: 'draftsman_complete'; iteration: number; codeLength: number }
  | { type: 'sandbox_start'; iteration: number; runId: string; docker: boolean }
  | { type: 'sandbox_complete'; iteration: number; passed: boolean; stlPath?: string }
  | { type: 'physicist_start'; iteration: number }
  | { type: 'physicist_complete'; iteration: number; passed: boolean; maxStressMpa: number }
  | { type: 'machinist_start'; iteration: number }
  | { type: 'machinist_complete'; iteration: number; flagCount: number }
  | { type: 'iteration_complete'; iteration: number; passed: boolean; flags: string[] }
  | { type: 'pipeline_complete'; status: 'completed' | 'failed' | 'blocked' | 'max_iterations'; stlPath?: string; iterations: number }
  | { type: 'pipeline_error'; error: string };

export type ProgressCallback = (event: PipelineProgressEvent) => void;

export function formatProgressEvent(event: PipelineProgressEvent): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}]`;
  switch (event.type) {
    case 'architect_start':
      return `${prefix} ARCHITECT  Parsing design constraints...`;
    case 'architect_complete':
      return `${prefix} ARCHITECT  Material=${event.output.targetMaterial} BoundingBox=${event.output.maxBoundingBox.join('x')}mm Fasteners=${event.output.fastenersRequired.length || 0}`;
    case 'architect_blocked':
      return `${prefix} ARCHITECT  BLOCKED — needs clarification:\n${event.questions.map(q => `  • ${q}`).join('\n')}`;
    case 'iteration_start':
      return `${prefix} ITERATION ${event.iteration + 1}/${event.maxIterations} Starting`;
    case 'draftsman_start':
      return `${prefix} DRAFTSMAN  Generating CAD code...`;
    case 'draftsman_complete':
      return `${prefix} DRAFTSMAN  Code generated (${event.codeLength} chars)`;
    case 'sandbox_start':
      return `${prefix} SANDBOX    Executing geometry (${event.docker ? 'docker' : 'local'})...`;
    case 'sandbox_complete':
      return `${prefix} SANDBOX    ${event.passed ? 'STL exported' : 'FAILED'}${event.stlPath ? ` → ${event.stlPath}` : ''}`;
    case 'physicist_start':
      return `${prefix} PHYSICIST  Running structural analysis...`;
    case 'physicist_complete':
      return `${prefix} PHYSICIST  ${event.passed ? 'PASSED' : 'FAILED'} (max stress: ${event.maxStressMpa.toFixed(1)} MPa)`;
    case 'machinist_start':
      return `${prefix} MACHINIST  Validating manufacturability...`;
    case 'machinist_complete':
      return `${prefix} MACHINIST  ${event.flagCount === 0 ? 'PASSED' : `${event.flagCount} flag(s)`}`;
    case 'iteration_complete':
      return `${prefix} ITERATION ${event.iteration + 1} ${event.passed ? 'PASSED' : 'retrying'}${event.flags.length ? ` — ${event.flags.join('; ')}` : ''}`;
    case 'pipeline_complete':
      return `${prefix} PIPELINE   ${event.status.toUpperCase()} (${event.iterations} iterations)${event.stlPath ? ` → ${event.stlPath}` : ''}`;
    case 'pipeline_error':
      return `${prefix} ERROR      ${event.error}`;
  }
}
