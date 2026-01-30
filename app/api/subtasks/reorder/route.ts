// app/api/subtasks/reorder/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { ratelimit } from "@/lib/rateLimit"

const reorderSchema = z.object({
  taskId: z.string(),
  subtasks: z.array(
    z.object({
      id: z.string().min(1),
      orderIndex: z.number().int().nonnegative()
    })
  )
})

export async function PATCH(req: Request) {
  try {
    const identifier =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "anonymous"

    const { success } = await ratelimit.limit(`${identifier}:reorder`)
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      )
    }

    const body = await req.json()
    const validation = reorderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid reorder payload" },
        { status: 400 }
      )
    }

    const { taskId, subtasks } = validation.data


    await prisma.$transaction(
  subtasks.map((s) =>
    prisma.subtask.update({
      where: {
        id: s.id,
        taskId, // 🔒 safety: prevents cross-task corruption
      },
      data: { orderIndex: s.orderIndex },
    })
  )
)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("PATCH /subtasks/reorder error:", err)
    return NextResponse.json(
      { error: "Failed to reorder subtasks" },
      { status: 500 }
    )
  }
}
