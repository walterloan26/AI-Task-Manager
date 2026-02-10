// app/components/tasks/QuickAddPanel.tsx
'use client';

import { useState } from 'react';
import { Plus, Zap, Calendar, Tag } from 'lucide-react';

interface QuickAddPanelProps {
  userId: string;
}

export default function QuickAddPanel({ userId }: QuickAddPanelProps) {
  const [quickTask, setQuickTask] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickAdd = async () => {
    if (!quickTask.trim()) return;
    
    setIsAdding(true);
    try {
      const response = await fetch('/api/subtasks/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: quickTask })
      });
      
      if (response.ok) {
        setQuickTask('');
        // Refresh the page or trigger a callback
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const quickTemplates = [
    { text: 'Follow up with team about project status', emoji: '👥' },
    { text: 'Review and respond to emails', emoji: '📧' },
    { text: 'Plan tomorrow\'s schedule', emoji: '📅' },
    { text: 'Research new productivity tools', emoji: '🔍' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Quick Add
        </h2>
        <Zap className="w-5 h-5 text-yellow-500" />
      </div>

      {/* Quick Input */}
      <div className="mb-4">
        <textarea
          value={quickTask}
          onChange={(e) => setQuickTask(e.target.value)}
          placeholder="Add a quick task..."
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                    placeholder-gray-500 dark:placeholder-gray-400 resize-none"
          rows={2}
          disabled={isAdding}
        />
        
        <button
          onClick={handleQuickAdd}
          disabled={!quickTask.trim() || isAdding}
          className={`w-full mt-3 rounded-lg py-2.5 text-sm font-medium transition-all ${
            !quickTask.trim() || isAdding
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 active:scale-[0.98]"
          }`}
        >
          {isAdding ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Adding...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </div>
          )}
        </button>
      </div>

      {/* Quick Templates */}
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <Tag className="w-4 h-4 mr-2" />
          <span>Quick templates:</span>
        </div>
        
        <div className="space-y-2">
          {quickTemplates.map((template, index) => (
            <button
              key={index}
              onClick={() => setQuickTask(template.text)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 
                        hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 
                        transition-colors group"
            >
              <div className="flex items-center">
                <span className="text-lg mr-3">{template.emoji}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {template.text}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="grid grid-cols-2 gap-3">
          <button className="flex flex-col items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 
                           hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 
                           transition-colors group">
            <Calendar className="w-5 h-5 text-green-500 mb-2" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Schedule</span>
          </button>
          
          <button className="flex flex-col items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 
                           hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 
                           transition-colors group">
            <svg className="w-5 h-5 text-purple-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Breakdown</span>
          </button>
        </div>
      </div>
    </div>
  );
}