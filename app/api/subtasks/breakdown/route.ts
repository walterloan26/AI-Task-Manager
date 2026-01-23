import { NextResponse } from "next/server"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

/* -------------------------------------------------------------------------- */
/*                                   Setup                                    */
/* -------------------------------------------------------------------------- */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

type AISubtask = {
  title: string
  description: string
  estimateMinutes: number
  completed: boolean
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function buildPrompt(task: string): string {
  return `
Break down the following task into subtasks.

Rules:
- Respond with ONLY valid JSON
- Do NOT use markdown
- Return an array of objects with:
  - title (string)
  - description (string)
  - estimateMinutes (number)
  - completed (boolean)

Task:
${task}
`
}

function parseAndValidateAISubtasks(raw: string): AISubtask[] {
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim()

  let parsed: unknown

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error("AI response could not be parsed")
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI response is not an array")
  }

  for (const s of parsed) {
    if (
      typeof s.title !== "string" ||
      typeof s.description !== "string" ||
      typeof s.estimateMinutes !== "number" ||
      typeof s.completed !== "boolean"
    ) {
      throw new Error("AI response has invalid subtask shape")
    }
  }

  return parsed as AISubtask[]
}

/* -------------------------------------------------------------------------- */
/*                                    POST                                    */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const { task } = await req.json();

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "Invalid task input" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: buildPrompt(task) }],
      temperature: 0.3,
    });
    
    const raw = completion.choices[0].message.content ?? "[]";
    const subtasks = parseAndValidateAISubtasks(raw);

    const createdTask = await prisma.task.create({
      data: {
        task,
        subtasks: {
          create: subtasks.map((s, index) => ({
            title: s.title,
            description: s.description,
            estimateMinutes: s.estimateMinutes,
            completed: s.completed,
            priority: "Medium",
            orderIndex: index,
          })),
        },
      },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
      },
    });

    return NextResponse.json(createdTask, { status: 201 });
  } catch (error) {
    console.error("POST /api/breakdown error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                     GET                                    */
/* -------------------------------------------------------------------------- */

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subtasks: { orderBy: { orderIndex: "asc" } },
    },
  })

  for (const task of tasks) {
    if (task.subtasks.some(s => s.orderIndex === null)) {
      await prisma.$transaction(
        task.subtasks.map((s, index) =>
          prisma.subtask.update({
            where: { id: s.id },
            data: { orderIndex: index },
          })
        )
      )
    }
  }

  return NextResponse.json({ tasks })
}

/* -------------------------------------------------------------------------- */
/*                                    PATCH                                   */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get("id")

    if (!taskId) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      )
    }

    const { subtasks } = await req.json()

    if (!Array.isArray(subtasks)) {
      return NextResponse.json(
        { error: "Invalid subtasks payload" },
        { status: 400 }
      )
    }
    await prisma.$transaction([
      prisma.subtask.deleteMany({
        where: { taskId },
      }),

      prisma.subtask.createMany({
        data: subtasks.map((s) => ({
          taskId,
          title: s.title,
          description: s.description,
          estimateMinutes: s.estimateMinutes,
          completed: s.completed ?? false,
          priority: s.priority ?? "Medium",
          orderIndex: s.orderIndex,
        })),
      }),
    ])


    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subtasks: { orderBy: { orderIndex: "asc" } },
      },
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("PATCH /api/breakdown error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      )
    }

    await prisma.task.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/breakdown error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}