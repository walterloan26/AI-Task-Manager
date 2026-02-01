import { getAuthSession } from "@/app/api/auth/[...nextauth]/nextAuth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // ✅ Server-side session check
  const session = await getAuthSession();

  if (!session || !session.user.isActive) {
    // Redirect immediately if no session or inactive user
    redirect("/login");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Welcome back, {session.user.name}!</p>
      <p>Your role: {session.user.role}</p>
    </div>
  );
}
