import { PRIORITIES } from "./constants"
import type { Priority } from "./constants"

interface NormalizedSubtask {
  title: string
  description: string
  estimateMinutes: number
  priority: Priority
  completed: boolean
}

function normalizePriority(input?: string): Priority {
  if (!input) return "MEDIUM"
  
  const upper = input.toUpperCase().trim()
  
  // Handle common AI variations
  if (upper === "HIGH" || upper === "H" || upper.includes("URGENT")) return "HIGH"
  if (upper === "MEDIUM" || upper === "M" || upper.includes("IMPORTANT")) return "MEDIUM"
  if (upper === "LOW" || upper === "L" || upper.includes("EVENTUALLY")) return "LOW"
  
  return PRIORITIES.includes(upper as Priority) ? (upper as Priority) : "MEDIUM"
}

function normalizeEstimate(input?: number): number {
  if (!input || input < 5) return 15
  if (input > 240) return 240
  return Math.round(input / 5) * 5
}

export function normalizeAISubtasks(
  raw: unknown[]
): { subtasks: NormalizedSubtask[]; confidence: number } {
  let confidence = 1

  const subtasks = raw.map((s) => {
    if (!s.estimateMinutes) confidence -= 0.05
    if (!s.priority) confidence -= 0.05

    return {
      title: s.title.trim(),
      description: s.description?.trim() ?? "",
      estimateMinutes: normalizeEstimate(s.estimateMinutes),
      priority: normalizePriority(s.priority),
      completed: false
    }
  })

  confidence = Math.max(0.5, Number(confidence.toFixed(2)))

  return { subtasks, confidence }
}
