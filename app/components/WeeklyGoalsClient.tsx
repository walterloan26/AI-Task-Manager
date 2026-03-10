"use client";

import { useState } from 'react';
import { CheckCircle, Circle } from 'lucide-react';

interface WeeklyGoalsClientProps {
  goals: Array<{ id: string; title: string; completed: boolean }>;
}

export function WeeklyGoalsClient({ goals: initialGoals }: WeeklyGoalsClientProps) {
  const [goals, setGoals] = useState(initialGoals);

  const toggleGoal = async (goalId: string) => {
    // Update locally
    setGoals(goals.map(goal => 
      goal.id === goalId ? { ...goal, completed: !goal.completed } : goal
    ));
    
    // Update on server
    await fetch(`/api/weekly-goals/${goalId}/toggle`, {
      method: 'POST'
    });
  };

  return (
    <div className="space-y-3">
      {goals.map(goal => (
        <div key={goal.id} className="flex items-center gap-3">
          <button onClick={() => toggleGoal(goal.id)}>
            {goal.completed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-gray-300" />
            )}
          </button>
          <span className={goal.completed ? 'line-through text-gray-400' : ''}>
            {goal.title}
          </span>
        </div>
      ))}
    </div>
  );
}