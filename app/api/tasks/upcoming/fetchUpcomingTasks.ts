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

  return data;
}