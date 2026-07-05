export interface LLMClient {
  generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: Record<string, unknown>,
  ): Promise<T>;

  generateText(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string>;

  generateVision?(
    systemPrompt: string,
    userText: string,
    imageDataUris: string[],
  ): Promise<string>;
}
