// next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Use absolute path for Turbopack root
  turbopack: {
    root: path.resolve(__dirname),
  },
  
  reactStrictMode: process.env.NODE_ENV === 'production',
  
  // ✅ ADD THIS IMAGES CONFIGURATION
  images: {
    remotePatterns: [
      // Google profile images
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/a/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      // GitHub avatars
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // Placeholder/example services
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
      // Add your own domains here
    ],
  },
  
  // Optional: If you want to allow any image source (not recommended for production)
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: '**', // Allows ALL domains
  //     },
  //   ],
  // },
  
  // Optional: For better dev experience
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;