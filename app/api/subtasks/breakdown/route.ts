// app/api/subtasks/breakdown/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";
import { rateLimitByIP } from "@/lib/appRateLimit";
import { generateSubtasks } from "@/lib/ai/client";
import { initialOrder } from "@/lib/order";
import { canUseAI } from "@/lib/ai/quota";
import { logActivity } from "@/lib/logActivity";
import { ACTIVITY_TYPES } from "@/lib/activityTypes";



import {
  subtaskSchema,
  validateBreakdownRequest,
} from "@/lib/validation";

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

async function rateLimitRequest(req: Request, prefix: string): Promise<boolean> {
  try {
    const allowed = await rateLimitByIP(req);
    if (!allowed) {
      console.warn(`Rate limit exceeded: ${prefix}`);
    }
    return allowed;
  } catch (error) {
    console.error(`Rate limit error (${prefix})`, error);
    return true; // fail open
  }
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    /* ----------------------------- Rate limit ------------------------------ */
    if (!(await rateLimitRequest(req, "breakdown:post"))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    /* -------------------------- Validate request --------------------------- */
    const validation = validateBreakdownRequest(await req.json());

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { task, complexity } = validation.data;

    /* ------------------------------ Auth ---------------------------------- */
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /* --------------------------- Fetch user ------------------------------- */
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    /* -------------------------- Enforce quota ----------------------------- */
    const quota = canUseAI(user);

    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Daily AI quota exceeded",
          remaining: 0,
        },
        { status: 429 }
      );
    }

    /* ------------------------------ AI layer ------------------------------- */
    // ⬇️ AI is NEVER called unless quota is approved
    const { subtasks, confidence } = await generateSubtasks(task);

    /* -------------------------- Persist task ------------------------------- */
    const createdTask = await prisma.task.create({
      
      data: {
        task,
        complexity: complexity?.toUpperCase(),
        aiGenerated: true,
        aiConfidence: confidence,
        createdBy: {
          connect: { id:user.id}
        },
        owner: {
          connect: { id:user.id }
        },
        assignedTo: {
          connect: { id: user.id },
        },
        subtasks: {
          create: subtasks.map((s, index) => ({
            title: s.title,
            description: s.description,
            estimateMinutes: Math.max(1, s.estimateMinutes),
            completed: s.completed ?? false,
            priority: (s.priority?.toUpperCase() || "MEDIUM") as
              | "HIGH"
              | "MEDIUM"
              | "LOW",
            orderIndex: initialOrder(index),
          })),
        },
      },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
      },
    });
    await logActivity({
      type: ACTIVITY_TYPES.TASK_CREATED,
      actorId: user.id,
      taskId: createdTask.id,
    });

    /* ----------------------- Increment quota ------------------------------- */
    await prisma.user.update({
      where: { id: user.id },
      data: {
        aiCallsToday: quota.reset ? 1 : { increment: 1 },
        aiLastResetAt: quota.reset ? new Date() : undefined,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: createdTask,
        quota: {
          remaining: quota.remaining - 1,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/subtasks/breakdown error:", error);

    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}


/* -------------------------------------------------------------------------- */
/*                                    GET                                     */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    if (!(await rateLimitRequest(req, "breakdown:get"))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Get the current user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Determine if user is admin
    const isAdmin = session.user.role === 'ADMIN';
    
    // Build where clause based on user role
    let whereClause: any;
    
    if (isAdmin) {
      // Admin can see all tasks
      whereClause = {};
    } else {
      // Regular users see tasks they own OR are assigned to
      whereClause = {
        OR: [
          { ownerId: session.user.id },
          { assignedToId: session.user.id }
        ]
      };
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        subtasks: {
          where: { completed: false },
          orderBy: { orderIndex: "asc" },
        },
        // Include owner and assignedTo info
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`📋 GET /api/subtasks/breakdown: Returning ${tasks.length} tasks for user ${session.user.id} (role: ${session.user.role})`);

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks,
      userRole: session.user.role,
      isAdmin,
    });
  } catch (error) {
    console.error("GET /api/subtasks/breakdown error:", error);

    return NextResponse.json(
      { error: "Failed to fetch tasks", success: false },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   PATCH                                    */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: Request) {
  try {
    if (!(await rateLimitRequest(req, "breakdown:patch"))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("id");

    if (!taskId) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      );
    }

    /* ------------------------------ Auth & Permissions ------------------------------ */
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const validation = z.object({
      subtasks: z.array(subtaskSchema),
    }).safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid subtasks payload",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const normalizedSubtasks = validation.data.subtasks.map((s) => ({
      ...s,
      priority: (s.priority?.toUpperCase() || "MEDIUM") as
        | "HIGH"
        | "MEDIUM"
        | "LOW",
    }));

    /* ---------------------------- Check Task Existence & Permissions ---------------------------- */
    // Fetch existing task with ownership info
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: true,
        owner: {
          select: {
            id: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check permissions - who can update this task?
    const isAdmin = session.user.role === 'ADMIN';
    const isOwner = existingTask.ownerId === session.user.id;
    const isAssigned = existingTask.assignedToId === session.user.id;
    
    // Determine who can update based on your business logic:
    // Option 1: Only owners and admins can update (strict)
    // Option 2: Owners, assigned users, and admins can update (more flexible)
    
    // Using Option 2 (more flexible - allows assigned users to update):
    const canUpdate = isAdmin || isOwner || isAssigned;
    
    if (!canUpdate) {
      return NextResponse.json(
        { 
          error: "Access denied",
          detail: "You do not have permission to update this task. Only task owners, assigned users, or administrators can update tasks.",
          permissions: {
            isAdmin,
            isOwner,
            isAssigned,
            taskOwnerId: existingTask.ownerId,
            taskAssignedToId: existingTask.assignedToId,
            userId: session.user.id,
          }
        },
        { status: 403 }
      );
    }

    console.log(`🔧 PATCH /api/subtasks/breakdown: User ${session.user.id} updating task ${taskId} (owner: ${isOwner}, assigned: ${isAssigned}, admin: ${isAdmin})`);

    /* ---------------------------- Update Task ---------------------------- */
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        subtasks: {
          deleteMany: {},
          create: normalizedSubtasks.map((s, index) => ({
            title: s.title,
            description: s.description,
            estimateMinutes: Math.max(1, s.estimateMinutes),
            completed: s.completed ?? false,
            priority: s.priority,
            orderIndex: index,
          })),
        },
      },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    /* ---------------------------- Log Activity ---------------------------- */
    // Detect newly completed subtasks
    const completedSubtasks = updatedTask.subtasks.filter(s => s.completed);
    const previouslyCompletedSubtasks = existingTask.subtasks.filter(s => s.completed);
    
    // Find newly completed subtasks (ones that weren't completed before)
    const newlyCompletedCount = completedSubtasks.length - previouslyCompletedSubtasks.length;
    
    // Log task update activity
    await logActivity({
      type: ACTIVITY_TYPES.TASK_UPDATED,
      actorId: session.user.id,
      taskId,
      meta: {
        updatedByOwner: isOwner,
        updatedByAssigned: isAssigned && !isOwner,
        updatedByAdmin: isAdmin && !isOwner && !isAssigned,
        subtasksCount: updatedTask.subtasks.length,
        newlyCompletedSubtasks: newlyCompletedCount > 0 ? newlyCompletedCount : undefined,
      },
    });

    // Log subtask completion if any were newly completed
    if (newlyCompletedCount > 0) {
      await logActivity({
        type: ACTIVITY_TYPES.SUBTASK_COMPLETED,
        actorId: session.user.id,
        taskId,
        meta: {
          count: newlyCompletedCount,
          completedByOwner: isOwner,
          completedByAssigned: isAssigned && !isOwner,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedTask,
      permissions: {
        canEdit: true,
        canDelete: isAdmin || isOwner, // Only owners and admins can delete
        isOwner,
        isAssigned,
        isAdmin,
      },
    });
  } catch (error) {
    console.error("PATCH /api/subtasks/breakdown error:", error);

    return NextResponse.json(
      { error: "Failed to update task", success: false },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(req: Request) {
  try {
    if (!(await rateLimitRequest(req, "breakdown:delete"))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      );
    }

    // Get the current user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // First, check if task exists and get its ownership info
    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        ownerId: true,
        assignedToId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = session.user.role === 'ADMIN';
    const isOwner = task.ownerId === session.user.id;
    
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { 
          error: "Access denied - You can only delete your own tasks",
          detail: "Only task owners or administrators can delete tasks"
        },
        { status: 403 }
      );
    }

    // Log activity before deleting
    if (session.user.id) {
      await logActivity({
        type: ACTIVITY_TYPES.TASK_DELETED,
        actorId: session.user.id,
        taskId: id,
        meta: {
          deletedByOwner: isOwner,
          deletedByAdmin: isAdmin && !isOwner,
        },
      });
    }

    await prisma.task.delete({ where: { id } });

    console.log(`🗑️ Task ${id} deleted by user ${session.user.id} (admin: ${isAdmin}, owner: ${isOwner})`);

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/subtasks/breakdown error:", error);

    return NextResponse.json(
      { error: "Failed to delete task", success: false },
      { status: 500 }
    );
  }
}
