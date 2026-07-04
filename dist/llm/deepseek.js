const DEEPSEEK_BASE = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
function getApiKey() {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
        throw new Error('DEEPSEEK_API_KEY not set. Create a .env file with DEEPSEEK_API_KEY=your-key');
    }
    return key;
}
async function deepseekRequest(messages, tools, toolChoice) {
    const body = {
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
    return response.json();
}
export function createDeepSeekClient() {
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
                return parsed;
            }
            if (choice.message.content) {
                const cleaned = choice.message.content
                    .replace(/^```(?:json)?\s*\n?/i, '')
                    .replace(/\n?```\s*$/i, '')
                    .trim();
                return JSON.parse(cleaned);
            }
            throw new Error('DeepSeek returned empty response');
        },
        async generateText(systemPrompt, userPrompt) {
            const messages = [
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
//# sourceMappingURL=deepseek.js.map