// lib/dashboard/activitySummary.ts
import { prisma } from "@/lib/prisma";
import { ACTIVITY_TYPES } from "../activityTypes";

export type DashboardActivitySummary = {
  signedIn: boolean;
  tasksCreated: number;
  subtasksCompleted: number;
  profileUpdated: boolean;
  hasAnyActivity: boolean;
};

export async function getDashboardActivitySummary(
  userId: string
): Promise<DashboardActivitySummary> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const activities = await prisma.activity.findMany({
    where: {
      actorId: userId,
      createdAt: { gte: since },
    },
    select: { type: true },
  });
  console.log("ALL activities:", activities);

  const signedIn = activities.some(a => a.type === ACTIVITY_TYPES.LOGIN);
  const tasksCreated = activities.filter(
    a => a.type === ACTIVITY_TYPES.TASK_CREATED
  ).length;
  const subtasksCompleted = activities.filter(
    a => a.type === ACTIVITY_TYPES.SUBTASK_COMPLETED
  ).length;
  const profileUpdated = activities.some(
    a => a.type === ACTIVITY_TYPES.PROFILE_UPDATED
  );

  return {
    signedIn,
    tasksCreated,
    subtasksCompleted,
    profileUpdated,
    hasAnyActivity:
      signedIn || tasksCreated > 0 || subtasksCompleted > 0 || profileUpdated,
  };
}
