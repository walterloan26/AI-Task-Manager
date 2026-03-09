export async function fetchUpcomingTasks({
  userId,
  limit,
  userRole,
}: {
  userId: string;
  limit: number;
  userRole: string;
}) {
  const response = await fetch(
    `/api/tasks/upcoming?limit=${limit}&userId=${userId}&role=${userRole}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch tasks");
  }

  const data = await response.json();

  const normalizedData = {
    ...data,
    tasks: data.tasks?.map((task: any) => ({
      ...task,
      // Normalize task priority to uppercase
      priority: task.priority?.toUpperCase() || 'MEDIUM',
      // Also normalize subtask priorities if they exist
      subtasks: task.subtasks?.map((subtask: any) => ({
        ...subtask,
        priority: subtask.priority?.toUpperCase() || 'MEDIUM'
      }))
    }))
  };

  return normalizedData;
}