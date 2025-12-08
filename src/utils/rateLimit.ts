// Simple in-memory rate limiter
// For production, consider using Redis or a database

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check if a user has exceeded their rate limit
 * @param userId - The user's ID
 * @param limit - Maximum number of requests allowed in the window (default: 10)
 * @param windowMs - Time window in milliseconds (default: 1 hour)
 * @returns Rate limit result
 */
export function checkRateLimit(
  userId: string,
  limit: number = 10,
  windowMs: number = 60 * 60 * 1000 // 1 hour
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(userId, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime,
    };
  }

  // Check if limit is exceeded
  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(userId, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for a specific user (useful for testing or admin overrides)
 */
export function resetRateLimit(userId: string): void {
  rateLimitStore.delete(userId);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(userId: string, limit: number = 10): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    return {
      allowed: true,
      remaining: limit,
      resetTime: now + 60 * 60 * 1000,
    };
  }

  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = entry.count >= limit ? Math.ceil((entry.resetTime - now) / 1000) : undefined;

  return {
    allowed: entry.count < limit,
    remaining,
    resetTime: entry.resetTime,
    retryAfter,
  };
}
