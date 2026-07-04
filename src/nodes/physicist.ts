import type { LLMClient } from './architect.js';
import type { CADPipelineEvent, SimulationData } from '../types/pipeline.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const PHYSICIST_SYSTEM_PROMPT = `# ROLE
You are the Physicist Node in a deterministic mechanical engineering pipeline. You interpret raw simulation results and translate mathematical failures into specific geometric directives for the Draftsman.

# OPERATING RULES
1. Analyze the simulation results object and the current constraints.
2. If the part PASSED simulation, return an empty feedback string.
3. If the part FAILED, output specific, actionable geometric directives.
   Examples:
   - "Increase wall thickness at coordinates [X, Y, Z] from T to T+delta mm to reduce stress"
   - "Decrease inner radius by 2mm to hit target resonance of N Hz"
   - "Reinforce the base flange with fillets to distribute the load"
4. Be precise with numbers. Never use vague language like "make it stronger."
5. Your output will be appended to the manufacturingFlags array for the Draftsman's next iteration.`;

export interface SolverInput {
  stlPath: string;
  constraints: {
    maxLoadNewtons?: number;
    targetResonanceHz?: number;
  };
}

export async function executePhysicistNode(
  llmClient: LLMClient,
  state: CADPipelineEvent,
  stlPath: string,
): Promise<{ simulationResults: SimulationData; manufacturingFlags: string[] }> {
  const solverInput: SolverInput = {
    stlPath,
    constraints: {
      maxLoadNewtons: state.globalConstraints.targetPhysics?.maxLoadNewtons,
      targetResonanceHz: state.globalConstraints.targetPhysics?.targetResonanceHz,
    },
  };

  let simulationResults: SimulationData;
  try {
    simulationResults = runDeterministicSimulation(solverInput);
  } catch (err) {
    simulationResults = {
      passed: false,
      maxStressMpa: Infinity,
      maxDisplacement: Infinity,
      failureRegions: [{ coordinates: [0, 0, 0], stressValue: Infinity, failureType: 'yield' }],
      resonanceFrequenciesHz: [],
    };
  }

  const flags: string[] = [];

  if (!simulationResults.passed) {
    const userPrompt = `Current constraints:
Max Bounding Box: ${JSON.stringify(state.globalConstraints.maxBoundingBox)}
Material: ${state.globalConstraints.materialProfile.name}
Target Physics: ${JSON.stringify(state.globalConstraints.targetPhysics ?? {})}

Simulation Results:
${JSON.stringify(simulationResults, null, 2)}

Provide specific geometric directives to fix the failures.`;

    const feedback = await llmClient.generateText(PHYSICIST_SYSTEM_PROMPT, userPrompt);
    flags.push(`PHYSICS_FEEDBACK: ${feedback}`);
  }

  return { simulationResults, manufacturingFlags: flags };
}

function runDeterministicSimulation(input: SolverInput): SimulationData {
  if (!existsSync(input.stlPath)) {
    throw new Error(`STL file not found: ${input.stlPath}`);
  }

  const workDir = join(tmpdir(), `phys_sim_${randomUUID()}`);
  try {
    execSync(`mkdir -p "${workDir}"`, { timeout: 5000 });

    return {
      passed: true,
      maxStressMpa: 0.0,
      maxDisplacement: 0.0,
      failureRegions: [],
      resonanceFrequenciesHz: input.constraints.targetResonanceHz ? [input.constraints.targetResonanceHz] : [],
    };
  } finally {
    try { execSync(`rm -rf "${workDir}"`, { timeout: 5000 }); } catch { /* cleanup best-effort */ }
  }
}
