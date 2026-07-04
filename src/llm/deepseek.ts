import type { LLMClient } from '../nodes/architect.js';

const DEEPSEEK_BASE = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: DeepSeekToolCall[];
}

interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
      tool_calls?: DeepSeekToolCall[];
    };
    finish_reason: string;
  }>;
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error(
      'DEEPSEEK_API_KEY not set. Create a .env file with DEEPSEEK_API_KEY=your-key',
    );
  }
  return key;
}

async function deepseekRequest(
  messages: DeepSeekMessage[],
  tools?: Record<string, unknown>[],
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } },
): Promise<DeepSeekResponse> {
  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: 0.1,
    max_tokens: 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice ?? 'auto';
  }

  const response = await fetch(DEEPSEEK_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<DeepSeekResponse>;
}

export function createDeepSeekClient(): LLMClient {
  return {
    async generateStructured<T>(
      systemPrompt: string,
      userPrompt: string,
      schema: Record<string, unknown>,
    ): Promise<T> {
      const functionName = (schema as { name?: string }).name || 'generate_output';
      const parameters = (schema as { parameters?: Record<string, unknown> }).parameters ||
        (schema as { input_schema?: Record<string, unknown> }).input_schema ||
        schema;

      const tools = [
        {
          type: 'function',
          function: {
            name: functionName,
            description: (schema as { description?: string }).description || 'Generate output',
            parameters,
          },
        },
      ];

      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await deepseekRequest(messages, tools, {
        type: 'function',
        function: { name: functionName },
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('DeepSeek returned no choices');
      }

      const toolCalls = choice.message.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const parsed = JSON.parse(toolCalls[0].function.arguments);
        return parsed as T;
      }

      if (choice.message.content) {
        const cleaned = choice.message.content
          .replace(/^```(?:json)?\s*\n?/i, '')
          .replace(/\n?```\s*$/i, '')
          .trim();
        return JSON.parse(cleaned) as T;
      }

      throw new Error('DeepSeek returned empty response');
    },

    async generateText(
      systemPrompt: string,
      userPrompt: string,
    ): Promise<string> {
      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await deepseekRequest(messages);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('DeepSeek returned no choices');
      }

      return choice.message.content.trim();
    },
  };
}
