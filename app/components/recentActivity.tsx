"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  Clock, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  PlusCircle, 
  Edit,
  Activity as ActivityIcon,
  RefreshCw,
  User,
  Shield
} from "lucide-react";

type Activity = {
  id: string;
  type: string;
  createdAt: string;
  meta?: any;
  actor?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

// Activity type configuration
const ACTIVITY_CONFIG = {
  LOGIN: {
    icon: LogIn,
    text: "Signed in",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-100"
  },
  LOGOUT: {
    icon: LogOut,
    text: "Signed out",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-100"
  },
  TASK_CREATED: {
    icon: PlusCircle,
    text: "Created task",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100"
  },
  TASK_UPDATED: {
    icon: Edit,
    text: "Updated task",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-100"
  },
  TASK_COMPLETED: {
    icon: CheckCircle,
    text: "Completed task",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-100"
  },
  SUBTASK_COMPLETED: {
    icon: CheckCircle,
    text: "Completed Subtask",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-100"
  }
} as const;

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>("USER");
  const [showSkeleton, setShowSkeleton] = useState(false);

  const fetchActivities = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setShowSkeleton(true); // ✅ Show skeleton immediately
    }
    
    try {
      // Remove or reduce artificial delay for production
      if (isRefresh) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Short delay
      }
      
      const response = await fetch("/api/activity");
      const data = await response.json();
      
      // Get user role from first activity or session
      if (data.length > 0 && data[0].actor) {
        // Admin view - has actor data
        setUserRole("ADMIN");
      }
      
      // Filter: Only show today's activities, remove duplicate logins
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const seenHours = new Set<string>();
      const filtered = data
        .filter((activity: Activity) => {
          if (activity.type !== "LOGIN") return true;
          const activityDate = new Date(activity.createdAt);
          return activityDate >= today;
        })
        .filter((activity: Activity) => {
          if (activity.type !== "LOGIN") return true;
          const hour = new Date(activity.createdAt).toISOString().slice(0, 13);
          const key = `${activity.actor?.id || 'user'}-${hour}`;
          if (seenHours.has(key)) return false;
          seenHours.add(key);
          return true;
        })
        .slice(0, 8);
      
      // Update activities
      setActivities(filtered);
      
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      if (isRefresh) {
        // Keep skeleton visible a bit longer for smooth transition
        setTimeout(() => {
          setShowSkeleton(false);
          setRefreshing(false);
        }, 200);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

  const getActivityConfig = (type: string) => {
    return ACTIVITY_CONFIG[type as keyof typeof ACTIVITY_CONFIG] || {
      icon: ActivityIcon,
      text: type,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-100"
    };
  };

  // Premium Skeleton Loader - FIXED no horizontal scroll
  const PremiumSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" />
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-5 h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse flex-shrink-0" />
          <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-32 animate-pulse" />
        </div>
        <PremiumSkeleton />
      </div>
    );
  }

  if (activities.length === 0 && !showSkeleton) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <ActivityIcon className="w-5 h-5 text-gray-700 flex-shrink-0" />
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="text-center py-8">
          <ActivityIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No recent activity</p>
          <p className="text-gray-400 text-xs mt-1">Activities will appear here</p>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button 
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-lg border border-gray-200 shadow-sm hover:shadow flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Activity'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {userRole === "ADMIN" ? (
            <div className="relative flex-shrink-0">
              <Shield className="w-5 h-5 text-purple-600" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            </div>
          ) : (
            <ActivityIcon className="w-5 h-5 text-gray-700 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">Recent Activity</h3>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {userRole === "ADMIN" ? "Team activity" : "Your activity"}
            </p>
          </div>
        </div>
        
        {/* Refresh indicator */}
        {refreshing && (
          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border animate-pulse flex-shrink-0">
            Updating...
          </div>
        )}
      </div>

      {/* Content Area - FIXED with overflow control */}
      <div className="relative min-h-[200px]">
        {/* Content - hidden when skeleton is shown */}
        <div className={`transition-opacity duration-300 ${showSkeleton ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <ActivityIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No recent activity</p>
              <p className="text-gray-400 text-xs mt-1">Activities will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const config = getActivityConfig(activity.type);
                const Icon = config.icon;
                const isTeamView = userRole === "ADMIN" && activity.actor;
                
                return (
                  <div 
                    key={activity.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-transform duration-200 hover:translate-x-1`}
                  >
                    {/* Icon Badge */}
                    <div className={`p-2 rounded-lg ${config.bgColor} border ${config.borderColor} shadow-sm flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* User info for team view */}
                      {isTeamView && activity.actor && (
                        <div className="flex items-center gap-2 mb-1">
                          {activity.actor.image ? (
                            <div className="relative w-6 h-6 flex-shrink-0">
                              <Image
                                src={activity.actor.image}
                                alt={activity.actor.name || "User"}
                                fill
                                className="rounded-full object-cover ring-1 ring-white"
                                sizes="24px"
                              />
                            </div>
                          ) : (
                            <div className="w-6 h-6 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center ring-1 ring-white flex-shrink-0">
                              <User className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {activity.actor.name || activity.actor.email.split('@')[0]}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`font-medium text-gray-900 truncate ${isTeamView ? 'text-sm' : 'text-sm'}`}>
                            {config.text}
                          </p>
                          {activity.meta?.description && (
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              {activity.meta.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{formatTime(activity.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Skeleton overlay - absolute positioned */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <PremiumSkeleton />
        </div>
      </div>

      {/* Premium Refresh Button */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button 
          onClick={() => fetchActivities(true)}
          disabled={refreshing || showSkeleton}
          className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-gradient-to-b from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 rounded-lg border border-gray-200 shadow-sm hover:shadow flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="relative">
            <RefreshCw className={`w-4 h-4 transition-transform duration-300 ${refreshing ? 'rotate-180' : ''}`} />
            {refreshing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
          <span>
            {refreshing ? 'Refreshing...' : 'Refresh Activity'}
          </span>
        </button>
      </div>
    </div>
  );
}