import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/nextAuth";
import TaskBoard from "./taskboard";

export default async function Page() {
  const session = await getServerSession(authOptions)
    if (!session) {
      redirect("/login");
    }
  return (
    <TaskBoard
      userId={session.user.id}
      userEmail={session.user.email ?? ""}
    />
  );
}
