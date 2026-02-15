// app/components/UpcomingTasks.tsx
"use client";

import { Calendar, Clock, Flag, MoreVertical, CheckCircle, Circle, Timer } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  estimateMinutes: number;
}

interface Task {
  id: string;
  title: string;
  complexity: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  progress: number;
  totalSubtasks: number;
  completedSubtasks: number;
  totalEstimateMinutes?: number; // Add this
  completedEstimateMinutes?: number; // Add this
  owner?: { name: string; email: string };
  createdBy?: { name: string; email: string };
  assignedTo?: { name: string; email: string };
  subtasks: Subtask[];
  aiGenerated?: boolean;
  aiConfidence?: number;
}

interface AIRecommendation {
  message: string;
  action: string;
}

interface UpcomingTasksProps {
  userId: string;
  limit?: number;
}

const UpcomingTasks = ({ userId, limit = 5 }: UpcomingTasksProps) => {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpcomingTasks();
    
    // Set up real-time updates
    const handleTaskUpdate = () => fetchUpcomingTasks();
    window.addEventListener('task:updated', handleTaskUpdate);
    window.addEventListener('subtask:toggled', handleTaskUpdate);
    
    return () => {
      window.removeEventListener('task:updated', handleTaskUpdate);
      window.removeEventListener('subtask:toggled', handleTaskUpdate);
    };
  }, [userId, limit]);

  const fetchUpcomingTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/upcoming?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      
      // Calculate time estimates for each task
      const tasksWithTime = data.tasks.map((task: any) => {
        const totalEstimateMinutes = task.subtasks.reduce(
          (sum: number, st: Subtask) => sum + (st.estimateMinutes || 0), 
          0
        );
        const completedEstimateMinutes = task.subtasks
          .filter((st: Subtask) => st.completed)
          .reduce((sum: number, st: Subtask) => sum + (st.estimateMinutes || 0), 0);
        
        return {
          ...task,
          totalEstimateMinutes,
          completedEstimateMinutes
        };
      });
      
      setTasks(tasksWithTime);
      setAiRecommendation(data.aiRecommendation);
      setError(null);
    } catch (err) {
      console.error('Error fetching upcoming tasks:', err);
      setError('Failed to load upcoming tasks');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const taskDate = new Date(date);
    const diffTime = now.getTime() - taskDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return taskDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatEstimate = (minutes: number) => {
    if (!minutes || minutes < 1) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTimeProgress = (task: Task) => {
    if (!task.totalEstimateMinutes || task.totalEstimateMinutes === 0) return null;
    return Math.round((task.completedEstimateMinutes || 0) / task.totalEstimateMinutes * 100);
  };

  const getTaskUrgency = (task: Task) => {
    const created = new Date(task.createdAt);
    const now = new Date();
    const daysOld = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    // Consider time estimates in urgency calculation
    const timeProgress = getTimeProgress(task);
    const hasTimeEstimate = task.totalEstimateMinutes && task.totalEstimateMinutes > 0;
    
    if (task.priority === 'high' && daysOld > 2 && (!hasTimeEstimate || (timeProgress && timeProgress < 30))) {
      return 'overdue';
    }
    if (task.priority === 'high' && daysOld > 1 && (!hasTimeEstimate || (timeProgress && timeProgress < 50))) {
      return 'urgent';
    }
    if (task.priority === 'medium' && daysOld > 3 && (!hasTimeEstimate || timeProgress === 0)) {
      return 'soon';
    }
    return 'normal';
  };

  const handleTaskClick = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  const handleViewDetails = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/tasks/${taskId}`);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'Create Task') {
      router.push('/tasks/new');
    } else if (action === 'View Task' || action === 'Continue' || action === 'Begin') {
      // Find the relevant task from the recommendation
      const task = tasks[0];
      if (task) router.push(`/tasks/${task.id}`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">{error}</div>
          <button 
            onClick={fetchUpcomingTasks}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Calculate time summaries
  const totalEstimatedTime = tasks.reduce((sum, task) => sum + (task.totalEstimateMinutes || 0), 0);
  const completedTime = tasks.reduce((sum, task) => sum + (task.completedEstimateMinutes || 0), 0);
  const remainingTime = totalEstimatedTime - completedTime;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Tasks
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tasks.filter(t => t.status !== 'completed').length} tasks · 
              {remainingTime > 0 && ` ${formatEstimate(remainingTime)} remaining`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => router.push('/tasks')}
            className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
          >
            View All
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Time Summary Cards - Only show if there are time estimates */}
      {totalEstimatedTime > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs text-blue-600 dark:text-blue-400">Total Time</p>
            <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
              {formatEstimate(totalEstimatedTime)}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">
              {formatEstimate(completedTime)}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <p className="text-xs text-purple-600 dark:text-purple-400">Remaining</p>
            <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
              {formatEstimate(remainingTime)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tasks.slice(0, limit).map((task) => {
          const urgency = getTaskUrgency(task);
          const timeProgress = getTimeProgress(task);
          const timeEstimate = formatEstimate(task.totalEstimateMinutes || 0);
          
          return (
            <div 
              key={task.id}
              onClick={() => handleTaskClick(task.id)}
              className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                urgency === 'overdue'
                  ? 'border-red-300 dark:border-red-700 bg-red-50/70 dark:bg-red-900/20'
                  : urgency === 'urgent' 
                  ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' 
                  : urgency === 'soon'
                  ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      {task.aiGenerated && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          AI
                        </span>
                      )}
                    </div>
                    
                    {urgency === 'overdue' && (
                      <span className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>Needs attention</span>
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    {task.title}
                  </h3>
                  
                  {/* Progress bars */}
                  <div className="space-y-2 mb-3">
                    {/* Subtask progress */}
                    {task.totalSubtasks > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Time progress - Only show if there are time estimates */}
                    {timeProgress !== null && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Time spent</span>
                          <span>{formatEstimate(task.completedEstimateMinutes || 0)} / {timeEstimate}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${timeProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>Created {formatDate(task.createdAt)}</span>
                      </div>
                      
                      {task.totalSubtasks > 0 && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                          {task.completedSubtasks === task.totalSubtasks ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                          <span>{task.completedSubtasks}/{task.totalSubtasks}</span>
                        </div>
                      )}
                      
                      {/* Time estimate badge */}
                      {timeEstimate && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                          <Timer className="w-4 h-4" />
                          <span>{timeEstimate}</span>
                        </div>
                      )}
                    </div>
                    
                    <button 
                      onClick={(e) => handleViewDetails(task.id, e)}
                      className="px-3 py-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
                    >
                      View Details
                    </button>
                  </div>

                  {/* Show assignment info */}
                  {task.assignedTo && task.assignedTo.name && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Assigned to: {task.assignedTo.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Suggestions */}
      {aiRecommendation && (
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 rounded-lg border border-blue-100 dark:border-blue-900">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">AI Recommendation</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {aiRecommendation.message}
              </p>
              <button 
                onClick={() => handleQuickAction(aiRecommendation.action)}
                className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                {aiRecommendation.action} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No active tasks</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You don't have any tasks in progress. Create a new task to get started!
          </p>
          <button 
            onClick={() => router.push('/tasks/new')}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Create Your First Task
          </button>
        </div>
      )}
    </div>
  );
};

export default UpcomingTasks;