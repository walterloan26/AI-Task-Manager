"use client";

import { motion } from "framer-motion";

export default function SkeletonSubtaskCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3"
    >
      {/* Title skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="relative w-full flex items-center gap-2">
          <div className="w-3/4 h-5 bg-gray-200 rounded animate-pulse" />
          <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Priority skeleton */}
      <div className="flex items-center gap-2 pt-1">
        <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>

      {/* Description skeleton */}
      <div className="space-y-2">
        <div className="w-full h-3 bg-gray-200 rounded animate-pulse" />
        <div className="w-2/3 h-3 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Footer skeleton with divider */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between">
          {/* Time input skeleton */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-8 bg-gray-200 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-gray-200 rounded-lg animate-pulse" />
          </div>

          {/* Delete button skeleton */}
          <div className="w-16 h-8 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}