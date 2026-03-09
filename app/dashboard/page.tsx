// app/dashboard/page.tsx
import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import NavigationLayout from "@/app/components/NavigationLayout";
import RecentActivity from "@/app/components/recentActivity";
import { getDashboardStats } from "@/lib/dashboard/stats";
import { getDashboardActivitySummary } from "@/lib/dashboard/activitySummary";
import { getProductivityScore, getTaskCompletionRate } from "@/lib/dashboard/productivity";
import UserProfileCard from "@/app/components/UserProfileCard";
import AIInsights from "@/app/components/AIInsights";
import { 
  LayoutGrid, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Sparkles,
  BarChart3,
  Zap,
  Target,
  Brain,
  Bot
} from 'lucide-react';

// Types
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

interface QuickActionProps {
  icon: string;
  label: string;
  description: string;
  color: 'purple' | 'blue' | 'green' | 'yellow';
  onClick?: () => void;
}

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color }: StatCardProps) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900',
      icon: 'text-blue-600 dark:text-blue-300'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900',
      icon: 'text-green-600 dark:text-green-300'
    },
    yellow: {
      bg: 'bg-yellow-100 dark:bg-yellow-900',
      icon: 'text-yellow-600 dark:text-yellow-300'
    },
    red: {
      bg: 'bg-red-100 dark:bg-red-900',
      icon: 'text-red-600 dark:text-red-300'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color].bg} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${colorClasses[color].icon}`} />
        </div>
      </div>
    </div>
  );
};

// Quick Action Button Component
const QuickActionButton = ({ icon, label, description, color, onClick }: QuickActionProps) => {
  const colorClasses = {
    purple: 'hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20',
    blue: 'hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    green: 'hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20',
    yellow: 'hover:border-yellow-300 dark:hover:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
  };

  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${colorClasses[color]} transition-all text-left group hover:scale-[1.02] active:scale-[0.98]`}
    >
      <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="font-medium text-gray-900 dark:text-white">{label}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
    </button>
  );
};

// AI Summary Component
const AISummary = ({ hasAnyActivity }: { hasAnyActivity: boolean }) => {
  const summaryText = hasAnyActivity 
    ? "Great progress today! You're making excellent strides. Keep up the momentum!"
    : "Ready to start? Try creating your first task with AI assistance to boost your productivity.";

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-purple-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              AI-Powered Summary
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {summaryText}
          </p>
        </div>
        <button className="ml-4 px-4 py-2 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md hover:shadow-lg">
          <Sparkles className="w-4 h-4" />
          Ask AI
        </button>
      </div>
    </div>
  );
};

// AI Model Status Component
const AIModelStatus = () => {
  return (
    <div className="bg-gradient-to-br from-purple-500 via-purple-500 to-blue-500 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full blur-xl transform -translate-x-12 translate-y-12"></div>
      
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-5 h-5" />
              <h3 className="font-bold text-lg">AI Assistant</h3>
            </div>
            <p className="text-purple-100 text-sm">Ready to help optimize your tasks</p>
          </div>
          <div className="relative">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75"></div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
            <p className="text-xs text-purple-200">Tasks analyzed</p>
            <p className="text-lg font-semibold">1,234</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2 backdrop-blur-sm">
            <p className="text-xs text-purple-200">Success rate</p>
            <p className="text-lg font-semibold">98%</p>
          </div>
        </div>

        <button className="w-full mt-4 py-2.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 shadow-lg">
          <Sparkles className="w-4 h-4" />
          Try AI Task Breakdown
        </button>
      </div>
    </div>
  );
};

// Quick Actions Section Component
const QuickActionsSection = () => {
  const quickActions = [
    { icon: '🤖', label: 'AI Assistant', description: 'Chat with AI', color: 'purple' as const },
    { icon: '📊', label: 'Analytics', description: 'View insights', color: 'blue' as const },
    { icon: '⚡', label: 'Quick Task', description: 'Add with voice', color: 'green' as const },
    { icon: '🎯', label: 'Focus Mode', description: 'Start session', color: 'yellow' as const }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <QuickActionButton key={action.label} {...action} />
        ))}
      </div>
    </div>
  );
};

export default async function DashboardPage() {
  const session = await getAuthSession();

  if (!session || !session.user.isActive) {
    redirect("/login");
  }

  // Determine account type
  const isGoogleAccount = session.user.image?.includes('googleusercontent.com');
  
  // Fetch dashboard data in parallel
  const [stats, activity, productivityScore, completionMetrics] = await Promise.all([
    getDashboardStats(session.user.id),
    getDashboardActivitySummary(session.user.id),
    getProductivityScore(session.user.id),
    getTaskCompletionRate(session.user.id)
  ]);

  const { hasAnyActivity } = activity;

  // Define stat cards configuration
  const statCards = [
    { title: 'Total Tasks', value: stats.total, icon: LayoutGrid, color: 'blue' as const },
    { title: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'green' as const },
    { title: 'In Progress', value: stats.inProgress, icon: Clock, color: 'yellow' as const },
    { title: 'Pending', value: stats.pending, icon: AlertCircle, color: 'red' as const }
  ];

  return (
    <NavigationLayout user={session.user}>
      <div className="space-y-6">
        {/* Welcome Header */}
        <UserProfileCard 
          user={session.user} 
          isGoogleAccount={isGoogleAccount} 
          productivityScore={productivityScore}
          completionMetrics={completionMetrics} 
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Today's Activity
            </h2>
            <RecentActivity userId={session.user.id} />
            <AISummary hasAnyActivity={hasAnyActivity} />
          </div>

          {/* Right Column: AI & Quick Actions */}
          <div className="space-y-6">
            {/* AI Insights */}
            <AIInsights />
            
            {/* Quick Actions */}
            <QuickActionsSection />

            {/* AI Model Status */}
            <AIModelStatus />
          </div>
        </div>
      </div>
    </NavigationLayout>
  );
}