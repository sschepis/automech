import type { LLMClient } from '../llm/types.js';
import type { CADPipelineEvent, SimulationData } from '../types/pipeline.js';
import { existsSync } from 'fs';
import { loadSTLMesh } from '../stl/shared.js';
import { analyzeStructure } from '../simulation/structural.js';
import { analyzeResonance } from '../simulation/acoustic.js';

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

export async function executePhysicistNode(
  llmClient: LLMClient,
  state: CADPipelineEvent,
  stlPath: string,
): Promise<{ simulationResults: SimulationData; manufacturingFlags: string[] }> {
  let simulationResults: SimulationData;

  try {
    simulationResults = runDeterministicSimulation(stlPath, state);
  } catch (err) {
    simulationResults = {
      passed: false,
      maxStressMpa: Infinity,
      maxDisplacement: Infinity,
      failureRegions: [{
        coordinates: [0, 0, 0],
        stressValue: Infinity,
        failureType: 'yield',
      }],
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

function runDeterministicSimulation(
  stlPath: string,
  state: CADPipelineEvent,
): SimulationData {
  if (!existsSync(stlPath)) {
    throw new Error(`STL file not found: ${stlPath}`);
  }

  const mesh = loadSTLMesh(stlPath);
  if (mesh.facets.length === 0) {
    throw new Error('STL mesh contains no facets');
  }

  const material = state.globalConstraints.materialProfile;
  const targetPhysics = state.globalConstraints.targetPhysics;

  const structuralResult = analyzeStructure(
    mesh,
    material,
    targetPhysics?.maxLoadNewtons ?? 0,
  );

  const acousticResult = analyzeResonance(
    mesh,
    material,
    targetPhysics?.targetResonanceHz,
  );

  const structuralPassed = structuralResult.passed;
  const acousticPassed = acousticResult.passed;
  const passed = structuralPassed && acousticPassed;

  const rawResonance = acousticResult.resonanceFrequencyHz;
  const targetResonance = targetPhysics?.targetResonanceHz;
  const resonanceFrequenciesHz: number[] = [];

  if (rawResonance > 0) resonanceFrequenciesHz.push(rawResonance);
  if (targetResonance && targetResonance > 0 && !resonanceFrequenciesHz.includes(targetResonance)) {
    resonanceFrequenciesHz.push(targetResonance);
  }

  const failureRegions = [...structuralResult.failureRegions];

  if (!acousticPassed && targetResonance) {
    const cx = (mesh.boundingBox.min[0] + mesh.boundingBox.max[0]) / 2;
    const cy = (mesh.boundingBox.min[1] + mesh.boundingBox.max[1]) / 2;
    const cz = (mesh.boundingBox.min[2] + mesh.boundingBox.max[2]) / 2;
    failureRegions.push({
      coordinates: [cx, cy, cz],
      stressValue: Math.abs(acousticResult.frequencyDeltaPercent),
      failureType: 'fatigue',
    });
  }

  return {
    passed,
    maxStressMpa: structuralResult.maxStressMpa,
    maxDisplacement: structuralResult.maxDisplacement,
    failureRegions,
    resonanceFrequenciesHz,
  };
}
