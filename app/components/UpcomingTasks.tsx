// app/components/UpcomingTasks.tsx
import { Calendar, Clock, Flag, MoreVertical } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  project?: string;
  estimatedDuration?: number; // in minutes
}

interface UpcomingTasksProps {
  userId: string;
  limit?: number;
}

const UpcomingTasks = ({ userId, limit = 5 }: UpcomingTasksProps) => {
  // Mock data - Replace with actual API call
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Finalize project proposal',
      description: 'Review and submit the Q4 project proposal',
      dueDate: new Date(Date.now() + 86400000), // Tomorrow
      priority: 'high',
      status: 'in-progress',
      project: 'Project Alpha',
      estimatedDuration: 120,
    },
    {
      id: '2',
      title: 'Team meeting preparation',
      description: 'Prepare slides for Monday team sync',
      dueDate: new Date(Date.now() + 172800000), // 2 days
      priority: 'medium',
      status: 'pending',
      project: 'Internal',
      estimatedDuration: 60,
    },
    {
      id: '3',
      title: 'Client presentation',
      description: 'Demo new features to client',
      dueDate: new Date(Date.now() + 259200000), // 3 days
      priority: 'high',
      status: 'pending',
      project: 'Client XYZ',
      estimatedDuration: 90,
    },
    {
      id: '4',
      title: 'Code review',
      description: 'Review PR #245 from dev team',
      dueDate: new Date(Date.now() + 345600000), // 4 days
      priority: 'medium',
      status: 'pending',
      project: 'Development',
      estimatedDuration: 45,
    },
    {
      id: '5',
      title: 'Update documentation',
      description: 'Update API documentation for new endpoints',
      dueDate: new Date(Date.now() + 432000000), // 5 days
      priority: 'low',
      status: 'pending',
      estimatedDuration: 30,
    },
  ];

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

  const formatDueDate = (date: Date) => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dueDate = new Date(date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getUrgency = (task: Task) => {
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1 && task.priority === 'high') return 'urgent';
    if (diffDays <= 3 && task.priority === 'high') return 'soon';
    return 'normal';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Upcoming Tasks
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mockTasks.filter(t => t.status !== 'completed').length} tasks pending
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors">
            View All
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {mockTasks.slice(0, limit).map((task) => {
          const urgency = getUrgency(task);
          
          return (
            <div 
              key={task.id}
              className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                urgency === 'urgent' 
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
                    </div>
                    
                    {urgency === 'urgent' && (
                      <span className="flex items-center space-x-1 text-xs text-red-600 dark:text-red-400">
                        <Clock className="w-3 h-3" />
                        <span>Urgent</span>
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    {task.title}
                  </h3>
                  
                  {task.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDueDate(task.dueDate)}</span>
                      </div>
                      
                      {task.project && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                          <Flag className="w-4 h-4" />
                          <span>{task.project}</span>
                        </div>
                      )}
                      
                      {task.estimatedDuration && (
                        <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>{task.estimatedDuration}m</span>
                        </div>
                      )}
                    </div>
                    
                    <button className="px-3 py-1 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Suggestions for Upcoming Tasks */}
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
              Start with the "Finalize project proposal" task first. It's high priority and due tomorrow. 
              I suggest allocating 2 hours in the morning when you're most productive.
            </p>
            <button className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
              Get personalized schedule →
            </button>
          </div>
        </div>
      </div>

      {/* Empty State (uncomment if needed) */}
      {/* {mockTasks.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No upcoming tasks</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You're all caught up! Create new tasks to see them here.
          </p>
          <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity">
            Create Your First Task
          </button>
        </div>
      )} */}
    </div>
  );
};

export default UpcomingTasks;