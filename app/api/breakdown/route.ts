import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const tasks: {
      id: string
      task: string
      subtasks: {
        title: string
        description: string
        estimateMinutes: number
      }[]
      createdAt: string
    }[] = []

export async function POST(req: Request) {
  try {
    // 1. Parse request
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

Task:
${task}
`

    // 3. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    })

    // 4. Extract and clean response
    const raw = completion.choices[0].message.content || "[]"

    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    // 5. Parse JSON (this is the most fragile part)
    let subtasks

    try {
      subtasks = JSON.parse(cleaned)
    } catch (parseError) {
      console.error("AI returned invalid JSON:", cleaned)

      return NextResponse.json(
        { error: "AI response could not be parsed" },
        { status: 500 }
      )
    }

    // 6. Success response
    const newTask = {
      id: crypto.randomUUID(),
      task,
      subtasks,
      createdAt: new Date().toISOString(),
    }

    tasks.push(newTask)

    // 6. Success response
    return NextResponse.json(newTask, { status: 201 })

  } catch (error) {
    // 7. Catch ANY unexpected failure
    console.error("AI breakdown API error:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
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

    const body = await req.json()
    const { subtasks } = body

    if (!Array.isArray(subtasks)) {
      return NextResponse.json(
        { error: "Invalid subtasks payload" },
        { status: 400 }
      )
    }

    const task = tasks.find(t => t.id === id)

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      )
    }

    task.subtasks = subtasks

    return NextResponse.json(task)
  } catch (error) {
    console.error("PATCH /api/breakdown error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


