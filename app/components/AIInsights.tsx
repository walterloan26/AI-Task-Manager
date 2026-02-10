// app/components/AIInsights.tsx
import { Brain, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface AIInsight {
  type: 'suggestion' | 'warning' | 'optimization';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

const AIInsights = () => {
  const mockInsights: AIInsight[] = [
    {
      type: 'suggestion',
      title: 'Focus Block Recommended',
      description: 'AI suggests a 2-hour focus block for "Project Alpha" tasks tomorrow morning',
      priority: 'high'
    },
    {
      type: 'optimization',
      title: 'Task Batching Opportunity',
      description: 'Group 3 similar admin tasks to save 45 minutes',
      priority: 'medium'
    },
    {
      type: 'warning',
      title: 'Upcoming Deadline',
      description: '2 high-priority tasks due in next 48 hours',
      priority: 'high'
    }
  ];

  const getIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'suggestion': return <Brain className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'optimization': return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: AIInsight['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Insights
        </h2>
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Powered by AI</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {mockInsights.map((insight, index) => (
          <div key={index} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${getPriorityColor(insight.priority)}`}>
                  {getIcon(insight.type)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{insight.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{insight.description}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(insight.priority)}`}>
                {insight.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-4 p-3 text-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <span className="text-gray-600 dark:text-gray-400">Generate more insights</span>
      </button>
    </div>
  );
};

export default AIInsights;