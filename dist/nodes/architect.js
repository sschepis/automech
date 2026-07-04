const ARCHITECT_SYSTEM_PROMPT = `# ROLE
You are the Architect Node in a deterministic mechanical engineering pipeline. Your sole purpose is to translate the user's natural language request into a strictly typed JSON object containing physical constraints and material profiles.

# OPERATING RULES
1. You do NOT design geometry. You define the bounding box and the rules.
2. If the user does not specify a material, default to "PETG" for structural components and "TPU" for flexible components.
3. If the user does not specify clearance tolerances for moving parts, default to a slidingFit of 0.20mm.
4. You MUST extract any specific fastener requirements and map them to the HARDWARE_REGISTRY keys (e.g., "m3_shcs", "m3_insert_short").
5. If the request is physically impossible or lacks critical dimensions (e.g., "Build a box" without specifying size), you MUST populate the clarificationNeeded array rather than hallucinating dimensions.
6. Identify the assembly type: "single_part", "modular", "snap_fit", or "bolt_together".
7. Default max bounding box is 200x200x200mm if not specified.`;
const INITIALIZATION_SCHEMA = {
    name: 'initialize_pipeline_constraints',
    description: 'Initializes the engineering constraints based on the user request.',
    parameters: {
        type: 'object',
        properties: {
            targetMaterial: {
                type: 'string',
                enum: ['PLA', 'PETG', 'PA-CF', 'TPU'],
                description: 'The target FDM fabrication material.',
            },
            maxBoundingBox: {
                type: 'array',
                items: { type: 'number' },
                description: 'Maximum [X, Y, Z] dimensions in millimeters.',
                minItems: 3,
                maxItems: 3,
            },
            fastenersRequired: {
                type: 'array',
                items: { type: 'string' },
                description: 'Keys mapping to the HARDWARE_REGISTRY.',
            },
            environmentalPhysics: {
                type: 'object',
                description: 'Any specific acoustic, kinetic, or fluid targets.',
                properties: {
                    targetResonanceHz: { type: 'number' },
                    maxLoadNewtons: { type: 'number' },
                },
            },
            assemblyType: {
                type: 'string',
                enum: ['single_part', 'modular', 'snap_fit', 'bolt_together'],
                description: 'The type of assembly requested.',
            },
            clarificationNeeded: {
                type: 'array',
                items: { type: 'string' },
                description: 'If critical dimensions or context are missing, list the specific questions for the human here.',
            },
        },
        required: ['targetMaterial', 'maxBoundingBox', 'fastenersRequired'],
    },
};
export async function executeArchitectNode(llmClient, userPrompt) {
    const architectOutput = await llmClient.generateStructured(ARCHITECT_SYSTEM_PROMPT, userPrompt, INITIALIZATION_SCHEMA);
    if (architectOutput.clarificationNeeded && architectOutput.clarificationNeeded.length > 0) {
        return {
            status: 'BLOCKED_PENDING_USER_INPUT',
            questions: architectOutput.clarificationNeeded,
        };
    }
    return architectOutput;
}
//# sourceMappingURL=architect.js.map