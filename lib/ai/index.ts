import { mockAIClient } from "./mockClient";
import { openAIClient } from "./openAIClient";

const mode = process.env.NEXT_PUBLIC_AI_MODE ?? "mock";

// SAFETY FUSE
if (
  process.env.NODE_ENV === "development" &&
  mode !== "mock"
) {
  throw new Error("🚨 Real AI calls are disabled in development");
}

export const aiClient =
  mode === "mock" ? mockAIClient : openAIClient;
