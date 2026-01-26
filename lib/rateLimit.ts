import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Check environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Create a mock rate limiter for development when Redis is not available
class MockRatelimit {
  async limit(identifier: string) {
    console.log(`[MockRatelimit] Rate limiting skipped for: ${identifier}`);
    return {
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000, // 1 minute from now
    };
  }
}

let ratelimitInstance;
let redisInstance;

try {
  if (redisUrl && redisToken) {
    console.log("🔗 Initializing Redis with URL:", redisUrl.substring(0, 30) + "...");
    redisInstance = Redis.fromEnv();
    ratelimitInstance = new Ratelimit({
      redis: redisInstance,
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
      prefix: "ratelimit",
    });
    console.log("✅ Redis rate limiter initialized successfully");
  } else {
    throw new Error("Redis environment variables not found");
  }
} catch (error) {
  console.warn("⚠️ Redis initialization failed, using mock rate limiter. Error:", error.message);
  console.log("📝 Please add to .env.local:");
  console.log("UPSTASH_REDIS_REST_URL=your-redis-url");
  console.log("UPSTASH_REDIS_REST_TOKEN=your-redis-token");
  
  ratelimitInstance = new MockRatelimit();
}

export const ratelimit = ratelimitInstance;

// Helper function
export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return "anonymous";
}