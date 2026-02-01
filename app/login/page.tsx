import { getAuthSession } from "@/app/api/auth/[...nextauth]/nextAuth";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const session = await getAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginClient />;
}
