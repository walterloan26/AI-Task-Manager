import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const { task } = await req.json()

    if (!task) {
        return NextResponse.json({ error: "task required" }, { status: 400 })
    }
    // TEMP fake response (safe transition)
    const subtasks = [
        {
            title: "Analyze task",
            description: "Understand scope and constraints",
            estimateMinutes: 10,
        },
        {
            title: "Break into steps",
            description: "Divide work into actionable parts",
            estimateMinutes: 20,
        },
    ]
    return NextResponse.json({ subtasks })
}