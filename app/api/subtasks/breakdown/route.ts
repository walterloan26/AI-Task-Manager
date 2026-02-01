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

// export async function POST(req: Request) {
//   try {
//     /* ----------------------------- Rate limit ------------------------------ */
//     if (!(await rateLimitRequest(req, "breakdown:post"))) {
//       return NextResponse.json(
//         { error: "Rate limit exceeded. Please try again later." },
//         { status: 429 }
//       );
//     }

//     /* -------------------------- Validate request --------------------------- */
//     const validation = validateBreakdownRequest(await req.json());

//     if (!validation.success) {
//       return NextResponse.json(
//         {
//           error: "Invalid request",
//           details: validation.error.format(),
//         },
//         { status: 400 }
//       );
//     }

//     const { task, complexity } = validation.data;

//     const user = await prisma.user.findUnique({
//       where: { id: session.user.id },
//     });

//     if (!user) {
//       return NextResponse.json(
//         { error: "User not found" },
//         { status: 404 }
//       );
//     }

//     const session = await getServerSession(authOptions);

//     if (!session?.user?.id) {
//       return NextResponse.json(
//         { error: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     /* ------------------------------ AI layer ------------------------------- */
//     // This is the ONLY AI call.
//     // Mock or real is handled internally by generateSubtasks()
//     const { subtasks, confidence } = await generateSubtasks(task);

//     /* -------------------------- Persist to DB ------------------------------ */
//     const createdTask = await prisma.task.create({
//       data: {
//         task,
//         complexity: complexity?.toUpperCase(),
//         aiGenerated: true,
//         aiConfidence: confidence,
//         user: {
//           connect: {
//             id: session.user.id,
//           },
//         },
//         subtasks: {
//           create: subtasks.map((s, index) => ({
//             title: s.title,
//             description: s.description,
//             estimateMinutes: Math.max(1, s.estimateMinutes),
//             completed: s.completed ?? false,
//             priority: (s.priority?.toUpperCase() || "MEDIUM") as
//               | "HIGH"
//               | "MEDIUM"
//               | "LOW",
//             orderIndex: initialOrder(index),
//           })),
//         },
//       },
//       include: {
//         subtasks: { orderBy: { orderIndex: "asc" } },
//       },
//     });

//     return NextResponse.json(
//       {
//         success: true,
//         data: createdTask,
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("POST /api/subtasks/breakdown error:", error);

//     let message = "Internal server error";
//     let status = 500;

//     if (error instanceof Error) {
//       message = error.message;

//       if (message.includes("AI")) {
//         status = 422;
//       }

//       if (
//         message.includes("schema") ||
//         message.includes("does not exist")
//       ) {
//         message =
//           "Database schema out of sync. Run: npx prisma db push && npx prisma generate";
//       }
//     }

//     return NextResponse.json(
//       { error: message, success: false },
//       { status }
//     );
//   }
// }
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
        user: {
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

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subtasks: {
          where: { completed: false },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: tasks.length,
      data: tasks,
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
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedTask,
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

    await prisma.task.delete({ where: { id } });

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
