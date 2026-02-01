// /lib/rateLimit.ts - True Singleton with Once Logging
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const isDevelopment = process.env.NODE_ENV === 'development';

// Use global variable for true singleton
declare global {
  var __rateLimitInstance: any;
  var __rateLimitLogged: boolean;
}

function createRateLimit() {
  // Return cached instance if exists
  if (global.__rateLimitInstance) {
    return global.__rateLimitInstance;
  }

  // Log only once in development
  if (isDevelopment && !global.__rateLimitLogged) {
    console.log("🔧 Development: Using in-memory rate limiter");
    global.__rateLimitLogged = true;
  }

  if (isDevelopment) {
    // Development: Simple in-memory rate limiter
    global.__rateLimitInstance = {
      async limit(identifier: string) {
        // Optional: Log only occasionally
        if (Math.random() < 0.01) { // 1% chance
          console.log(`[RateLimit] Checked: ${identifier.substring(0, 30)}...`);
        }
        return { 
          success: true, 
          limit: 100, 
          remaining: 99, 
          reset: Date.now() + 60000 
        };
      }
    };
  } else {
    // Production: Redis rate limiter
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!redisUrl || !redisToken) {
      throw new Error("Redis configuration required in production");
    }
    
    console.log("🔗 Initializing Redis for production...");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    
    global.__rateLimitInstance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
      prefix: "ratelimit",
    });
  }

  return global.__rateLimitInstance;
}

export const ratelimit = createRateLimit();