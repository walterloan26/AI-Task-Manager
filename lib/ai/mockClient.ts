import { AIClient } from "./aiClient";

export const mockAIClient: AIClient = {
  async generate(prompt: string) {
    // IMPORTANT: match the format your parser already expects
    return `
1. Analyze the main task requirements
2. Break the task into smaller actionable steps
3. Define acceptance criteria for each subtask
4. Estimate effort and dependencies
5. Review and finalize the subtasks
    `.trim();
  },
};
