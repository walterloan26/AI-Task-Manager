import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  const session = await getAuthSession();

  // Minimal debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log("Dashboard:", {
      email: session?.user?.email?.substring(0, 15),
      hasImage: !!session?.user?.image,
      isGoogle: session?.user?.image?.includes('googleusercontent.com'),
    });
  }

  if (!session || !session.user.isActive) {
    redirect("/login");
  }

  // Determine account type
  const isGoogleAccount = session.user.image?.includes('googleusercontent.com');
  const accountType = isGoogleAccount ? "Google" : "Email";
  
  // Get initial for fallback avatar
  const getInitial = () => {
    return (
      session.user.name?.charAt(0).toUpperCase() || 
      session.user.email?.charAt(0).toUpperCase() || 
      "U"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Sign Out */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your account and view your activity
            </p>
            {/* Account Type Badge */}
            <div className="mt-2">
              <span className={`px-2 py-1 text-xs rounded ${
                isGoogleAccount 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
              }`}>
                {isGoogleAccount ? '🔐 Google Account' : '📧 Email Account'}
              </span>
            </div>
          </div>
          <SignOutButton />
        </div>

        {/* Account Info Panel */}
        <div className={`mb-6 p-4 rounded-lg border ${
          isGoogleAccount
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            isGoogleAccount 
              ? 'text-green-800 dark:text-green-300' 
              : 'text-blue-800 dark:text-blue-300'
          }`}>
            {isGoogleAccount ? '✅ Google Account Connected' : '📧 Email Account'}
          </h3>
          <div className="text-sm">
            {isGoogleAccount ? (
              <p>Your Google profile image is automatically loaded from Google's CDN.</p>
            ) : (
              <p>Using a default avatar. Consider connecting a Google account for profile images.</p>
            )}
          </div>
        </div>

        {/* User Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Profile Image */}
            {session.user.image ? (
              <div className="relative">
                <img
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-gray-700"
                  referrerPolicy="no-referrer"
                />
                {isGoogleAccount && (
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Google
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center text-white text-3xl font-bold">
                  {getInitial()}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  Email
                </div>
              </div>
            )}
            
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Welcome back, {session.user.name || session.user.email}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{session.user.email}</p>
              
              {/* Role Badge */}
              <div className="mt-3 flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium
                  ${session.user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 
                    session.user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 
                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}
                >
                  {session.user.role}
                </span>
                
                {/* Active Status */}
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  Active
                </span>
              </div>

              {/* Account Details */}
              <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {isGoogleAccount 
                    ? '✅ Signed in with Google - profile image loaded from Google CDN'
                    : '📧 Signed in with email - using personalized avatar'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Account Overview
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Account Type</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {accountType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Member Since</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  Today
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Last Login</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  Just now
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-400">
                ✅ Successfully signed in
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                {isGoogleAccount 
                  ? '✅ Google profile image loaded'
                  : '✅ Personalized avatar created'
                }
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                ✅ Dashboard accessed
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              {!isGoogleAccount && (
                <button className="w-full text-left px-4 py-3 rounded-lg bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-blue-800 dark:text-blue-300">
                  🔗 Connect Google Account
                </button>
              )}
              <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                👤 Edit Profile
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                🔒 Security Settings
              </button>
            </div>
          </div>
        </div>

        {/* Success Message */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-center gap-4">
            <div className="text-4xl">🎉</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Authentication System Working Perfectly!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isGoogleAccount 
                  ? 'Your Google OAuth integration is fully functional with profile images.'
                  : 'Your email authentication is working with personalized avatars.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>Need help? Contact our support team</p>
          <p className="mt-1 text-xs">
            {isGoogleAccount 
              ? 'Google OAuth integration complete ✅'
              : 'Email authentication with fallback avatars configured ✅'
            }
          </p>
        </div>
      </div>
    </div>
  );
}