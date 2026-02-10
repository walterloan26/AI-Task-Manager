// app/components/UserProfileCard.tsx
import { User, Settings, Bell, Zap } from 'lucide-react';

interface UserProfileCardProps {
  user: {
    name?: string;
    email?: string;
    image?: string;
    isActive: boolean;
  };
  isGoogleAccount: boolean;
}

const UserProfileCard = ({ user, isGoogleAccount }: UserProfileCardProps) => {
  const productivityScore = 78; // Mock data - calculate based on task completion
  
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          {user.image ? (
            <img 
              src={user.image} 
              alt={user.name || 'User'}
              className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center border-4 border-white dark:border-gray-800">
              <User className="w-8 h-8 text-white" />
            </div>
          )}
          
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user.name || user.email}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
            
            <div className="flex items-center space-x-2 mt-2">
              <span className={`px-2 py-1 text-xs rounded-full ${
                isGoogleAccount 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
              }`}>
                {isGoogleAccount ? 'Google Account' : 'Email Account'}
              </span>
              
              <span className={`px-2 py-1 text-xs rounded-full ${
                user.isActive 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <Bell className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
      
      {/* Productivity Score */}
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="font-medium text-gray-900 dark:text-white">Productivity Score</span>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{productivityScore}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full" 
            style={{ width: `${productivityScore}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Based on task completion, deadlines met, and efficiency
        </p>
      </div>
    </div>
  );
};

export default UserProfileCard;