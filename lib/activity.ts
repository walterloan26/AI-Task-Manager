import { prisma } from "@/lib/prisma"
import { ACTIVITY_TYPES, ActivityType } from "./activityTypes"

type LogActivityInput = {
  type: ActivityType
  actorId: string
  taskId?: string
  meta?: any
}

export async function logActivity(input: LogActivityInput) {
  return prisma.activity.create({
    data: {
      type: input.type,
      actorId: input.actorId,
      taskId: input.taskId,
      meta: input.meta
    }
  })
}
