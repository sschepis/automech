import { executeArchitectNode } from '../nodes/architect.js';
import { triggerDraftsmanNode } from '../nodes/draftsman.js';
import { executePhysicistNode } from '../nodes/physicist.js';
import { executeMachinistNode } from '../nodes/machinist.js';
import { evaluateEmpiricalFeedback } from '../nodes/technician.js';
import { executeSandboxedCAD } from '../sandbox/executor.js';
import { loadMaterialProfile } from '../profiles/materials.js';
import { getClearanceProfile } from '../profiles/clearances.js';
const MAX_ITERATIONS = 5;
export async function runPipeline(llmClient, userPrompt, empiricalTest) {
    const errors = [];
    const architectResult = await executeArchitectNode(llmClient, userPrompt);
    if ('status' in architectResult) {
        return {
            status: 'blocked',
            errors: architectResult.questions,
            finalState: null,
        };
    }
    const architectOutput = architectResult;
    const materialId = architectOutput.targetMaterial;
    const materialProfile = loadMaterialProfile(materialId);
    const clearanceProfile = getClearanceProfile(materialId);
    let state = {
        iteration: 0,
        globalConstraints: {
            maxBoundingBox: architectOutput.maxBoundingBox,
            materialProfile,
            targetPhysics: architectOutput.environmentalPhysics,
            fastenersRequired: architectOutput.fastenersRequired,
            clearanceProfile,
        },
        proceduralCode: null,
        simulationResults: null,
        manufacturingFlags: [],
    };
    let constraintUpdates = null;
    if (empiricalTest) {
        constraintUpdates = evaluateEmpiricalFeedback(empiricalTest, materialId);
        state.manufacturingFlags.push(`EMPIRICAL_FEEDBACK: ${constraintUpdates.feedback}`);
        if (constraintUpdates.volumeModifier) {
            const [x, y, z] = state.globalConstraints.maxBoundingBox;
            const mod = 1 + constraintUpdates.volumeModifier / 100;
            state.globalConstraints.maxBoundingBox = [
                x * mod, y * mod, z * mod,
            ];
        }
    }
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        state.iteration = iteration;
        const sandboxRunId = `iter_${iteration}_${Date.now()}`;
        const code = await triggerDraftsmanNode(llmClient, state);
        state.proceduralCode = code;
        const sandboxResult = await executeSandboxedCAD(sandboxRunId, code);
        if (!sandboxResult.passed) {
            errors.push(`Sandbox iteration ${iteration}: ${sandboxResult.errorLog ?? 'Unknown error'}`);
            state.manufacturingFlags = [...state.manufacturingFlags, ...sandboxResult.flags];
            continue;
        }
        const stlPath = sandboxResult.stlPath;
        const { simulationResults, manufacturingFlags: physicsFlags } = await executePhysicistNode(llmClient, state, stlPath);
        state.simulationResults = simulationResults;
        state.manufacturingFlags = [...state.manufacturingFlags, ...physicsFlags];
        const { manufacturingFlags: machinistFlags } = await executeMachinistNode(state, stlPath);
        state.manufacturingFlags = [...state.manufacturingFlags, ...machinistFlags];
        const passed = simulationResults.passed && machinistFlags.length === 0;
        if (passed) {
            return {
                status: 'completed',
                stlPath,
                errors,
                finalState: state,
            };
        }
    }
    return {
        status: 'max_iterations',
        errors,
        finalState: state,
    };
}
export function createInitialState(architectOutput) {
    const materialId = architectOutput.targetMaterial;
    return {
        iteration: 0,
        globalConstraints: {
            maxBoundingBox: architectOutput.maxBoundingBox,
            materialProfile: loadMaterialProfile(materialId),
            targetPhysics: architectOutput.environmentalPhysics,
            fastenersRequired: architectOutput.fastenersRequired,
            clearanceProfile: getClearanceProfile(materialId),
        },
        proceduralCode: null,
        simulationResults: null,
        manufacturingFlags: [],
    };
}
//# sourceMappingURL=pipeline.js.map