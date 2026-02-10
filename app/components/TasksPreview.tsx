// app/components/TasksPreview.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle, Clock, ArrowRight, Plus, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  task: string;
  createdAt: string;
  updatedAt?: string;
  subtasks: Array<{
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
    estimateMinutes?: number;
    orderIndex?: number;
  }>;
}

interface TasksPreviewProps {
  userId: string;
  limit?: number;
}

export default function TasksPreview({ userId, limit = 3 }: TasksPreviewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [userId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/subtasks/breakdown');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Tasks API response:', data); // For debugging
      
      // Your API might return data in different formats
      let tasksData: Task[] = [];
      
      if (Array.isArray(data.tasks)) {
        tasksData = data.tasks;
      } else if (Array.isArray(data.data)) {
        tasksData = data.data;
      } else if (Array.isArray(data)) {
        tasksData = data;
      }
      
      // Ensure each task has subtasks array
      const tasksWithSubtasks = tasksData.map((task: any) => ({
        ...task,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
      }));
      
      // Sort by most recent first
      const sortedTasks = tasksWithSubtasks.sort((a: Task, b: Task) => 
        new Date(b.createdAt || b.updatedAt || 0).getTime() - 
        new Date(a.createdAt || a.updatedAt || 0).getTime()
      );
      
      setTasks(sortedTasks.slice(0, limit));
      
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      // Fallback to mock data for development
      setTasks(getMockTasks());
    } finally {
      setLoading(false);
    }
  };

  const getCompletedCount = (task: Task) => {
    return task.subtasks.filter(st => st.completed).length;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
        <div className="flex items-center text-red-800 dark:text-red-300 mb-2">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">Error loading tasks</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          onClick={fetchTasks}
          className="text-sm px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Plus className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">No tasks yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs mx-auto">
          Start by breaking down your first task with AI
        </p>
        <Link
          href="/" // Points to your main task board
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Task
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const completedCount = getCompletedCount(task);
        const totalCount = task.subtasks.length;
        const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
        const hasHighPriority = task.subtasks.some(st => 
          st.priority?.toUpperCase() === 'HIGH'
        );
        const hasUrgent = task.subtasks.some(st => 
          st.priority?.toUpperCase() === 'HIGH' && !st.completed
        );

        return (
          <Link
            key={task.id}
            href={`/?task=${task.id}`} // Link to main page with task ID
            className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-300 truncate">
                  {task.task}
                </h3>
                <div className="flex items-center mt-1 space-x-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {totalCount} subtasks • {completedCount} completed
                  </span>
                  {task.createdAt && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(task.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-1 ml-2">
                {hasUrgent && (
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                    Urgent
                  </span>
                )}
                {hasHighPriority && !hasUrgent && (
                  <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                    High Priority
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress >= 100 
                        ? 'bg-green-500' 
                        : progress >= 50 
                        ? 'bg-blue-500' 
                        : 'bg-yellow-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Subtask preview */}
            {task.subtasks.length > 0 && (
              <div className="mt-3 space-y-1">
                {task.subtasks.slice(0, 2).map((subtask) => (
                  <div key={subtask.id} className="flex items-center text-sm">
                    {subtask.completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                    )}
                    <span className={`truncate ${subtask.completed ? 'text-gray-500 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                      {subtask.title || 'Untitled subtask'}
                    </span>
                    {subtask.priority && subtask.priority !== 'MEDIUM' && (
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${getPriorityColor(subtask.priority)}`}>
                        {subtask.priority}
                      </span>
                    )}
                  </div>
                ))}
                
                {task.subtasks.length > 2 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 pt-1">
                    + {task.subtasks.length - 2} more subtasks
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Click to view details
              </span>
              <span className="text-xs text-purple-600 dark:text-purple-400 group-hover:underline flex items-center">
                Open <ArrowRight className="w-3 h-3 ml-1" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Fallback mock data
function getMockTasks(): Task[] {
  return [
    {
      id: 'mock-1',
      task: 'Complete project documentation',
      createdAt: new Date().toISOString(),
      subtasks: [
        { id: '1-1', title: 'Write API documentation', completed: true, priority: 'HIGH' },
        { id: '1-2', title: 'Create user guides', completed: false, priority: 'MEDIUM' },
        { id: '1-3', title: 'Update README', completed: false, priority: 'LOW' },
      ],
    },
    {
      id: 'mock-2',
      task: 'Prepare quarterly presentation',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      subtasks: [
        { id: '2-1', title: 'Collect performance data', completed: true, priority: 'HIGH' },
        { id: '2-2', title: 'Create slides', completed: true, priority: 'HIGH' },
        { id: '2-3', title: 'Practice presentation', completed: false, priority: 'MEDIUM' },
      ],
    },
  ];
}