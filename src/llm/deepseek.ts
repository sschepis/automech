import type { LLMClient } from './types.js';

const DEEPSEEK_BASE = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set.');
  return key;
}

async function deepseekRequest(messages: any[], tools?: any[]): Promise<any> {
  const body: Record<string, unknown> = { model: DEEPSEEK_MODEL, messages, temperature: 0.1, max_tokens: 4096 };
  if (tools?.length) { body.tools = tools; body.tool_choice = 'auto'; }

  const response = await fetch(DEEPSEEK_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getApiKey()}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`DeepSeek API error ${response.status}: ${await response.text()}`);
  return response.json();
}

export function createDeepSeekClient(): LLMClient {
  return {
    async generateStructured<T>(systemPrompt: string, userPrompt: string, schema: Record<string, unknown>): Promise<T> {
      const functionName = (schema as any).name || 'generate_output';
      const parameters = (schema as any).parameters || (schema as any).input_schema || schema;
      const tools = [{ type: 'function', function: { name: functionName, description: (schema as any).description || '', parameters } }];

      const response = await deepseekRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], tools);

      const choice = response.choices[0];
      if (choice.message.tool_calls?.length > 0) return JSON.parse(choice.message.tool_calls[0].function.arguments) as T;
      if (choice.message.content) {
        const cleaned = choice.message.content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        return JSON.parse(cleaned) as T;
      }
      throw new Error('Empty response');
    },

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
      const response = await deepseekRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      return response.choices[0]?.message?.content?.trim() ?? '';
    },
  };
}
