// lib/auth.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "../app/api/auth/nextAuth";

export async function requireRole(req, res, allowedRoles: string[]) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  if (!allowedRoles.includes(session.user.role)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }

  return session.user;
}
