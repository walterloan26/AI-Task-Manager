import { requireRole } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export default async function handler(req, res) {
  const user = await requireRole(req, res, ["USER", "MANAGER", "ADMIN"]);
  if (!user) return; // already handled in requireRole

  switch (req.method) {
    case "GET":
      let tasks;
      if (user.role === "USER") {
        tasks = await prisma.task.findMany({
          where: { userId: user.id },
          include: { subtasks: true },
        });
      } else {
        tasks = await prisma.task.findMany({
          include: { subtasks: true, user: true },
        });
      }
      return res.status(200).json(tasks);

    case "POST":
      const { task, complexity } = req.body;
      const newTask = await prisma.task.create({
        data: {
          task,
          complexity,
          userId: user.id,
        },
      });
      return res.status(201).json(newTask);

    default:
      return res.status(405).json({ message: "Method not allowed" });
  }
}
