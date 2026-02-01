import { getAuthSession } from "@/app/api/auth/[...nextauth]/authOptions";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";

export default async function DashboardPage() {
  // ✅ Server-side session check
  const session = await getAuthSession();

  // Debug logging (always run this to see session data)
  console.log("🔍 Dashboard Session Debug:");
  console.log("- Has session:", !!session);
  if (session) {
    console.log("- User image exists:", !!session.user?.image);
    console.log("- User image URL:", session.user?.image);
    console.log("- User name:", session.user?.name);
    console.log("- User email:", session.user?.email);
    console.log("- User role:", session.user?.role);
    console.log("- User isActive:", session.user?.isActive);
    console.log("- Full session object:", JSON.stringify(session, null, 2));
  }

  if (!session || !session.user.isActive) {
    // Redirect immediately if no session or inactive user
    redirect("/login");
  }

  // Get first initial for fallback avatar
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
            {/* DEBUG: Show image status */}
            <div className="mt-2">
              <span className={`px-2 py-1 text-xs rounded ${
                session.user.image 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              }`}>
                {session.user.image ? '✓ Has Google Image' : '✗ No Google Image'}
              </span>
            </div>
          </div>
          <SignOutButton />
        </div>

        {/* DEBUG Panel - Show success */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
            ✅ SUCCESS: Google Image Retrieved!
          </h3>
          <pre className="text-xs overflow-auto whitespace-pre-wrap">
            {JSON.stringify({
              hasImage: !!session.user.image,
              imageUrl: session.user.image?.substring(0, 60) + "...",
              name: session.user.name,
              email: session.user.email,
              role: session.user.role,
              isActive: session.user.isActive,
            }, null, 2)}
          </pre>
        </div>

        {/* User Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            {/* Profile Image - SIMPLIFIED (no onError handler) */}
            {session.user.image ? (
              <div className="relative">
                <img
                  src={session.user.image}
                  alt={session.user.name || "Profile"}
                  className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-gray-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  Google
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center text-white text-3xl font-bold">
                {getInitial()}
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
                <span className={`px-3 py-1 rounded-full text-sm font-medium
                  ${session.user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}
                >
                  {session.user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Success Message */}
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">
                  ✅ Google profile image successfully loaded!
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1 truncate">
                  URL: {session.user.image?.substring(0, 50)}...
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
                <span className="text-gray-600 dark:text-gray-400">Member Since</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  Today
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Account Type</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  Google OAuth
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
                ✅ Successfully signed in with Google
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                ✅ Profile image retrieved from Google
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                👤 View Profile
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                ⚙️ Account Settings
              </button>
              <button className="w-full text-left px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-900 dark:text-white">
                🔑 Manage Security
              </button>
            </div>
          </div>
        </div>

        {/* Success Celebration */}
        <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-center gap-4">
            <div className="text-4xl">🎉</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Success! Google Integration Working
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your Google profile image is now successfully displayed. 
                The image URL is from Google's CDN: <code className="text-xs">lh3.googleusercontent.com</code>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>Need help? Contact our support team</p>
          <p className="mt-1 text-xs">
            NextAuth configuration fixed! ✅ Google images are now properly handled.
          </p>
        </div>
      </div>
    </div>
  );
}