import { NextResponse } from "next/server"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    // 1. Parse & validate input
    const { task } = await req.json()

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "Invalid task input" },
        { status: 400 }
      )
    }

    // 2. Build prompt
    const prompt = `
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

    // 3. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    })

    const raw = completion.choices[0].message.content ?? "[]"

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    // 4. Parse AI JSON
    let subtasks: {
      title: string
      description: string
      estimateMinutes: number
      completed: boolean
    }[]

    try {
      subtasks = JSON.parse(cleaned)
    } catch {
      console.error("Invalid AI JSON:", cleaned)
      return NextResponse.json(
        { error: "AI response could not be parsed" },
        { status: 500 }
      )
    }

    // 5. Create task ONCE via Prisma
    const createdTask = await prisma.task.create({
      data: {
        task,
        subtasks: {
          create: subtasks.map(s => ({
            title: s.title,
            description: s.description,
            estimateMinutes: s.estimateMinutes,
            completed: s.completed
          })),
        },
      },
      include: {
        subtasks: true,
      },
    })

    // 6. Return Prisma result
    return NextResponse.json(createdTask, { status: 201 })

  } catch (error) {
    console.error("POST /api/breakdown error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      subtasks: true,
    },
  })

  return NextResponse.json({ tasks })
}


export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
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
        where: { taskId: id },
      }),

      prisma.subtask.createMany({
        data: subtasks.map(s => ({
          taskId: id,
          title: s.title,
          description: s.description,
          estimateMinutes: s.estimateMinutes,
          completed: s.completed ?? false,
          priority: s.priority ?? "Medium"
        })),
      }),
    ])

    const updatedTask = await prisma.task.findUnique({
      where: { id },
      include: { subtasks: true },
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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Task id is required" },
        { status: 400 }
      );
    }

    // Delete task and all its subtasks
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/breakdown error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}




