import type { LLMClient } from '../llm/types.js';

const ARCHITECT_SYSTEM_PROMPT = `# ROLE
You are the Architect in a mechanical CAD pipeline. Your job is to take a user's general description of a 3D-printable part and elaborate it into a precise, detailed design specification that a programmer can turn into working code.

# RULES
1. The user gives a rough idea. YOU add precise dimensions, geometric relationships, and manufacturing details.
2. Every dimension must have a concrete value. No vague statements like "make it big enough."
3. Describe the part's purpose, its key features, how they relate spatially, and how they print.
4. For print-in-place mechanisms, describe clearances, hinge geometries, and how moving parts separate during printing.
5. Default to PETG material unless the user specifies otherwise.
6. Keep the entire part within a reasonable build volume — default 80×80×80mm for small desk toys, up to 200×200×200mm for functional parts.
7. Include the Bambu P1S 256×256×256mm limit as a hard cap.

# OUTPUT FORMAT
Respond with a structured specification containing:
- A title for the part
- A rich paragraph describing the complete design intent
- Key features list with dimensions and positions
- Material and print settings
- Assembly/print-in-place notes
- A bounding box in mm [X, Y, Z]`;

export async function executeArchitectNode(
  llmClient: LLMClient,
  userPrompt: string,
): Promise<{ specification: string; material: string; boundingBox: [number, number, number] }> {
  const response = await llmClient.generateText(ARCHITECT_SYSTEM_PROMPT, userPrompt);

  const validMaterials = ['PETG', 'PLA', 'PA-CF', 'TPU', 'PETG+', 'ABS', 'ASA'];
  let material = 'PETG';
  for (const m of validMaterials) {
    if (response.toUpperCase().includes(m.toUpperCase())) {
      material = m.toUpperCase();
      break;
    }
  }

  const bboxMatch = response.match(/bounding box[:\s]+.*?(\d+)\s*[,x×]\s*(\d+)\s*[,x×]\s*(\d+)/i);
  let boundingBox: [number, number, number] = [80, 80, 80];
  if (bboxMatch) {
    boundingBox = [
      parseInt(bboxMatch[1]),
      parseInt(bboxMatch[2]),
      parseInt(bboxMatch[3]),
    ];
  }

  return { specification: response, material, boundingBox };
}
