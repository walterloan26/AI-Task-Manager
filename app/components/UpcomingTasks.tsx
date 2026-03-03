// app/components/UpcomingTasks.tsx
"use client";

import { Calendar, Clock, Flag, MoreVertical, CheckCircle, Circle, Timer, Shield, Users, X } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clientEvents } from '@/lib/events/clientEvents';
import TaskDetailsModal from './TaskDetailsModal';

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
  totalEstimateMinutes?: number;
  completedEstimateMinutes?: number;
  owner?: { name: string; email: string };
  createdBy?: { name: string; email: string };
  assignedTo?: { name: string; email: string };
  userId?: string;
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
  userRole?: string;
}

const UpcomingTasks = ({ 
  userId, 
  limit = 5,
  userRole = 'USER'
}: UpcomingTasksProps) => {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('Just now');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [removingTaskIds, setRemovingTaskIds] = useState<Set<string>>(new Set());
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [completedTaskTitle, setCompletedTaskTitle] = useState('');
  const [notificationQueue, setNotificationQueue] = useState<Array<{taskId: string, taskName: string}>>([]);
  
  // Use ref to track if component is mounted
  const isMounted = useRef(true);
  const notificationTimeoutRef = useRef<NodeJS.Timeout>();
  const prevTasksRef = useRef<Task[]>([]);
  const notifiedCompletedTasksRef = useRef<Set<string>>(new Set()); // Changed from state to ref

  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER' || isAdmin;

  // Process notification queue
  useEffect(() => {
    console.log('🔔 Queue processor - State:', {
      notificationQueueLength: notificationQueue.length,
      showCompletionMessage,
      currentTask: notificationQueue[0]
    });

    if (notificationQueue.length > 0 && !showCompletionMessage) {
      const nextNotification = notificationQueue[0];
      console.log('🔔 Showing notification for:', nextNotification);

      setCompletedTaskTitle(nextNotification.taskName);
      setShowCompletionMessage(true);
      setRemovingTaskIds(prev => new Set([...prev, nextNotification.taskId]));

      // Clear previous timeout
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      // Set timeout to hide notification
      notificationTimeoutRef.current = setTimeout(() => {
        if (isMounted.current) {
          setShowCompletionMessage(false);
          setNotificationQueue(prev => prev.slice(1));
          setRemovingTaskIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(nextNotification.taskId);
            return newSet;
          });
        }
      }, 4000); // Back to 4 seconds
    }
  }, [notificationQueue, showCompletionMessage]);

  // Memoize fetch function to prevent unnecessary recreations
  const fetchUpcomingTasks = useCallback(async () => {
  if (!isMounted.current) return null;
  
  try {
    setLoading(true);
    const timestamp = Date.now();
    const url = `/api/tasks/upcoming?limit=${limit}&userId=${userId}&role=${userRole}&_=${timestamp}`;

    console.log('📋 Fetching tasks from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }

    const data = await response.json();
    
    const tasksWithTime = data.tasks.map((task: any) => {
      const totalEstimateMinutes = task.subtasks?.reduce(
        (sum: number, st: Subtask) => sum + (st.estimateMinutes || 0), 
        0
      ) || 0;
      const completedEstimateMinutes = task.subtasks
        ?.filter((st: Subtask) => st.completed)
        .reduce((sum: number, st: Subtask) => sum + (st.estimateMinutes || 0), 0) || 0;
      
      return {
        ...task,
        totalEstimateMinutes,
        completedEstimateMinutes
      };
    });
    
    if (isMounted.current) {
      const previousTasks = prevTasksRef.current;
      
      // DEBUG: Log all previous tasks
      console.log('📋 PREVIOUS TASKS:', previousTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        completedSubtasks: t.completedSubtasks,
        totalSubtasks: t.totalSubtasks
      })));
      
      // DEBUG: Log all new tasks
      console.log('📋 NEW TASKS:', tasksWithTime.map((t: Task) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        completedSubtasks: t.completedSubtasks,
        totalSubtasks: t.totalSubtasks
      })));
      
      // Find tasks that were in previous tasks but are NOT in new tasks
      const missingTaskIds = new Set(
        previousTasks
          .filter(oldTask => !tasksWithTime.some(newTask => newTask.id === oldTask.id))
          .map(task => task.id)
      );
      
      console.log('🔍 MISSING TASK IDs:', Array.from(missingTaskIds));
      
      // Get the full task objects for missing tasks
      const missingTasks = previousTasks.filter(t => missingTaskIds.has(t.id));
      
      console.log('🔍 MISSING TASKS DETAILS:', missingTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        completedSubtasks: t.completedSubtasks,
        totalSubtasks: t.totalSubtasks
      })));
      
      // Only consider tasks that were in progress or pending
      const candidateTasks = missingTasks.filter(t => {
        // If it was in-progress or pending, definitely consider it
        if (t.status === 'in-progress' || t.status === 'pending') {
          console.log(`✅ Task "${t.title}" is candidate (status: ${t.status})`);
          return true;
        }
        
        // Also consider tasks that have all subtasks completed, even if status is something else
        const allSubtasksCompleted = t.totalSubtasks > 0 && t.completedSubtasks === t.totalSubtasks;
        if (allSubtasksCompleted) {
          console.log(`✅ Task "${t.title}" is candidate (all subtasks completed: ${t.completedSubtasks}/${t.totalSubtasks})`);
          return true;
        }
        
        // If progress is 100%, also consider it
        if (t.progress === 100) {
          console.log(`✅ Task "${t.title}" is candidate (progress: 100%)`);
          return true;
        }
        
        console.log(`❌ Task "${t.title}" is NOT a candidate (status: ${t.status}, progress: ${t.progress}, subtasks: ${t.completedSubtasks}/${t.totalSubtasks})`);
        return false;
      });
      
      console.log('🎯 CANDIDATE TASKS (in-progress/pending):', candidateTasks.map(t => ({
        title: t.title,
        status: t.status
      })));

      // After missingTasks, add this log
      missingTasks.forEach(t => {
        console.log(`📊 MISSING TASK "${t.title}" HAS STATUS: "${t.status}"`);
      });
      
      // Check which ones haven't been notified
      const notNotifiedTasks = candidateTasks.filter(t => 
        !notifiedCompletedTasksRef.current.has(t.id)
      );
      
      console.log('✅ NOT NOTIFIED YET:', notNotifiedTasks.map(t => t.title));
      console.log('✅ CURRENT NOTIFIED SET:', Array.from(notifiedCompletedTasksRef.current));
      
      // Add to notification queue
      if (notNotifiedTasks.length > 0) {
        console.log('🎉 FOUND COMPLETED TASKS TO NOTIFY:', notNotifiedTasks.map(t => t.title));
        notNotifiedTasks.forEach((task: Task) => {
          console.log('➕ Adding to notification queue:', task.title);
          notifiedCompletedTasksRef.current.add(task.id);
          setNotificationQueue(prev => [...prev, {
            taskId: task.id,
            taskName: task.title
          }]);
        });
      } else {
        console.log('❌ NO COMPLETED TASKS DETECTED');
      }

      setTasks(tasksWithTime);
      prevTasksRef.current = tasksWithTime;
      setAiRecommendation(data.aiRecommendation);
      setError(null);
      
      const now = new Date();
      setLastUpdate(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    return { tasks: tasksWithTime, aiRecommendation: data.aiRecommendation };
  } catch (err) {
    console.error('Error fetching upcoming tasks:', err);
    if (isMounted.current) {
      setError('Failed to load upcoming tasks');
    }
    return null;
  } finally {
    if (isMounted.current) {
      setLoading(false);
    }
  }
}, [userId, limit, userRole]);

  useEffect(() => {
  isMounted.current = true;
  notifiedCompletedTasksRef.current = new Set();
  console.log('📋 UpcomingTasks mounted with:', { userId, userRole, isAdmin, isManager });
  fetchUpcomingTasks();
  
  const handleTaskUpdate = () => {
    console.log('📋 UpcomingTasks: Event received → refreshing tasks');
    setLastUpdate('Updating...');
    fetchUpcomingTasks();
  };

  // Only handle task:completed events if they come through
  const handleTaskCompleted = (data: { taskId: string; taskName: string }) => {
    console.log('🎉 Task completed event received:', data);
    
    if (!notifiedCompletedTasksRef.current.has(data.taskId)) {
      notifiedCompletedTasksRef.current.add(data.taskId);
      setNotificationQueue(prev => [...prev, data]);
    }
  };

  // Test notification from console
  const testNotification = () => {
    console.log('🔔 Test notification triggered from console');
    const testData = { 
      taskId: 'test-' + Date.now(), 
      taskName: 'Test Task from Console' 
    };
    handleTaskCompleted(testData);
  };

  // Subscribe to events
  clientEvents.on('task:created', handleTaskUpdate);
  clientEvents.on('task:deleted', handleTaskUpdate);
  clientEvents.on('task:updated', handleTaskUpdate);
  clientEvents.on('task:completed', handleTaskCompleted); // Keep this in case events start working
  
  // For testing in browser console
  window.addEventListener('test-notification', testNotification);
  (window as any).showTestNotification = testNotification;

  // POLLING - Check every 3 seconds (this is your main notification source)
  const pollInterval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      console.log('📋 UpcomingTasks: Polling for updates');
      fetchUpcomingTasks();
    }
  }, 3000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('📋 UpcomingTasks: Tab became visible, refreshing');
      fetchUpcomingTasks();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    isMounted.current = false;
    clearInterval(pollInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('test-notification', testNotification);
    delete (window as any).showTestNotification;
    
    clientEvents.off('task:created', handleTaskUpdate);
    clientEvents.off('task:deleted', handleTaskUpdate);
    clientEvents.off('task:updated', handleTaskUpdate);
    clientEvents.off('task:completed', handleTaskCompleted);
    
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
  };
}, [userId, limit, userRole, fetchUpcomingTasks]);;


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
    
    // Set both dates to midnight for accurate day comparison
    now.setHours(0, 0, 0, 0);
    taskDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));

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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleViewDetails = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleQuickAction = (action: string) => {
    if (action === 'Create Task') {
      router.push('/tasks/new');
    } else if (action === 'View Task' || action === 'Continue' || action === 'Begin') {
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

  // Filter tasks based on role and exclude completed tasks
  const filteredTasks = tasks
    .filter(task => task.status !== 'completed')
    .slice(0, limit);

  const activeTasksCount = filteredTasks.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 relative">
      {/* Test button - Only shows in development */}
      {process.env.NODE_ENV === 'development' && (
        <button 
        onClick={() => {
          // Create a test notification that uses the same handler as real ones
          const testData = { 
            taskId: 'test-' + Date.now(), 
            taskName: 'Test Task' 
          };
          console.log('🔔 Test button clicked', testData);
          
          // Add to notification queue directly
          setNotificationQueue(prev => [...prev, testData]);
          
          // Also trigger a refresh
          fetchUpcomingTasks();
        }}
        className="mb-4 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 transition-colors"
      >
        Test Notification
      </button>
      )}

      {/* Bottom-right corner notification - SUPER PROMINENT */}
      {/* Debug info - remove later */}
      <div className="fixed top-4 right-4 z-[10000] bg-black text-white p-4 rounded-lg">
        <p>showCompletionMessage: {showCompletionMessage ? 'true' : 'false'}</p>
        <p>completedTaskTitle: {completedTaskTitle || 'none'}</p>
        <p>notificationQueue length: {notificationQueue.length}</p>
      </div>
      {showCompletionMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
          <div className="bg-gradient-to-r from-green-600 to-green-500 dark:from-green-700 dark:to-green-600 border-2 border-green-300 dark:border-green-500 rounded-xl shadow-2xl p-5 min-w-[350px] max-w-md transform hover:scale-105 transition-transform duration-200">
            <div className="flex items-center text-white">
              <div className="bg-white/30 rounded-full p-2 mr-4 flex-shrink-0 backdrop-blur-sm shadow-lg">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold flex items-center">
                  <span className="mr-2">🎉</span> Task Completed!
                </p>
                <p className="text-base text-white/95 mt-1 font-medium truncate">
                  "{completedTaskTitle}"
                </p>
                <p className="text-sm text-white/80 mt-1 flex items-center">
                  <span className="mr-1">✨</span> Great work! Keep it up!
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompletionMessage(false);
                }}
                className="ml-3 text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded-full p-2 flex-shrink-0 transition-all duration-200 shadow-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Progress bar animation */}
            <div className="mt-3 h-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full animate-shrink"></div>
            </div>
          </div>
        </div>
      )}

      {/* Admin/Manager badge */}
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
                  Viewing all users' active tasks
                </span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                You can see, edit, and delete any task in the system
              </p>
            </div>
          </div>
        </div>
      )}

      {isManager && !isAdmin && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white mr-2">
                  MANAGER VIEW
                </span>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Viewing team tasks
                </span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                You can view and manage tasks for users in your team
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isAdmin ? 'All Active Tasks' : isManager ? 'Team Active Tasks' : 'Your Active Tasks'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeTasksCount} task{activeTasksCount !== 1 ? 's' : ''} · 
              {remainingTime > 0 && ` ${formatEstimate(remainingTime)} remaining`}
              {loading ? ' • Updating...' : ` • Updated ${lastUpdate}`}
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
          <button 
            onClick={fetchUpcomingTasks}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
        {filteredTasks.map((task) => {
          const urgency = getTaskUrgency(task);
          const timeProgress = getTimeProgress(task);
          const timeEstimate = formatEstimate(task.totalEstimateMinutes || 0);
          
          return (
            <div 
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                removingTaskIds.has(task.id) ? 'animate-slide-out' : ''
              } ${
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
                          <span className="text-gray-400 dark:text-gray-500">
                            ({task.completedSubtasks}/{task.totalSubtasks})
                          </span>
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
                  
                  {/* Compact metadata row with button on the right - Using text-sm */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center flex-wrap gap-1.5">
                      {/* Created date badge */}
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-2 py-1 rounded-md">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(task.createdAt)}</span>
                      </div>
                      
                      {/* Subtasks count badge */}
                      {task.totalSubtasks > 0 && (
                        <div className={`flex items-center space-x-1 text-sm px-2 py-1 rounded-md ${
                          task.completedSubtasks === task.totalSubtasks 
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                            : 'bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400'
                        }`}>
                          {task.completedSubtasks === task.totalSubtasks ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Circle className="w-3.5 h-3.5" />
                          )}
                          <span>{task.completedSubtasks}/{task.totalSubtasks}</span>
                        </div>
                      )}
                      
                      {/* Time estimate badge */}
                      {timeEstimate && (
                        <div className="flex items-center space-x-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md">
                          <Timer className="w-3.5 h-3.5" />
                          <span>{timeEstimate}</span>
                        </div>
                      )}
                    </div>

                    {/* View Details button */}
                    <button 
                      onClick={(e) => handleViewDetails(task, e)}
                      className="px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors whitespace-nowrap"
                    >
                      View Details →
                    </button>
                  </div>

                  {/* Show assignment info - Inline with pure CSS wrapping */}
                  {(isManager || isAdmin) && (task.assignedTo?.name || task.createdBy?.name) && (
                    <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                      {task.assignedTo?.name && (
                        <div className="flex flex-wrap items-baseline gap-x-1">
                          <Users className="w-3 h-3 mr-1 flex-shrink-0 self-center" />
                          <div className="flex flex-wrap items-baseline gap-x-1 flex-1 min-w-0">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {task.assignedTo.name}
                            </span>
                            {task.assignedTo.email && (
                              <span className="text-gray-400 break-all">
                                ({task.assignedTo.email})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {task.createdBy?.name && task.createdBy.name !== task.assignedTo?.name && (
                        <div className="flex items-center text-gray-400 mt-1 ml-7">
                          <span>Created: {task.createdBy.name}</span>
                        </div>
                      )}
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

      {/* Empty State - Different messages based on role */}
      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isAdmin ? 'No active tasks in the system' : 
             isManager ? 'No active team tasks' : 
             'No active tasks'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {isAdmin ? 'The system has no tasks in progress at the moment.' :
             isManager ? 'Your team has no tasks in progress.' :
             "You don't have any tasks in progress. Create a new task to get started!"}
          </p>
          {!isAdmin && (
            <button 
              onClick={() => router.push('/tasks/new')}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              {isManager ? 'Assign New Task' : 'Create Your First Task'}
            </button>
          )}
        </div>
      )}
      <TaskDetailsModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTask(null);
        }}
        userRole={userRole}
        onTaskUpdate={fetchUpcomingTasks}
      />

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-slide-out {
          animation: slideOut 0.5s ease-in-out forwards;
        }
        .animate-shrink {
          animation: shrink 4s linear forwards;
        }
      `}</style>
    </div>
  );
};

export default UpcomingTasks;