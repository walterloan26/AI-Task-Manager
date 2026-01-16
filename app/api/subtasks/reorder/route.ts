import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const { taskId, order } = await req.json();

    if (!taskId || !Array.isArray(order)) {
      return NextResponse.json(
        { error: "Invalid reorder payload" },
        { status: 400 }
      );
    }

    if (order.length === 0) {
      return NextResponse.json({ success: true });
    }

    /**
     * 1. Normalize orderIndex defensively
     * Guarantees 0..n-1 regardless of client input
     */
    const normalized = order.map(
      (item: { id: string }, index: number) => ({
        id: item.id,
        orderIndex: index,
      })
    );

    /**
     * 2. Validate all subtasks belong to task
     */
    const validCount = await prisma.subtask.count({
      where: {
        taskId,
        id: { in: normalized.map(s => s.id) },
      },
    });

    if (validCount !== normalized.length) {
      return NextResponse.json(
        { error: "One or more subtasks do not belong to task" },
        { status: 400 }
      );
    }

    /**
     * 3. Build SQL CASE statement
     */
    const cases = normalized
      .map(
        s => `WHEN '${s.id}' THEN ${s.orderIndex}`
      )
      .join(" ");

    const ids = normalized
      .map(s => `'${s.id}'`)
      .join(",");

    const sql = `
      UPDATE Subtask
      SET orderIndex = CASE id
        ${cases}
      END
      WHERE taskId = '${taskId}'
      AND id IN (${ids});
    `;

    await prisma.$executeRawUnsafe(sql);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/subtasks/reorder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
