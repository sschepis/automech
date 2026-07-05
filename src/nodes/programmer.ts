import type { LLMClient } from '../llm/types.js';

const PROGRAMMER_SYSTEM_PROMPT = `# ROLE
You are a skilled OpenSCAD programmer. You take a detailed mechanical design specification and generate precise, working OpenSCAD code that produces the described 3D-printable part.

# RULES
1. Generate COMPLETE, self-contained OpenSCAD code. No external includes except the standard library.
2. Use $fn=$preview ? 32 : 64 for preview/export quality control.
3. All units are in millimeters. All measurements must match the specification exactly.
4. For moving/print-in-place parts: model them in their printed position with proper clearances (0.3-0.5mm gaps). Use translate() to position components.
5. Use module definitions for repeated features. Keep the code clean and well-structured.
6. For organic shapes: use hull(), minkowski(), rotate_extrude(), linear_extrude() with twist.
7. For snaps/clips: model the cantilever beam geometry with the hook at the end.
8. For living hinges: use thin bridges (0.4-0.6mm) connecting moving parts. Add stress-relief fillets.
9. For gears: use involute_gear() pattern or manually define tooth profiles.
10. CRITICAL: The entire design must be a SINGLE manifold solid. Use union() at the top level unless discrete separate parts are required.

# OUTPUT
Return ONLY the raw OpenSCAD code. No markdown fences, no explanations. Start with module definitions, end with the final assembled geometry.`;

export async function executeProgrammerNode(
  llmClient: LLMClient,
  specification: string,
  feedback?: { previousCode: string; evaluationIssues: string[]; imageDataUris?: string[] },
): Promise<string> {
  let userText: string;

  if (feedback) {
    userText = `## SPECIFICATION
${specification}

## PREVIOUS ATTEMPT — FIX THESE ISSUES
The evaluator found problems in your last output. Fix each one:

${feedback.evaluationIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

## YOUR PREVIOUS CODE (with bugs):
\`\`\`openscad
${feedback.previousCode}
\`\`\`

Fix the code above. Address every issue listed. Return only the corrected OpenSCAD code.`;
  } else {
    userText = `## SPECIFICATION
${specification}

Generate OpenSCAD code that implements this design exactly. Return ONLY the code, no markdown, no explanations.`;
  }

  const code = await llmClient.generateText(PROGRAMMER_SYSTEM_PROMPT, userText);

  return code
    .replace(/^```(?:openscad|scad|cad)?\s*\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}
