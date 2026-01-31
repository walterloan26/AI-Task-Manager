import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/nextAuth";
import { ROLES, type Role } from "@/lib/roles";

export async function requireRole(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: readonly Role[]
) {
  const session = await getServerSession(req, res, authOptions);

  // 1️⃣ Not authenticated
  if (!session?.user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  // 2️⃣ Disabled user → hard stop
  if (session.user.isActive === false) {
    res.status(403).json({ message: "User disabled" });
    return null;
  }

  const role = session.user.role;

  // 3️⃣ Role integrity check (defensive)
  if (!Object.values(ROLES).includes(role)) {
    res.status(403).json({ message: "Invalid role" });
    return null;
  }

  // 4️⃣ Role authorization
  if (!allowedRoles.includes(role)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }

  return session.user;
}
