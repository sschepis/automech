import type { LLMClient } from './types.js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.AUTOMECH_MODEL || 'anthropic/claude-sonnet-4';
const VISION_MODEL = process.env.AUTOMECH_VISION_MODEL || 'openai/gpt-4o';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set.');
  return key;
}

async function openRouterRequest(
  messages: Message[],
  tools?: Record<string, unknown>[],
  model?: string,
): Promise<any> {
  const body: Record<string, unknown> = {
    model: model || OPENROUTER_MODEL,
    messages,
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
      'HTTP-Referer': 'https://github.com/automech',
      'X-Title': 'Automech',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export function createOpenRouterClient(): LLMClient {
  return {
    async generateStructured<T>(
      systemPrompt: string,
      userPrompt: string,
      schema: Record<string, unknown>,
    ): Promise<T> {
      const functionName = (schema as any).name || 'generate_output';
      const parameters = (schema as any).parameters || (schema as any).input_schema || schema;

      const tools = [{
        type: 'function',
        function: { name: functionName, description: (schema as any).description || 'Generate output', parameters },
      }];

      const response = await openRouterRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], tools);

      const choice = response.choices[0];
      if (!choice) throw new Error('No choices');

      const toolCalls = choice.message.tool_calls;
      if (toolCalls?.length > 0) return JSON.parse(toolCalls[0].function.arguments) as T;

      if (choice.message.content) {
        const cleaned = choice.message.content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        return JSON.parse(cleaned) as T;
      }

      throw new Error('Empty response');
    },

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
      const response = await openRouterRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      return response.choices[0]?.message?.content?.trim() ?? '';
    },

    async generateVision(systemPrompt: string, userText: string, imageDataUris: string[]): Promise<string> {
      const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
        { type: 'text', text: userText },
        ...imageDataUris.map(uri => ({
          type: 'image_url' as const,
          image_url: { url: uri },
        })),
      ];

      const response = await openRouterRequest([
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ], undefined, VISION_MODEL);

      return response.choices[0]?.message?.content?.trim() ?? '';
    },
  };
}
