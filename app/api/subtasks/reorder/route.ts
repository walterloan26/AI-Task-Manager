// app/api/subtasks/reorder/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { rateLimitByIP } from '@/lib/appRateLimit'

const reorderSchema = z.object({
  taskId: z.string(),
  subtasks: z.array(
    z.object({
      id: z.string().min(1),
      orderIndex: z.number().int().nonnegative()
    })
  )
})

// Helper function for rate limiting
async function checkRateLimit(req: Request, prefix: string): Promise<boolean> {
  try {
    const isAllowed = await rateLimitByIP(req);
    if (!isAllowed) {
      console.warn(`Rate limit exceeded for ${prefix}`);
    }
    return isAllowed;
  } catch (error) {
    console.error(`Rate limiting error for ${prefix}:`, error);
    return true; // Fail open
  }
}

export async function PATCH(req: Request) {
  try {
    // Rate limiting check - UPDATED
    const isAllowed = await checkRateLimit(req, 'reorder:patch');
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json()
    const validation = reorderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid reorder payload",
          details: validation.error.format() // Optional: include validation details
        },
        { status: 400 }
      )
    }

    const { taskId, subtasks } = validation.data

    // Validate that all subtasks belong to the specified task
    const subtaskIds = subtasks.map(s => s.id);
    const existingSubtasks = await prisma.subtask.findMany({
      where: {
        id: { in: subtaskIds },
        taskId: taskId
      },
      select: { id: true }
    });

    const existingSubtaskIds = existingSubtasks.map(s => s.id);
    const missingSubtaskIds = subtaskIds.filter(id => !existingSubtaskIds.includes(id));
    
    if (missingSubtaskIds.length > 0) {
      return NextResponse.json(
        { 
          error: "Some subtasks do not belong to the specified task",
          invalidIds: missingSubtaskIds
        },
        { status: 400 }
      );
    }

    // Update subtasks in a transaction
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
    );

    return NextResponse.json({ 
      success: true,
      message: "Subtasks reordered successfully"
    });
    
  } catch (err) {
    console.error("PATCH /subtasks/reorder error:", err);
    
    let errorMessage = "Failed to reorder subtasks";
    let statusCode = 500;
    
    if (err instanceof Error) {
      errorMessage = err.message;
      // Handle specific Prisma errors
      if (errorMessage.includes("RecordNotFound") || errorMessage.includes("P2025")) {
        errorMessage = "Subtask not found or doesn't belong to the specified task";
        statusCode = 404;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: statusCode }
    );
  }
}