"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800"
      >
        <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded-full" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="relative w-10 h-10 rounded-lg flex items-center justify-center 
                 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 
                 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 
                 dark:focus:ring-gray-100 focus:ring-offset-2"
    >
      <motion.div
        className="relative w-5 h-5"
        initial={false}
        animate={{
          rotate: isDark ? 40 : 0,
        }}
        transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
      >
        {/* Sun */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Sun rays */}
            <div className="absolute -inset-2">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-0.5 h-1.5 bg-amber-500 dark:bg-amber-400 rounded-full"
                  style={{
                    left: "50%",
                    top: "0%",
                    transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                    transformOrigin: "bottom center",
                  }}
                  animate={{
                    opacity: isDark ? 0 : 1,
                    scale: isDark ? 0 : 1,
                  }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                />
              ))}
            </div>
            
            {/* Sun center */}
            <motion.div
              className={`w-3 h-3 rounded-full ${
                isDark ? "bg-gray-400" : "bg-amber-500"
              }`}
              animate={{
                scale: isDark ? 0.8 : 1,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Moon */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={false}
          animate={{
            scale: isDark ? 1 : 0,
            opacity: isDark ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            {/* Moon craters */}
            <div className="absolute -inset-2">
              {[
                { top: "10%", left: "60%", size: "w-1 h-1" },
                { top: "40%", left: "30%", size: "w-0.5 h-0.5" },
                { top: "70%", left: "70%", size: "w-0.75 h-0.75" },
              ].map((crater, i) => (
                <div
                  key={i}
                  className={`absolute ${crater.size} rounded-full bg-gray-300 dark:bg-gray-500`}
                  style={{
                    top: crater.top,
                    left: crater.left,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}
            </div>
            
            {/* Moon body */}
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-200" />
          </div>
        </motion.div>
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 
                     bg-gray-900 dark:bg-gray-700 text-white text-xs py-1 px-2 
                     rounded opacity-0 group-hover:opacity-100 transition-opacity 
                     pointer-events-none whitespace-nowrap">
        {isDark ? "Switch to light" : "Switch to dark"}
      </div>
    </button>
  );
}