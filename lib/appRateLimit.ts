import { ratelimit } from "./rateLimit";

export async function rateLimitLoginAttempt(email: string): Promise<boolean> {
  try {
    // Create a key that rotates every minute
    const minuteWindow = Math.floor(Date.now() / 60000);
    const key = `login:${email}:${minuteWindow}`;
    
    const result = await ratelimit.limit(key);
    
    if (!result.success) {
      console.warn(`Login rate limit exceeded for: ${email}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Login rate limit error:", error);
    return true; // Always allow login if rate limiting fails
  }
}

// For API routes that need IP-based limiting
export async function rateLimitByIP(request: Request): Promise<boolean> {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               request.headers.get("x-real-ip") || 
               "anonymous";
    
    const key = `api:${ip}:${Math.floor(Date.now() / 60000)}`;
    const result = await ratelimit.limit(key);
    
    return result.success;
  } catch (error) {
    console.error("IP rate limit error:", error);
    return true; // Fail open - allow request
  }
}