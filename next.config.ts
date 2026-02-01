// next.config.ts - With absolute path
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Use absolute path for Turbopack root
  turbopack: {
    root: path.resolve(__dirname), // Absolute path to project
  },
  
  reactStrictMode: process.env.NODE_ENV === 'production',
};

export default nextConfig;