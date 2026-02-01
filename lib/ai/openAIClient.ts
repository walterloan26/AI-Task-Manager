import OpenAI from "openai";
import { AIClient } from "./aiClient";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is missing");
}

export const openAIClient: AIClient = {
  async generate(prompt: string) {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return res.choices[0].message.content ?? "";
  },
};
