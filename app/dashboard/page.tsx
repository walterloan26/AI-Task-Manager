// app/dashboard/page.tsx - Updated with Navigation
import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import NavigationLayout from "@/app/components/NavigationLayout";
import RecentActivity from "@/app/components/recentActivity";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getDashboardActivitySummary } from "@/lib/dashboard/activitySummary";
import { DashboardRow } from "../components/dashboardRow"
import UserProfileCard from "@/app/components/UserProfileCard";
import AIInsights from "@/app/components/AIInsights";
import UpcomingTasks from "@/app/components/UpcomingTasks";
import TasksPreview from "@/app/components/TasksPreview";
import Link from "next/link";
import { Plus, ListTodo, Brain } from 'lucide-react';





export default async function DashboardPage() {
  const session = await getAuthSession();

  if (!session || !session.user.isActive) {
    redirect("/login");
  }

  // Determine account type
  const isGoogleAccount = session.user.image?.includes('googleusercontent.com');
  
  const stats = await getDashboardStats(session.user.id);

  const activity = await getDashboardActivitySummary(session.user.id);

  const {
    signedIn,
    tasksCreated,
    subtasksCompleted,
    profileUpdated,
    hasAnyActivity,
  } = activity;




  return (
    <NavigationLayout user={session.user}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <UserProfileCard user={session.user} isGoogleAccount={isGoogleAccount} />
        {/* <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back, {session.user.name || session.user.email}!
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Here's what's happening with your tasks today.
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isGoogleAccount 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
            }`}>
              {isGoogleAccount ? 'Google Account' : 'Email Account'}
            </div>
          </div>
        </div> */}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.completed}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.inProgress}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <UpcomingTasks userId={session.user.id} />

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
               Today
            </h2>
            <RecentActivity userId={session.user.id}/>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                      AI-Powered Summary
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {hasAnyActivity 
                        ? "Great progress today! Keep up the momentum."
                        : "Ready to start? Try creating your first task with AI assistance."
                      }
                    </p>
                </div>
                <button className="px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity">
                    Ask AI
                  </button>
              </div>

            </div>

            {/* <div className="space-y-4">
              {signedIn && (
                <DashboardRow icon="🔐" label="Signed in today" />
              )}
              {tasksCreated > 0 && (
                <DashboardRow
                  icon="📝"
                  label={`Hi, ${session.user.name} you just created ${activity.tasksCreated} task.${activity.tasksCreated > 1 ? "s." : ""}`}
                />
              )}
              {subtasksCompleted > 0 && (
                <DashboardRow
                  icon="✅"
                  label={`Completed ${activity.subtasksCompleted} subtask${activity.subtasksCompleted > 1 ? "s" : ""}`}
                />
              )}
              {profileUpdated && (
                <DashboardRow icon="👤" label="Updated profile" />
              )}
              {signedIn &&
                tasksCreated === 0 &&
                subtasksCompleted === 0 &&
                !profileUpdated && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No activity recorded today.
                  </p>
              )}
            </div> */}
          </div>

          {/* Quick Actions */}
          {/* <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <div className="text-2xl mb-2">📋</div>
                <div className="font-medium text-gray-900 dark:text-white">New Task</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Create a new task</div>
              </button>
              
              <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-medium text-gray-900 dark:text-white">AI Breakdown</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Break down with AI</div>
              </button>
              
              <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-medium text-gray-900 dark:text-white">Analytics</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">View insights</div>
              </button>
              
              <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                <div className="text-2xl mb-2">⚙️</div>
                <div className="font-medium text-gray-900 dark:text-white">Settings</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Manage account</div>
              </button>
            </div>
          </div> */}
          {/* Right Column: AI & Quick Actions */}
          <div className="space-y-6">
            {/* AI Insights */}
            <AIInsights />
            
            {/* Quick Actions - Enhanced */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🤖</div>
                  <div className="font-medium text-gray-900 dark:text-white">AI Assistant</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Chat with AI</div>
                </button>
                <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                  <div className="font-medium text-gray-900 dark:text-white">Analytics</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">View insights</div>
                </button>
                
                <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚡</div>
                  <div className="font-medium text-gray-900 dark:text-white">Quick Task</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Add with voice</div>
                </button>
                
                <button className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors text-left group">
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">🎯</div>
                  <div className="font-medium text-gray-900 dark:text-white">Focus Mode</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Start session</div>
                </button>
              </div>
            </div>
            {/* AI Model Status */}
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-sm p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">AI Assistant</h3>
                  <p className="text-purple-100 text-sm">Ready to help optimize your tasks</p>
                </div>
                <div className="animate-pulse">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
              </div>
              <button className="w-full mt-4 py-2 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors">
                Try New Feature: AI Task Breakdown
              </button>
            </div>
          </div>
        </div>
      </div>
    </NavigationLayout>
  );
}