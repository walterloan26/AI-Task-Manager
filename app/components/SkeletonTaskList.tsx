"use client";

export default function SkeletonTaskList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-full text-left px-4 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      ))}
    </div>
  );
}