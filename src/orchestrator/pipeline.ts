import type { LLMClient } from '../llm/types.js';
import { executeArchitectNode } from '../nodes/architect.js';
import { executeProgrammerNode } from '../nodes/programmer.js';
import { executeEvaluatorNode, type EvaluatorResult } from '../nodes/evaluator.js';
import { executePhysicistNode } from '../nodes/physicist.js';
import { executeMachinistNode } from '../nodes/machinist.js';
import { executeOpenSCAD, type ExecutionResult } from '../sandbox/executor.js';
import { loadMaterialProfile } from '../profiles/materials.js';
import { getClearanceProfile } from '../profiles/clearances.js';
import { renderSTL } from '../visualizer/render.js';
import type { CADPipelineEvent, MaterialId } from '../types/pipeline.js';
import type { ProgressCallback } from '../types/progress.js';
import type { AutomechConfig } from '../config/types.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';

const EVAL_MAX_RETRIES = 3;
const OUTPUT_DIR = resolve(process.cwd(), 'output');

async function svgDataUriToPngDataUri(svgDataUri: string): Promise<string> {
  const base64 = svgDataUri.replace('data:image/svg+xml;base64,', '');
  const svgBuffer = Buffer.from(base64, 'base64');
  const pngBuffer = await sharp(svgBuffer).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

export interface PipelineOptions {
  existingStlPath?: string;
  existingScadPath?: string;
  iterationRunId?: string;
  iterationFeedback?: string;
}

export interface PipelineResult {
  status: 'completed' | 'failed' | 'blocked' | 'max_iterations';
  runId?: string;
  stlPath?: string;
  renderPaths?: string[];
  specification?: string;
  errors: string[];
  finalState: CADPipelineEvent | null;
}

export async function runPipeline(
  llmClient: LLMClient,
  userPrompt: string,
  onProgress?: ProgressCallback,
  config?: AutomechConfig,
  options?: PipelineOptions,
): Promise<PipelineResult> {
  const errors: string[] = [];
  let specification = '';
  let material = 'PETG';
  let boundingBox: [number, number, number] = [80, 80, 80];
  let existingCode: string | null = null;

  // ── Mode: Iterate on existing run ──
  if (options?.iterationRunId) {
    const runDir = join(OUTPUT_DIR, options.iterationRunId);
    const scadPath = join(runDir, 'model.scad');
    const metaPath = join(runDir, 'run.json');

    if (!existsSync(scadPath)) {
      return { status: 'failed', errors: [`Run ${options.iterationRunId} not found in output/`], finalState: null };
    }

    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      specification = meta.specification || '';
      material = meta.material || 'PETG';
      if (meta.boundingBox) boundingBox = meta.boundingBox;
    }

    existingCode = readFileSync(scadPath, 'utf-8');

    if (options.iterationFeedback) {
      specification = `${specification}\n\n## ITERATION FEEDBACK FROM USER\n${options.iterationFeedback}`;
    }

    onProgress?.({ type: 'architect_start' });
    onProgress?.({ type: 'architect_complete', output: { targetMaterial: material, maxBoundingBox: boundingBox, fastenersRequired: [], clarificationNeeded: [] } as any });
  }

  // ── Mode: Improve existing SCAD ──
  else if (options?.existingScadPath) {
    if (!existsSync(options.existingScadPath)) {
      return { status: 'failed', errors: [`SCAD file not found: ${options.existingScadPath}`], finalState: null };
    }

    existingCode = readFileSync(options.existingScadPath, 'utf-8');
    specification = `Improve the following design: ${userPrompt}\n\nExisting OpenSCAD code is provided.`;

    onProgress?.({ type: 'architect_start' });
    onProgress?.({ type: 'architect_complete', output: { targetMaterial: material, maxBoundingBox: boundingBox, fastenersRequired: [], clarificationNeeded: [] } as any });
  }

  // ── Mode: Reverse-engineer from STL ──
  else if (options?.existingStlPath) {
    if (!existsSync(options.existingStlPath)) {
      return { status: 'failed', errors: [`STL file not found: ${options.existingStlPath}`], finalState: null };
    }

    onProgress?.({ type: 'architect_start' });
    const renderResult = renderSTL(options.existingStlPath);
    const stlImageUris = await Promise.all(renderResult.views.map(v => svgDataUriToPngDataUri(v.dataUri)));

    // Ask evaluator to critique the STL, then programmer to reverse-engineer
    specification = `The user provided an existing STL file and wants it improved: "${userPrompt}".\n\n## ORIGINAL STL (wireframe renders)\nAnalyze this STL: what are its features, what needs improvement? Then generate improved OpenSCAD code.`;
    onProgress?.({ type: 'architect_complete', output: { targetMaterial: material, maxBoundingBox: boundingBox, fastenersRequired: [], clarificationNeeded: [] } as any });

    if (llmClient.generateVision) {
      const critique = await llmClient.generateVision(
        'Analyze this 3D model shown in wireframe renders. Describe its features, proportions, and any obvious issues that should be improved.',
        `The user wants: ${userPrompt}`,
        stlImageUris,
      );
      specification = `${specification}\n\n## VISION ANALYSIS OF ORIGINAL STL\n${critique}`;
    }

    existingCode = null; // force fresh generation
  }

  // ── Mode: Fresh design ──
  else {
    onProgress?.({ type: 'architect_start' });
    const result = await executeArchitectNode(llmClient, userPrompt);
    specification = result.specification;
    material = result.material;
    boundingBox = result.boundingBox;
    onProgress?.({ type: 'architect_complete', output: { targetMaterial: material, maxBoundingBox: boundingBox, fastenersRequired: [], clarificationNeeded: [] } as any });
  }

  const materialProfile = loadMaterialProfile(material as MaterialId);
  const clearanceProfile = getClearanceProfile(material);

  const state: CADPipelineEvent = {
    iteration: 0,
    globalConstraints: {
      maxBoundingBox: boundingBox,
      materialProfile,
      clearanceProfile,
      fastenersRequired: [],
    },
    proceduralCode: null,
    simulationResults: null,
    manufacturingFlags: [],
  };

  // ── Programmer → OpenSCAD → Render → Evaluate loop ──
  let code = existingCode || '';
  let execResult: ExecutionResult | null = null;
  let prevIssueCount = Infinity;

  for (let attempt = 0; attempt < EVAL_MAX_RETRIES; attempt++) {
    onProgress?.({ type: 'iteration_start', iteration: attempt, maxIterations: EVAL_MAX_RETRIES });

    if (!existingCode || attempt > 0) {
      const feedback = attempt > 0 && code
        ? { previousCode: code, evaluationIssues: errors.filter(e => e.startsWith('Visual eval failed:')).slice(-5) }
        : undefined;

      code = await executeProgrammerNode(llmClient, specification, feedback?.evaluationIssues?.length ? feedback as any : undefined);
    }
    state.proceduralCode = code;

    execResult = await executeOpenSCAD(code);
    if (!execResult.success) {
      errors.push(`OpenSCAD attempt ${attempt + 1}: ${execResult.error}`);
      onProgress?.({ type: 'iteration_complete', iteration: attempt, passed: false, flags: [execResult.error || 'OpenSCAD failed'] });
      continue;
    }

    if (execResult.pngPaths && execResult.pngPaths.length > 0 && llmClient.generateVision) {
      const imageUris = execResult.pngPaths.map(p => {
        const buf = readFileSync(p);
        return `data:image/png;base64,${buf.toString('base64')}`;
      });

      const evalResult = await executeEvaluatorNode(llmClient, specification, imageUris);
      const issueCount = evalResult.issues.length;
      const isLastAttempt = attempt >= EVAL_MAX_RETRIES - 1;

      if (!evalResult.passed && issueCount > 0) {
        const improving = issueCount <= prevIssueCount;
        prevIssueCount = issueCount;

        if (isLastAttempt && improving) {
          // Final attempt and quality is improving — accept as close enough
          errors.push(`Visual eval: acceptable (${issueCount} issues, improving from prior rounds). Proceeding.`);
          onProgress?.({ type: 'iteration_complete', iteration: attempt, passed: true, flags: [] });
          break;
        }

        errors.push(`Visual eval failed: ${evalResult.summary}`);

        const progFeedback = {
          previousCode: code,
          evaluationIssues: evalResult.issues,
          imageDataUris: imageUris,
        };
        code = await executeProgrammerNode(llmClient, specification, progFeedback);
        state.proceduralCode = code;
        continue;
      }

      // Passed or zero issues — accept
      prevIssueCount = issueCount;
      onProgress?.({ type: 'iteration_complete', iteration: attempt, passed: true, flags: [] });
      break;
    } else {
      onProgress?.({ type: 'iteration_complete', iteration: attempt, passed: true, flags: [] });
      break;
    }
  }

  if (!execResult?.success || !execResult?.stlPath) {
    return { status: 'failed', errors, specification, finalState: state };
  }

  const stlPath = execResult.stlPath;
  const renderPaths = execResult.pngPaths?.length ? execResult.pngPaths : undefined;
  const runId = execResult.runId;

  // Save run metadata
  try {
    writeFileSync(join(OUTPUT_DIR, runId, 'run.json'), JSON.stringify({
      runId,
      prompt: userPrompt.slice(0, 500),
      specification: specification.slice(0, 2000),
      material,
      boundingBox,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, null, 2));
  } catch { /* best effort */ }

  // Save run index
  try {
    const indexPath = join(OUTPUT_DIR, 'index.json');
    let index: any[] = [];
    if (existsSync(indexPath)) index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    index.push({ runId, prompt: userPrompt.slice(0, 120), status: 'pending', createdAt: new Date().toISOString() });
    writeFileSync(indexPath, JSON.stringify(index.slice(-50), null, 2));
  } catch { /* best effort */ }

  // ── Physics + Manufacturing ──
  const mfgFlags: string[] = [];
  onProgress?.({ type: 'physicist_start', iteration: 0 });
  const { simulationResults, manufacturingFlags: physicsFlags } = await executePhysicistNode(llmClient, state, stlPath);
  state.simulationResults = simulationResults;
  mfgFlags.push(...physicsFlags);
  onProgress?.({ type: 'physicist_complete', iteration: 0, passed: simulationResults.passed, maxStressMpa: simulationResults.maxStressMpa });

  onProgress?.({ type: 'machinist_start', iteration: 0 });
  const { manufacturingFlags: machinistFlags } = await executeMachinistNode(state, stlPath);
  mfgFlags.push(...machinistFlags);
  onProgress?.({ type: 'machinist_complete', iteration: 0, flagCount: machinistFlags.length });

  if (mfgFlags.length > 0) errors.push(...mfgFlags);

  const finalStatus = simulationResults.passed && machinistFlags.length === 0 ? 'completed' as const : 'failed' as const;

  // Update metadata with final status
  try {
    const metaPath = join(OUTPUT_DIR, runId, 'run.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      meta.status = finalStatus;
      meta.completedAt = new Date().toISOString();
      writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    }
    if (existsSync(join(OUTPUT_DIR, 'index.json'))) {
      const index = JSON.parse(readFileSync(join(OUTPUT_DIR, 'index.json'), 'utf-8'));
      const entry = index.find((e: any) => e.runId === runId);
      if (entry) entry.status = finalStatus;
      writeFileSync(join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
    }
  } catch { /* best effort */ }

  onProgress?.({ type: 'pipeline_complete', status: finalStatus, stlPath, iterations: 1 });
  return { status: finalStatus, runId, stlPath, renderPaths, specification, errors, finalState: state };
}
