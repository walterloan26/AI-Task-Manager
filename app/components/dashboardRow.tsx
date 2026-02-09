// app/dashboard/components/DashboardRow.tsx
export function DashboardRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        <span className="text-lg">{icon}</span>
      </div>
      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
    </div>
  );
}
