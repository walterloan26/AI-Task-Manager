// app/api/subtasks/breakdown/route.ts
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { ratelimit } from "@/lib/rateLimit"
import { aiSubtaskArrayLooseSchema } from "@/lib/ai/aiSchemas"
import { normalizeAISubtasks } from "@/lib/ai/normalizeSubtasks"
import { initialOrder } from "@/lib/order"
import { 
  subtaskSchema, 
  type AISubtask,
  validateBreakdownRequest 
} from "@/lib/validation"

/* -------------------------------------------------------------------------- */
/*                                   Setup                                    */
/* -------------------------------------------------------------------------- */

// Initialize OpenAI safely
let openai: OpenAI | null = null
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
} else {
  console.warn("⚠️ OPENAI_API_KEY not found in environment variables")
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function buildPrompt(task: string): string {
  return `You are a productivity expert. Break down the task into actionable subtasks.

TASK: "${task}"

CRITERIA:
1. Each subtask should be 15-60 minutes of focused work
2. Include practical, specific descriptions  
3. Order logically (prerequisites first)
4. Estimate time realistically
5. Assign priority: HIGH (urgent), MEDIUM (important), LOW (eventually)

RESPONSE FORMAT (JSON array only):
[
  {
    "title": "Clear, actionable title",
    "description": "Specific steps to complete",
    "estimateMinutes": 25,
    "completed": false,
    "priority": "MEDIUM"
  } 
]

OUTPUT:`
}

function parseAndValidateAISubtasks(raw: string): AISubtask[] {
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim()
  
  if (!cleaned) throw new Error("Empty AI response")

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error("AI response could not be parsed as JSON")
  }

  const validation = z.array(subtaskSchema).safeParse(parsed)
  if (!validation.success) {
    throw new Error(`Invalid subtask format: ${validation.error.message}`)
  }

  return validation.data
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    // Check OpenAI initialization
    if (!openai) {
      return NextResponse.json(
        { 
          error: "OpenAI API key not configured",
          details: "Please add OPENAI_API_KEY to your .env.local file"
        },
        { status: 500 }
      )
    }

    // Rate limiting check
    const identifier = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "anonymous"
    
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier)
    
    if (!success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded", 
          limit,
          reset: new Date(reset).toISOString(),
          remaining 
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": new Date(reset).toISOString(),
          }
        }
      )
    }

    // Validate request body
    const validation = validateBreakdownRequest(await req.json())
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request",
          details: validation.error.format() 
        },
        { status: 400 }
      )
    }
    
    const { task, complexity } = validation.data

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: buildPrompt(task) }],
      temperature: complexity === 'simple' ? 0.1 : complexity === 'complex' ? 0.5 : 0.3,
      max_tokens: 1000,
    })
    
    const rawText = completion.choices[0].message.content ?? "[]"
    const cleaned = rawText.replace(/```json|```/g, "").trim()

    let parsed: unknown

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error("AI returned invalid JSON")
    }

    const loose = aiSubtaskArrayLooseSchema.safeParse(parsed)

    if (!loose.success) {
      throw new Error("AI response failed loose validation")
    }

    const { subtasks, confidence } = normalizeAISubtasks(loose.data)

    // Create task with subtasks - INCLUDING complexity now
    const createdTask = await prisma.task.create({
      data: {
        task,
        complexity: complexity?.toUpperCase(),
        aiGenerated: true,
        aiConfidence: confidence,
        subtasks: {
          create: subtasks.map((s, index) => ({
            title: s.title,
            description: s.description,
            estimateMinutes: s.estimateMinutes,
            completed: s.completed,
            priority: (s.priority?.toUpperCase() || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
            orderIndex: initialOrder(index),
          })),
        },
      },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
      },
    })

    return NextResponse.json({
      success: true,
      data: createdTask,
      rateLimit: { limit, remaining, reset: new Date(reset).toISOString() }
    }, { 
      status: 201,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      }
    })
    
  } catch (error) {
    console.error("POST /api/breakdown error:", error)
    
    let message = "Internal server error"
    let status = 500
    
    if (error instanceof Error) {
      message = error.message
      if (message.includes("AI response")) {
        status = 422
      } else if (message.includes("RecordNotFound")) {
        status = 404
      } else if (message.includes("complexity") || message.includes("does not exist")) {
        // Still getting schema error? Run prisma commands
        message = "Database schema out of sync. Please run: npx prisma db push && npx prisma generate"
        console.error("💡 Database schema needs update. Run Prisma commands.")
      }
    }
    
    return NextResponse.json(
      { 
        error: message, 
        success: false
      },
      { status }
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                                     GET                                    */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  try {
    // Rate limiting
    const identifier = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "anonymous"
    
    const { success, limit, reset, remaining } = await ratelimit.limit(`${identifier}:get`)
    
    if (!success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded",
          limit,
          reset: new Date(reset).toISOString(),
          remaining
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": new Date(reset).toISOString(),
          }
        }
      )
    }

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subtasks: { 
          orderBy: { orderIndex: "asc" },
          where: { completed: false }
        },
      },
    })

    // Fix null orderIndex subtasks
    const subtasksToUpdate: { id: string; index: number }[] = []
    
    tasks.forEach(task => {
      task.subtasks.forEach((subtask, index) => {
        if (subtask.orderIndex === null) {
          subtasksToUpdate.push({ id: subtask.id, index })
        }
      })
    })

    if (subtasksToUpdate.length > 0) {
      const updates = subtasksToUpdate.map(({ id, index }) =>
        prisma.subtask.update({
          where: { id },
          data: { orderIndex: index }
        })
      )
      await prisma.$transaction(updates)
      
      // Refetch tasks to get updated orderIndex
      const updatedTasks = await prisma.task.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          subtasks: { 
            orderBy: { orderIndex: "asc" },
            where: { completed: false }
          },
        },
      })

      return NextResponse.json({ 
        success: true, 
        count: updatedTasks.length,
        data: updatedTasks,
        rateLimit: { limit, remaining, reset: new Date(reset).toISOString() }
      }, {
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": new Date(reset).toISOString(),
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      count: tasks.length,
      data: tasks,
      rateLimit: { limit, remaining, reset: new Date(reset).toISOString() }
    }, {
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      }
    })
  } catch (error) {
    console.error("GET /api/breakdown error:", error)
    
    let message = "Failed to fetch tasks"
    let status = 500
    
    if (error instanceof Error) {
      message = error.message
      if (message.includes("does not exist") || message.includes("P2021")) {
        message = "Database tables not created. Run: npx prisma db push"
        status = 503
      }
    }
    
    return NextResponse.json(
      { 
        error: message, 
        success: false
      },
      { status }
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                                    PATCH                                   */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: Request) {
  try {
    // Rate limiting
    const identifier = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "anonymous"
    
    const { success, limit, reset, remaining } = await ratelimit.limit(`${identifier}:patch`)
    
    if (!success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded",
          limit,
          reset: new Date(reset).toISOString(),
          remaining
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": new Date(reset).toISOString(),
          }
        }
      )
    }

    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get("id")

    if (!taskId) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      )
    }

    const body = await req.json()
    
    // Validate subtasks
    const validation = z.object({
      subtasks: z.array(subtaskSchema)
    }).safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid subtasks payload",
          details: validation.error.format()
        },
        { status: 400 }
      )
    }

    const { subtasks } = validation.data
    // Normalize priorities to uppercase
    const normalizedSubtasks = subtasks.map(s => ({
      ...s,
      priority: (s.priority?.toUpperCase() || "MEDIUM") as "HIGH" | "MEDIUM" | "LOW",
    }));

    // Update task and subtasks
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        subtasks: {
          deleteMany: {}, // Delete all existing subtasks
          create: normalizedSubtasks.map((s, index) => ({
            title: s.title || "",
            description: s.description || "",
            estimateMinutes: Math.max(1, s.estimateMinutes || 1),
            completed: s.completed ?? false,
            priority: s.priority || "MEDIUM",
            orderIndex: index, // Important: maintain order
          })),
        },
      },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
      },
    })

    return NextResponse.json({ 
      success: true,
      data: updatedTask,
      rateLimit: { limit, remaining, reset: new Date(reset).toISOString() }
    }, {
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      }
    })
    
  } catch (error) {
    console.error("PATCH /api/breakdown error:", error)
    
    let message = "Failed to update task"
    let status = 500
    
    if (error instanceof Error) {
      message = error.message
      if (message.includes("RecordNotFound") || message.includes("P2025")) {
        message = "Task not found"
        status = 404
      }
    }
    
    return NextResponse.json(
      { error: message, success: false },
      { status }
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(req: Request) {
  try {
    // Rate limiting
    const identifier = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "anonymous"
    
    const { success, limit, reset, remaining } = await ratelimit.limit(`${identifier}:delete`)
    
    if (!success) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded",
          limit,
          reset: new Date(reset).toISOString(),
          remaining
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": new Date(reset).toISOString(),
          }
        }
      )
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      )
    }

    await prisma.task.delete({ where: { id } })

    return NextResponse.json({ 
      success: true,
      message: "Task deleted successfully",
      rateLimit: { limit, remaining, reset: new Date(reset).toISOString() }
    }, {
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": new Date(reset).toISOString(),
      }
    })
    
  } catch (error) {
    console.error("DELETE /api/breakdown error:", error)
    
    let message = "Failed to delete task"
    let status = 500
    
    if (error instanceof Error) {
      message = error.message
      if (message.includes("RecordNotFound") || message.includes("P2025")) {
        message = "Task not found"
        status = 404
      }
    }
    
    return NextResponse.json(
      { error: message, success: false },
      { status }
    )
  }
}