import { z } from "zod"

export const aiSubtaskLooseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  estimateMinutes: z.number().optional(),
  priority: z.string().optional(),
  completed: z.boolean().optional()
})

export const aiSubtaskArrayLooseSchema = z.array(aiSubtaskLooseSchema)
