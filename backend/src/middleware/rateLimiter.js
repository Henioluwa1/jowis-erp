/**
 * In-memory sliding window rate limiter for security-sensitive endpoints (V-04)
 */

class MemoryRateLimiter {
  constructor(windowMs, maxRequests, message) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message || 'Too many requests. Please try again later.';
    this.hits = new Map();

    // Periodic cleanup of expired IP windows every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of this.hits.entries()) {
        const valid = timestamps.filter(t => now - t < this.windowMs);
        if (valid.length === 0) {
          this.hits.delete(ip);
        } else {
          this.hits.set(ip, valid);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      // Skip rate limiting during test executions
      if (process.env.NODE_ENV === 'test') {
        return next();
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
      const now = Date.now();

      const timestamps = this.hits.get(ip) || [];
      const windowStart = now - this.windowMs;
      const validTimestamps = timestamps.filter(t => t > windowStart);

      if (validTimestamps.length >= this.maxRequests) {
        const retryAfterSec = Math.ceil((validTimestamps[0] + this.windowMs - now) / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          success: false,
          message: this.message,
          retryAfterSeconds: retryAfterSec
        });
      }

      validTimestamps.push(now);
      this.hits.set(ip, validTimestamps);
      next();
    };
  }
}

// 1. Auth Limiter: Max 15 login attempts per 15 minutes per IP
export const authRateLimiter = new MemoryRateLimiter(
  15 * 60 * 1000,
  15,
  'Too many login attempts. For security reasons, please try again in 15 minutes.'
).middleware();

// 2. Public Certificate Verification Limiter: Max 60 queries per minute per IP
export const publicVerifyRateLimiter = new MemoryRateLimiter(
  60 * 1000,
  60,
  'Public certificate query limit exceeded. Please slow down your requests.'
).middleware();
