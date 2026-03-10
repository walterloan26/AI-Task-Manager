"use client";

interface AchievementBadgesClientProps {
  achievements: Array<{ id: string; name: string; icon: string; earned: boolean }>;
}

export function AchievementBadgesClient({ achievements }: AchievementBadgesClientProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {achievements.map(achievement => (
        <div 
          key={achievement.id}
          className={`text-center p-2 rounded-lg ${
            achievement.earned ? 'bg-yellow-100' : 'bg-gray-100 opacity-50'
          }`}
        >
          <div className="text-2xl mb-1">{achievement.icon}</div>
          <div className="text-xs font-medium">{achievement.name}</div>
        </div>
      ))}
    </div>
  );
}   