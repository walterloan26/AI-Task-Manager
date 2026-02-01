import { aiSubtaskArrayLooseSchema } from "@/lib/ai/aiSchemas"

const USE_MOCK_AI = process.env.NEXT_PUBLIC_AI_MODE === "mock"

export async function generateSubtasks(task: string) {
  if (USE_MOCK_AI) {
    return mockGenerateSubtasks(task)
  }

  return realGenerateSubtasks(task)
}

/* -------------------------------------------------------------------------- */
/*                                   MOCK                                     */
/* -------------------------------------------------------------------------- */

async function mockGenerateSubtasks(task: string) {
  // deterministic mock — no randomness
  const data = [
    {
      title: "Clarify requirements",
      description: `Define what "${task}" really means`,
      estimateMinutes: 20,
      completed: false,
      priority: "HIGH",
    },
    {
      title: "Break into steps",
      description: "Split task into smaller logical actions",
      estimateMinutes: 30,
      completed: false,
      priority: "MEDIUM",
    },
    {
      title: "Execute first step",
      description: "Start working on the most critical part",
      estimateMinutes: 45,
      completed: false,
      priority: "MEDIUM",
    },
  ]

  return {
    subtasks: data,
    confidence: 0.95,
  }
}

/* -------------------------------------------------------------------------- */
/*                                   REAL                                     */
/* -------------------------------------------------------------------------- */

async function realGenerateSubtasks(task: string) {
  // IMPORTANT: return JSON, not text
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `
Return ONLY valid JSON.
Break this task into subtasks:

${task}
`,
        },
      ],
      temperature: 0.3,
    }),
  })

  const json = await response.json()
  const raw = json.choices?.[0]?.message?.content

  if (!raw) throw new Error("Empty AI response")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("AI returned invalid JSON")
  }

  const loose = aiSubtaskArrayLooseSchema.safeParse(parsed)
  if (!loose.success) {
    throw new Error("AI response failed loose validation")
  }

  return loose.data
}
