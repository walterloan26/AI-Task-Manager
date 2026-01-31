// /pages/api/tasks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

const createTaskSchema = z.object({
  task: z.string().min(1, "Task name is required").max(500),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

const querySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, Number(v ?? 1))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, Number(v ?? 20)))),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
});

/* -------------------------------------------------------------------------- */
/*                                   Handler                                  */
/* -------------------------------------------------------------------------- */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await requireRole(req, res, [ROLES.USER, ROLES.ADMIN]);
  if (!user) return;

  try {
    switch (req.method) {
      /* ---------------------------------- GET ---------------------------------- */
      case "GET": {
        const parsedQuery = querySchema.safeParse(req.query);
        if (!parsedQuery.success) {
          return res.status(400).json({
            success: false,
            message: "Invalid query parameters",
            errors: parsedQuery.error.flatten().fieldErrors,
          });
        }

        const { page, limit, status } = parsedQuery.data;
        const skip = (page - 1) * limit;

        const where: Prisma.TaskWhereInput = {
          userId: user.id,
          ...(status && { status }),
        };

        const [tasks, total] = await Promise.all([
          prisma.task.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              subtasks: {
                where: { isDeleted: false },
                orderBy: { orderIndex: "asc" },
              },
            },
          }),
          prisma.task.count({ where }),
        ]);

        return res.status(200).json({
          success: true,
          data: tasks,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
          },
        });
      }

      /* ---------------------------------- POST --------------------------------- */
      case "POST": {
        const parsedBody = createTaskSchema.safeParse(req.body);
        if (!parsedBody.success) {
          return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: parsedBody.error.flatten().fieldErrors,
          });
        }

        const { task, complexity } = parsedBody.data;

        const newTask = await prisma.task.create({
          data: {
            task,
            complexity,
            status: "TODO",
            userId: user.id,
          },
        });

        return res.status(201).json({
          success: true,
          message: "Task created successfully",
          data: newTask,
        });
      }

      /* ------------------------------ UNSUPPORTED ------------------------------ */
      default: {
        res.setHeader("Allow", ["GET", "POST"]);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} not allowed`,
        });
      }
    }
  } catch (err: unknown) {
    console.error("Tasks API error:", err);

    const message =
      err instanceof Error ? err.message : "Unexpected error";

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: message }),
    });
  }
}
