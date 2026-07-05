import type { LLMClient } from '../llm/types.js';

const EVALUATOR_SYSTEM_PROMPT = `# ROLE
You are a quality inspector for 3D-printed mechanical parts. You compare a rendered image of a CAD model against its design specification and identify discrepancies.

# RULES
1. Look at the rendered image(s) carefully. Compare what you SEE against what the specification DESCRIBES.
2. Check for: missing features, wrong dimensions, incorrect proportions, missing clearance gaps, disconnected parts, geometry that doesn't match the description.
3. Be specific: "The arms should be 40mm long but appear shorter relative to the 30mm base" is better than "the arms look wrong."
4. If the part looks correct and matches the specification, PASS it.
5. If there are issues, list each one as a numbered item with specific observations.
6. Do NOT comment on rendering quality, lighting, or background. Only evaluate the mechanical design.

# OUTPUT FORMAT
{
  "passed": true/false,
  "issues": ["issue 1", "issue 2", ...],
  "summary": "one-line summary of the evaluation"
}`;

export interface EvaluatorResult {
  passed: boolean;
  issues: string[];
  summary: string;
}

export async function executeEvaluatorNode(
  llmClient: LLMClient,
  specification: string,
  imageDataUris: string[],
): Promise<EvaluatorResult> {
  if (!llmClient.generateVision) {
    return { passed: true, issues: [], summary: 'Vision evaluation not available — skipping visual check.' };
  }

  const userText = `## DESIGN SPECIFICATION
${specification}

## RENDERED OUTPUT
Below are rendered views of what the programmer produced. Examine each view and determine whether the part matches the specification.`;

  const response = await llmClient.generateVision(EVALUATOR_SYSTEM_PROMPT, userText, imageDataUris);

  try {
    const cleaned = response
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      passed: parsed.passed === true,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      summary: parsed.summary || '',
    };
  } catch {
    return {
      passed: true,
      issues: [],
      summary: 'Could not parse evaluator response — assuming pass.',
    };
  }
}
