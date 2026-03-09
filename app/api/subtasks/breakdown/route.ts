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
import { globalEvents } from '@/lib/events/eventEmitter';
import { revalidateTag } from 'next/cache';

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
          connect: { id: user.id }
        },
        owner: {
          connect: { id: user.id }
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
    
    globalEvents.emit('task:created', { 
      taskId: createdTask.id, 
      userId: user.id 
    });
    
    globalEvents.emit('task:updated', { 
      taskId: createdTask.id, 
      userId: user.id 
    });

    // ✅ Add cache invalidation here
    revalidateTag('upcoming-tasks');

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
/*                                    GET                                      */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {

  try {
    if (!(await rateLimitRequest(req, "breakdown:get"))) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get('fresh') === 'true';
    
    if (forceFresh) {
      revalidateTag('upcoming-tasks');
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

    const tasksWithPriority = tasks.map(task => {
      // Debug log for each task
      console.log(`🎯 Task "${task.task}" (${task.id}):`, {
        subtaskPriorities: task.subtasks.map(s => s.priority),
        subtaskCount: task.subtasks.length
      });
      // Calculate priority from subtasks
      let taskPriority: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
      
      if (task.subtasks.length > 0) {
        const priorities = task.subtasks.map(s => s.priority);
        
        if (priorities.includes('HIGH')) {
          taskPriority = 'HIGH';
          console.log(`  → Setting HIGH because HIGH present`);
        } else if (priorities.includes('MEDIUM')) {
          taskPriority = 'MEDIUM';
          console.log(`  → Setting MEDIUM because MEDIUM present`);
        } else if (priorities.every(p => p === 'LOW')) {
          taskPriority = 'LOW';
          console.log(`  → Setting LOW because LOW present`);
        }
        // Fallback for any other case
        else {
          taskPriority = 'LOW';
        }
        console.log(`🎯 Priority calculation for "${task.task}":`, {
  subtaskPriorities: task.subtasks.map(s => s.priority),
  hasHigh: priorities.includes('HIGH'),
  hasMedium: priorities.includes('MEDIUM'),
  allLow: priorities.every(p => p === 'LOW'),
  calculatedPriority: taskPriority
});
      }

      
      
      // Calculate progress
      const completedSubtasks = task.subtasks.filter(s => s.completed).length;
      const progress = task.subtasks.length > 0 
        ? Math.round((completedSubtasks / task.subtasks.length) * 100) 
        : 0;
      
      return {
        ...task,
        priority: taskPriority, // Add calculated priority
        progress, // Also calculate progress if not stored
        completedSubtasks, // Add this if not stored
        totalSubtasks: task.subtasks.length, // Add this if not stored
      };
    });

    console.log('📊 Final task priorities:', tasksWithPriority.map(t => ({
      name: t.task,
      priority: t.priority,
      subtaskPriorities: t.subtasks.map((s: any) => s.priority)
    })));

    console.log(`📋 GET /api/subtasks/breakdown: Returning ${tasks.length} tasks for user ${session.user.id} (role: ${session.user.role})`);

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasksWithPriority,
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
  console.log('========== 🚨 PATCH REQUEST START ==========');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  try {
    if (!(await rateLimitRequest(req, "breakdown:patch"))) {
      console.log('⏸️ Rate limited');
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("id");

    console.log('📥 Task ID from URL:', taskId);

    if (!taskId) {
      console.log('❌ No task ID provided');
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      );
    }

    /* ------------------------------ Auth & Permissions ------------------------------ */
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('❌ No session - unauthorized');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('👤 User:', { id: session.user.id, role: session.user.role });

    const body = await req.json();
    
    console.log('📦 Raw request body:', JSON.stringify(body, null, 2));
    console.log('🔢 Subtasks in request:', body.subtasks?.length || 0);
    console.log('✅ Completed count in request:', body.subtasks?.filter((s: any) => s.completed).length || 0);

    const validation = z.object({
      subtasks: z.array(subtaskSchema),
    }).safeParse(body);

    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.format());
      return NextResponse.json(
        {
          error: "Invalid subtasks payload",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    console.log('✅ Validation passed');

    const normalizedSubtasks = validation.data.subtasks.map((s) => ({
      ...s,
      priority: (s.priority?.toUpperCase() || "MEDIUM") as
        | "HIGH"
        | "MEDIUM"
        | "LOW",
    }));

    console.log('📋 Normalized subtasks:', normalizedSubtasks.map(s => ({
      title: s.title.substring(0, 30) + (s.title.length > 30 ? '...' : ''),
      completed: s.completed,
      priority: s.priority
    })));
    
    console.log('🔢 Final completed count:', normalizedSubtasks.filter(s => s.completed).length, 'of', normalizedSubtasks.length);

    /* ---------------------------- Check Task Existence & Permissions ---------------------------- */
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: true,
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existingTask) {
      console.log('❌ Task not found in database:', taskId);
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    console.log('🎯 Task being updated:', {
      id: taskId,
      name: existingTask.task,
      owner: existingTask.owner?.name || existingTask.ownerId,
      assignedTo: existingTask.assignedTo?.name || existingTask.assignedToId,
      isCvcTask: existingTask.task === 'cvc' // Special check for debugging
    });

    console.log('📊 BEFORE UPDATE - Existing task state:', {
      taskName: existingTask.task,
      existingSubtasks: existingTask.subtasks.map(s => ({
        title: s.title.substring(0, 20) + (s.title.length > 20 ? '...' : ''),
        completed: s.completed,
        id: s.id?.substring(0, 8) + '...'
      })),
      existingCompleted: existingTask.subtasks.filter(s => s.completed).length,
      totalSubtasks: existingTask.subtasks.length
    });

    // In your PATCH endpoint, right after creating/updating subtasks:

    console.log('💾 Subtasks being saved:', normalizedSubtasks.map(s => ({
      title: s.title,
      priority: s.priority,
      isLow: s.priority === 'LOW'
    })));

    // After the update, log what was actually saved
    const verifySubtasks = await prisma.subtask.findMany({
      where: { taskId },
      select: { id: true, title: true, priority: true }
    });

    console.log('✅ Verified saved subtasks:', verifySubtasks.map(s => ({
      title: s.title,
      priority: s.priority,
      isLow: s.priority === 'LOW'
    })));

    // Check permissions - who can update this task?
    const isAdmin = session.user.role === 'ADMIN';
    const isOwner = existingTask.ownerId === session.user.id;
    const isAssigned = existingTask.assignedToId === session.user.id;
    
    // Using Option 2 (more flexible - allows assigned users to update):
    const canUpdate = isAdmin || isOwner || isAssigned;
    
    if (!canUpdate) {
      console.log('❌ Permission denied:', {
        isAdmin,
        isOwner,
        isAssigned,
        taskOwnerId: existingTask.ownerId,
        taskAssignedToId: existingTask.assignedToId,
        userId: session.user.id,
      });
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

    console.log(`🔧 User ${session.user.id} updating task ${taskId} (owner: ${isOwner}, assigned: ${isAssigned}, admin: ${isAdmin})`);

    console.log('🔄 ABOUT TO UPDATE - New subtasks data:', {
      newSubtasks: normalizedSubtasks.map(s => ({
        title: s.title.substring(0, 20) + (s.title.length > 20 ? '...' : ''),
        completed: s.completed,
        priority: s.priority
      })),
      newCompleted: normalizedSubtasks.filter(s => s.completed).length,
      totalNewSubtasks: normalizedSubtasks.length
    });

    /* ---------------------------- Update Task ---------------------------- */
    console.log('💾 Starting database update...');
    
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
        owner: { select: { id: true, name: true, email: true,} },
        assignedTo: {select: { id: true, name: true, email: true,} },
      },
    });
    
    /* ---------------------------- Recalculate Task Status ---------------------------- */
    const totalSubtasks = updatedTask.subtasks.length;
    const completedCount = updatedTask.subtasks.filter(s => s.completed === true).length;

    let newStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

    if (totalSubtasks === 0) {
      newStatus = 'PENDING';
    } else if (completedCount === 0) {
      newStatus = 'PENDING';
    } else if (completedCount === totalSubtasks) {
      newStatus = 'COMPLETED';
    } else {
      newStatus = 'IN_PROGRESS';
    }

    console.log('🧠 FINAL STATUS:', newStatus);

    console.log('🧪 STATUS DEBUG:', {
      totalSubtasks,
      completedCount,
      completedValues: updatedTask.subtasks.map(s => s.completed)
    });

    const taskWithStatus = await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
        owner: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });


    console.log('✅ AFTER UPDATE - Database result:', {
      taskName: updatedTask.task,
      updatedSubtasks: updatedTask.subtasks.map(s => ({
        title: s.title.substring(0, 20) + (s.title.length > 20 ? '...' : ''),
        completed: s.completed,
        id: s.id?.substring(0, 8) + '...'
      })),
      updatedCompleted: updatedTask.subtasks.filter(s => s.completed).length,
      totalUpdatedSubtasks: updatedTask.subtasks.length
    });

    /* ---------------------------- Calculate Changes ---------------------------- */
    const completedSubtasks = updatedTask.subtasks.filter(s => s.completed);
    const previouslyCompletedSubtasks = existingTask.subtasks.filter(s => s.completed);
    
    // Find newly completed subtasks (ones that weren't completed before)
    const newlyCompletedCount = completedSubtasks.length - previouslyCompletedSubtasks.length;

    console.log('🔢 Change calculation:', {
      previousCompleted: previouslyCompletedSubtasks.length,
      newCompleted: completedSubtasks.length,
      newlyCompletedCount,
      hasChanges: newlyCompletedCount !== 0
    });

    /* ---------------------------- Emit Events ---------------------------- */
    globalEvents.emit('task:updated', { 
      taskId, 
      userId: session.user.id,
      taskName: updatedTask.task,
      newlyCompletedCount
    });
    
    console.log(`📢 Emitted task:updated for task "${updatedTask.task}" (${taskId})`);

    if (newStatus === 'COMPLETED') {
      globalEvents.emit('task:completed', {
      taskId,
      taskName: updatedTask.task,
      });
    }

    if (newlyCompletedCount !== 0) {
      globalEvents.emit('subtask:toggled', {
        taskId,
        userId: session.user.id,
        newlyCompletedCount: Math.abs(newlyCompletedCount),
        wasCompleted: newlyCompletedCount > 0,
        taskName: updatedTask.task
      });
      console.log(`📢 Emitted subtask:toggled for task "${updatedTask.task}", count: ${newlyCompletedCount}`);
    }

    revalidateTag('upcoming-tasks');


    /* ---------------------------- Log Activity ---------------------------- */
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

    console.log('📤 Returning response with:', {
      success: true,
      taskName: updatedTask.task,
      completedCount: updatedTask.subtasks.filter(s => s.completed).length,
      totalCount: updatedTask.subtasks.length
    });

    console.log('========== ✅ PATCH REQUEST END ==========');

    return NextResponse.json({
      success: true,
      data: taskWithStatus,
      permissions: {
        canEdit: true,
        canDelete: isAdmin || isOwner,
        isOwner,
        isAssigned,
        isAdmin,
      },
    });
  } catch (error) {
    console.error('❌ PATCH error:', error);
    console.log('========== ❌ PATCH REQUEST FAILED ==========');
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
        task: true,
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
    
    globalEvents.emit('task:deleted', { 
      taskId: id, 
      userId: session.user.id,
      taskName: task.task,
      deletedByOwner: isOwner,
      deletedByAdmin: isAdmin && !isOwner
    });

    // ✅ Add cache invalidation here
    revalidateTag('upcoming-tasks');
    
    console.log(`📢 Emitted task:deleted for task "${task.task}" (${id})`);

    await prisma.task.delete({ where: { id } });

    console.log(`🗑️ Task "${task.task}" (${id}) deleted by user ${session.user.id} (admin: ${isAdmin}, owner: ${isOwner})`);

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