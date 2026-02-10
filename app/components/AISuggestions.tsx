// app/components/tasks/AISuggestions.tsx
'use client';

import { useState } from 'react';
import { Brain, Lightbulb, TrendingUp, Clock, Sparkles } from 'lucide-react';

interface AISuggestionsProps {
  userId: string;
}

type SuggestionType = 'optimization' | 'warning' | 'insight' | 'suggestion';

interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  action?: string;
  impact: 'high' | 'medium' | 'low';
}

export default function AISuggestions({ userId }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      id: '1',
      type: 'optimization',
      title: 'Batch Similar Tasks',
      description: 'Group 4 admin tasks to save 1.5 hours',
      action: 'View grouping',
      impact: 'high'
    },
    {
      id: '2',
      type: 'warning',
      title: 'Upcoming Deadline',
      description: 'Project review due in 2 days',
      action: 'Set reminder',
      impact: 'high'
    },
    {
      id: '3',
      type: 'insight',
      title: 'Productivity Pattern',
      description: 'You complete most tasks between 9-11 AM',
      action: 'Schedule focus time',
      impact: 'medium'
    },
    {
      id: '4',
      type: 'suggestion',
      title: 'Delegate Opportunity',
      description: '3 low-priority tasks could be delegated',
      action: 'Assign tasks',
      impact: 'medium'
    }
  ]);

  const getIcon = (type: SuggestionType) => {
    switch (type) {
      case 'optimization': return <TrendingUp className="w-4 h-4" />;
      case 'warning': return <Clock className="w-4 h-4" />;
      case 'insight': return <Lightbulb className="w-4 h-4" />;
      case 'suggestion': return <Sparkles className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: SuggestionType) => {
    switch (type) {
      case 'optimization': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'warning': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'insight': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'suggestion': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    }
  };

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-xl shadow-sm p-6 text-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-white/10">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Suggestions</h2>
            <p className="text-sm text-gray-300">Powered by AI</p>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        </div>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion) => (
          <div 
            key={suggestion.id}
            className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded ${getTypeColor(suggestion.type)}`}>
                  {getIcon(suggestion.type)}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{suggestion.title}</span>
                  <div className={`w-2 h-2 rounded-full ${getImpactColor(suggestion.impact)}`} />
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-300 mb-3">
              {suggestion.description}
            </p>
            
            {suggestion.action && (
              <button className="text-sm text-blue-300 hover:text-blue-200 font-medium group-hover:underline">
                {suggestion.action} →
              </button>
            )}
          </div>
        ))}
      </div>

      <button className="w-full mt-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2">
        <Sparkles className="w-4 h-4" />
        <span>Generate More Insights</span>
      </button>
    </div>
  );
}