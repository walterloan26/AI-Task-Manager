import { NextResponse } from "next/server";
import { ratelimit, getClientIdentifier } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const identifier = getClientIdentifier(request);
  
  try {
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
    
    return NextResponse.json({
      status: "success",
      message: "Rate limiting test",
      data: {
        identifier,
        rateLimit: {
          success,
          limit,
          remaining,
          reset: new Date(reset).toISOString(),
        },
        environment: {
          hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
          hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: "Rate limiting test failed",
      error: error instanceof Error ? error.message : String(error),
      environment: {
        hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      }
    }, { status: 500 });
  }
}