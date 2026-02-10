// app/tasks/page.tsx - Starting Point
import TaskBoard from "@/app/taskboard";
import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import NavigationLayout from "@/app/components/NavigationLayout";
import UpcomingTasks from "@/app/components/UpcomingTasks";
import TaskStatsBar from "@/app/components/TaskStatsBar";
import QuickAddPanel from "@/app/components/QuickAddPanel";
import AISuggestions from "@/app/components/AISuggestions";
import { getDashboardStats } from "@/lib/dashboard/stats";


export default async function TasksPage() {
  const session = await getAuthSession();

  if (!session || !session.user.isActive) {
    redirect("/login");
  }

  const initialStats = await getDashboardStats(session.user.id, session.user.role);

  return (
    <NavigationLayout user={session.user}>
      <div className="space-y-6">
        {/* Header with quick stats */}
        <TaskStatsBar 
          userId={session.user.id} 
          userRole={session.user.role} 
          initialStats={initialStats}
        />
        
        {/* Main content area - Two columns for now, easy to expand to three */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Task Board (2/3 width on desktop) */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <TaskBoard 
                userId={session.user.id} 
                userEmail={session.user.email || ''} 
                userRole={session.user.role}
              />
            </div>
          </div>
          
          {/* Sidebar (1/3 width on desktop) */}
          <div className="space-y-6">
            {/* Upcoming Tasks Widget */}
            <UpcomingTasks userId={session.user.id} limit={5} />

            {/* Quick Add Panel */}
            <QuickAddPanel userId={session.user.id} />
            
            {/* AI Suggestions */}
            <AISuggestions userId={session.user.id} />
            
            {/* Placeholder for future features */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-dashed border-gray-300 dark:border-gray-700">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                  More Features Coming
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Calendar view, analytics, and more will appear here
                </p>
              </div>
              </div>
          </div>
        </div>
      </div>
    </NavigationLayout>
  );
}