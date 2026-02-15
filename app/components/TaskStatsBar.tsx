// app/components/tasks/TaskStatsBar.tsx - HYBRID APPROACH
"use client";

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle, TrendingUp, Shield } from 'lucide-react';
//import { globalEvents } from '@/lib/events/eventEmitter';
import { clientEvents } from '@/lib/events/clientEvents';

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completedSubtasks: number;
  totalSubtasks: number;
}

interface TaskStatsBarProps {
  userId: string;
  userRole?: string;
  initialStats: TaskStats; // Initial data fetched on server
}

export default function TaskStatsBar({ 
  userId, 
  userRole = 'USER',
  initialStats 
}: TaskStatsBarProps) {
  const [stats, setStats] = useState<TaskStats>(initialStats);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('Just now');

    useEffect(() => {
    const handleTaskUpdated = () => {
      console.log('📊 TaskStatsBar: Event received → refreshing stats');
      setLastUpdate('Updating...');
      fetchStats();
    };

    clientEvents.on('task:created', handleTaskUpdated);
    clientEvents.on('task:deleted', handleTaskUpdated);
    clientEvents.on('subtask:toggled', handleTaskUpdated);
    clientEvents.on('task:updated', handleTaskUpdated);

    const pollInterval = setInterval(() => {
      const now = Date.now();
      const lastPoll = localStorage.getItem('lastStatsPoll');

      if (!lastPoll || now - parseInt(lastPoll) > 30000) {
        fetchStats();
        localStorage.setItem('lastStatsPoll', now.toString());
      }
    }, 30000);

    return () => {
      clientEvents.off('task:created', handleTaskUpdated);
      clientEvents.off('task:deleted', handleTaskUpdated);
      clientEvents.off('subtask:toggled', handleTaskUpdated);
      clientEvents.off('task:updated', handleTaskUpdated);
      clearInterval(pollInterval);
    };
  }, [userId, userRole]);


  const fetchStats = async () => {
    setLoading(true);
    try {
        const timestamp = Date.now();
      const response = await fetch(
        `/api/tasks/stats?userId=${userId}&role=${userRole}&_=${timestamp}`
    );
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }
      
    const data = await response.json();
    setStats(prev => {
      console.log("Stats changed", {
        old: prev,
        new: data
      });
      return data;
    });

    //setStats(data);
      
      // Update timestamp
    const now = new Date();
    setLastUpdate(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
    } catch (error) {
      console.error('📊 TaskStatsBar: Error fetching stats:', error);
    } finally {
      setLoading(false);
      console.log('📊 TaskStatsBar: fetchStats complete');
    }
  };

  const completionRate = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  const isAdmin = userRole === 'ADMIN';

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = 'blue',
    subtitle = ''
  }: {
    title: string;
    value: number | string;
    icon: any;
    color?: 'blue' | 'green' | 'yellow' | 'gray' | 'purple';
    subtitle?: string;
  }) => {
    const colorClasses = {
      blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300',
      green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300',
      yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-300',
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
      purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Admin badge */}
      {isAdmin && (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 mr-3" />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-600 text-white mr-2">
                  ADMIN VIEW
                </span>
                <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                  Viewing all users' tasks
                </span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                You can see, edit, and delete any task in the system
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Task Statistics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isAdmin ? 'Overview of all tasks' : 'Your personal task progress'}
            {loading ? ' • Updating...' : ` • Updated ${lastUpdate}`}
          </p>
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          title={isAdmin ? "All Tasks" : "My Tasks"}
          value={stats.total}
          icon={() => (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
          color="blue"
          subtitle={isAdmin ? "Across all users" : "You own/are assigned"}
        />

        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle}
          color="green"
          subtitle={`${completionRate}% of total`}
        />

        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Clock}
          color="yellow"
          subtitle={`${stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}% of total`}
        />

        <StatCard
          title="Pending"
          value={stats.pending}
          icon={AlertCircle}
          color="gray"
          subtitle={`${stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% of total`}
        />

        <StatCard
          title="Subtasks Completed"
          value={`${stats.completedSubtasks}`}
          icon={CheckCircle}
          color="green"
          subtitle={`${stats.completedSubtasks} of ${stats.totalSubtasks} Subtasks`}
        />

        <StatCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={TrendingUp}
          color="purple"
          subtitle={`${stats.completed} of ${stats.total} tasks`}
        />
      </div>

      {/* Progress visualization */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Progress Breakdown
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? "Across all users" : "Your task progress"}
            </p>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {completionRate}%
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
          <div 
            className="h-3 rounded-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.completed}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">Completed</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.inProgress}
            </div>
            <div className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">In Progress</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {stats.pending}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">Pending</div>
          </div>
        </div>
        <button
  onClick={async () => {
    const response = await fetch('/api/tasks/stats/debug');
    const data = await response.json();
    
    
    // Show which tasks are In Progress
    const inProgressTasks = data.detailed.filter((t: any) => t.status === 'IN_PROGRESS');
    
    
    // Show which tasks just moved to Completed
    const newlyCompleted = data.detailed.filter((t: any) => 
      t.status === 'COMPLETED' && 
      t.progress.split('/')[0] === t.progress.split('/')[1] // All subtasks done
    );
  }}
  className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 rounded"
>
  Debug Analysis
</button>
      </div>
    </>
  );
}