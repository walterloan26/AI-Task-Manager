// app/components/TaskDetailsModal.tsx
"use client";

import { X, Calendar, Clock, User, Flag, CheckCircle, Circle, Timer, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientEvents } from '@/lib/events/clientEvents';

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
  description?: string;
}

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  onTaskUpdate?: () => void;
}

const TaskDetailsModal = ({ 
  task, 
  isOpen, 
  onClose, 
  userRole = 'USER',
  onTaskUpdate 
}: TaskDetailsModalProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  if (!isOpen || !task) return null;

  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER' || isAdmin;
  const canEdit = isAdmin || isManager || task.userId === task.assignedTo?.name; // Adjust based on your auth logic

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
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatEstimate = (minutes: number) => {
    if (!minutes || minutes < 1) return 'No estimate';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} min` : `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const handleEdit = () => {
    router.push(`/tasks/${task.id}/edit`);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onTaskUpdate?.();
        clientEvents.emit('tasks:changed', { 
          taskId: task.id,
          timestamp: Date.now() 
        });
        onClose();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }), // Toggle the current state
      });
      
      if (response.ok) {
        onTaskUpdate?.();
        clientEvents.emit('tasks:changed', { 
          taskId: task.id,
          subtaskId,
          timestamp: Date.now() 
        });
      }
    } catch (error) {
      console.error('Error toggling subtask:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Task Details
              </h3>
              {task.aiGenerated && (
                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                  AI Generated · {task.aiConfidence}% confidence
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title and badges */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {task.title}
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 text-sm rounded-full ${getPriorityColor(task.priority)}`}>
                  <Flag className="w-3 h-3 inline mr-1" />
                  {task.priority} priority
                </span>
                <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <span className="px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  Complexity: {task.complexity}
                </span>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Description</h4>
                <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
                  {task.description}
                </p>
              </div>
            )}

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(task.createdAt)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(task.updatedAt)}
                  </p>
                </div>
              </div>

              {task.totalEstimateMinutes ? (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Timer className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Time Estimate</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatEstimate(task.totalEstimateMinutes)}
                    </p>
                  </div>
                </div>
              ) : null}

              {(isManager || isAdmin) && task.assignedTo && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Assigned To</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.assignedTo.name}
                      {task.assignedTo.email && (
                        <span className="text-xs text-gray-500 block">{task.assignedTo.email}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Subtasks ({task.completedSubtasks}/{task.totalSubtasks})
                  </h4>
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    {task.progress}% complete
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {task.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <button
                          onClick={() => handleToggleSubtask(subtask.id, subtask.completed)}
                          disabled={loading}
                          className="focus:outline-none"
                        >
                          {subtask.completed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <span className={`text-sm ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {subtask.title}
                        </span>
                      </div>
                      {subtask.estimateMinutes ? (
                        <span className="text-xs text-gray-500">
                          {formatEstimate(subtask.estimateMinutes)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {task.totalSubtasks > 0 && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500 dark:text-gray-400">Overall Progress</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    {task.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer with actions */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              {canEdit && (
                <>
                  <button
                    onClick={handleEdit}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors flex items-center"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Task
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;