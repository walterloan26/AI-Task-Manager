export interface AIClient {
  generate(prompt: string): Promise<string>;
}
