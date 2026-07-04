import type { LLMClient } from './architect.js';
import type { CADPipelineEvent } from '../types/pipeline.js';

const DRAFTSMAN_SYSTEM_PROMPT = `# ROLE
You are the Draftsman Node in a deterministic mechanical engineering pipeline. You generate procedural CAD code using the @jscad/modeling library.

# OPERATING RULES
1. Your output must be a self-contained JavaScript module that exports a function named "design" returning a Geom3 object.
2. You have ONLY one import available: import pkg from '@jscad/modeling'; const { primitives, booleans, transforms } = pkg;
3. Available sub-modules:
   - primitives: cuboid, cylinder, sphere, torus, polygon, polyhedron
   - booleans: union, subtract, intersect
   - transforms: translate, rotate, scale, mirror, center
4. All dimensions are in millimeters. Build geometry using primitives + booleans + transforms.
5. For bolt holes: use cylinder with appropriate radius, then subtract. Clearance for M3 is 3.3mm diameter (radius 1.65), M4 is 4.4mm (radius 2.2), M5 is 5.5mm (radius 2.75).
6. For heat-set inserts: use cylinder with depth. M3 inserts need 4mm pilot hole (radius 2.0), 4mm depth. M4 need 5.4mm pilot hole (radius 2.7), 5mm depth.
7. For mounting flanges with bolt holes: extend the base, position cylinders at bolt locations, subtract.
8. Do NOT import any other files or modules. No import from './hardware_library', './clearances', './snapfit', etc.
9. Do NOT use fs, process, console, fetch, or any I/O. Pure geometry only.
10. Return ONLY the code. No markdown fences, no explanations, no comments.

# CODE TEMPLATE
import pkg from '@jscad/modeling';
const { primitives, booleans, transforms } = pkg;
const { cuboid, cylinder } = primitives;
const { union, subtract } = booleans;
const { translate } = transforms;

export function design() {
  // Build geometry here
  // Example: mount = cuboid({ size: [width, length, height], center: [x, y, z] })
  // Example: hole = cylinder({ radius: 1.65, height: 10, segments: 32, center: [x, y, z] })
  // Always use segments: 32 or higher for cylinders
  return finalBody;
}`;

export async function triggerDraftsmanNode(
  llmClient: LLMClient,
  state: CADPipelineEvent,
): Promise<string> {
  const constraintsStr = JSON.stringify({
    maxBoundingBox: state.globalConstraints.maxBoundingBox,
    material: state.globalConstraints.materialProfile.name,
    materialProperties: {
      maxOverhangDeg: state.globalConstraints.materialProfile.maxOverhangDeg,
      minWallThickness: state.globalConstraints.materialProfile.minWallThickness,
    },
    fastenersRequired: state.globalConstraints.fastenersRequired,
    targetPhysics: state.globalConstraints.targetPhysics ?? {},
    manufacturingFlags: state.manufacturingFlags,
  }, null, 2);

  const flagsSection = state.manufacturingFlags.length > 0
    ? `\nPAST ITERATION FEEDBACK — you MUST address these in your design:\n${state.manufacturingFlags.join('\n')}`
    : '';

  const userPrompt = `Constraints:
${constraintsStr}
${flagsSection}

Generate ONLY the self-contained JavaScript module. Do NOT import any local files. Only import from '@jscad/modeling'. Return raw code with no markdown fences.`;

  const code = await llmClient.generateText(DRAFTSMAN_SYSTEM_PROMPT, userPrompt);

  return code
    .replace(/^```(?:typescript|ts|javascript|js)?\s*\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}
