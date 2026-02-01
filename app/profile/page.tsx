// app/profile/page.tsx
import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import NavigationLayout from "@/app/components/NavigationLayout";

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session || !session.user.isActive) redirect("/login");

  return (
    <NavigationLayout user={session.user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-600 dark:text-gray-400">Profile management will appear here.</p>
      </div>
    </NavigationLayout>
  );
}