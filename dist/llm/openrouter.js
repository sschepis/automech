const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.AUTOMECH_MODEL || 'deepseek/deepseek-chat';
function getApiKey() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
        throw new Error('OPENROUTER_API_KEY not set. Create a .env file with OPENROUTER_API_KEY=your-key');
    }
    return key;
}
async function openRouterRequest(messages, tools) {
    const body = {
        model: OPENROUTER_MODEL,
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
export function createOpenRouterClient() {
    return {
        async generateStructured(systemPrompt, userPrompt, schema) {
            const functionName = schema.name || 'generate_output';
            const parameters = schema.parameters ||
                schema.input_schema ||
                schema;
            const tools = [
                {
                    type: 'function',
                    function: {
                        name: functionName,
                        description: schema.description || 'Generate output',
                        parameters,
                    },
                },
            ];
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const response = await openRouterRequest(messages, tools);
            const choice = response.choices[0];
            if (!choice)
                throw new Error('OpenRouter returned no choices');
            const toolCalls = choice.message.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                return JSON.parse(toolCalls[0].function.arguments);
            }
            if (choice.message.content) {
                const cleaned = choice.message.content
                    .replace(/^```(?:json)?\s*\n?/i, '')
                    .replace(/\n?```\s*$/i, '')
                    .trim();
                return JSON.parse(cleaned);
            }
            throw new Error('OpenRouter returned empty response');
        },
        async generateText(systemPrompt, userPrompt) {
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ];
            const response = await openRouterRequest(messages);
            const choice = response.choices[0];
            if (!choice)
                throw new Error('OpenRouter returned no choices');
            return choice.message.content.trim();
        },
    };
}
//# sourceMappingURL=openrouter.js.map