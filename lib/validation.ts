import { z } from "zod"

export const breakdownRequestSchema = z.object({
  task: z.string().min(3).max(500),
  complexity: z.enum(['simple', 'medium', 'complex']).optional()
})

export const subtaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimateMinutes: z.number().int().min(1, "Estimate must be at least 1 minute"),
  completed: z.boolean().default(false),
  priority: z
  .string()
  .transform(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
  .refine(p => ["Low", "Medium", "High"].includes(p), {
    message: "Invalid priority value",
  }),
  
})

export type AISubtask = z.infer<typeof subtaskSchema>
export type BreakdownRequest = z.infer<typeof breakdownRequestSchema>

export function validateBreakdownRequest(body: unknown) {
  return breakdownRequestSchema.safeParse(body)
}