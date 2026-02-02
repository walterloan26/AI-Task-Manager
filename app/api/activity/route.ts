// app/api/activity/route.ts
import { NextResponse } from "next/server";
import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ADMIN: See all activities with user info
  if (session.user.role === "ADMIN") {
    const activities = await prisma.activity.findMany({
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 15, // Show more for admin
    });
    return NextResponse.json(activities);
  }

  // REGULAR USER: See only their own activities
  const activities = await prisma.activity.findMany({
    where: { actorId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(activities);
}