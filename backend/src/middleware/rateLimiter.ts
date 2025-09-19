import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimitError } from './errorHandler';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  totalRequests: number;
}

export class RateLimiter {
  private redis: Redis;
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.options = {
      keyGenerator: (req: Request) => req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Rate limit exceeded',
      ...options,
    };
  }

  public middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = this.generateKey(req);
      const now = Date.now();
      const windowStart = now - this.options.windowMs;

      // Use Redis sorted set to track requests with timestamps
      const multi = this.redis.multi();

      // Remove old entries outside the current window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request timestamp
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiration for the key
      multi.expire(key, Math.ceil(this.options.windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis operation failed');
      }

      const currentRequests = results[1][1] as number;

      // Check if limit is exceeded
      if (currentRequests >= this.options.maxRequests) {
        // Remove the request we just added since it's over the limit
        await this.redis.zrem(key, `${now}-${Math.random()}`);

        const resetTime = new Date(now + this.options.windowMs);
        const remaining = 0;

        this.setRateLimitHeaders(res, {
          remaining,
          resetTime,
          totalRequests: currentRequests,
        });

        throw new RateLimitError(this.options.message);
      }

      // Calculate remaining requests and reset time
      const remaining = this.options.maxRequests - currentRequests - 1;
      const resetTime = new Date(now + this.options.windowMs);

      this.setRateLimitHeaders(res, {
        remaining,
        resetTime,
        totalRequests: currentRequests + 1,
      });

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        console.error('Rate limiter error:', error);
        // Don't block requests if rate limiter fails
        next();
      }
    }
  };

  private generateKey(req: Request): string {
    const identifier = this.options.keyGenerator(req);
    return `ratelimit:${identifier}:${this.options.windowMs}`;
  }

  private setRateLimitHeaders(res: Response, info: RateLimitInfo): void {
    res.set({
      'X-RateLimit-Limit': this.options.maxRequests.toString(),
      'X-RateLimit-Remaining': info.remaining.toString(),
      'X-RateLimit-Reset': info.resetTime.getTime().toString(),
      'X-RateLimit-Window': this.options.windowMs.toString(),
    });
  }

  public async getRateLimitInfo(req: Request): Promise<RateLimitInfo> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Clean up old entries and count current requests
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const currentRequests = await this.redis.zcard(key);

    return {
      remaining: Math.max(0, this.options.maxRequests - currentRequests),
      resetTime: new Date(now + this.options.windowMs),
      totalRequests: currentRequests,
    };
  }

  public async resetUserLimit(identifier: string): Promise<void> {
    const key = `ratelimit:${identifier}:${this.options.windowMs}`;
    await this.redis.del(key);
  }
}

// Pre-configured rate limiters for different endpoints
export class RateLimiters {
  // General API rate limiter - 1000 requests per hour
  static api = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
  });

  // Authentication rate limiter - 10 attempts per 15 minutes
  static auth = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
    keyGenerator: (req: Request) => req.ip,
    message: 'Too many authentication attempts, please try again later',
  });

  // Message sending rate limiter - 60 messages per minute
  static messages = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
    message: 'Message rate limit exceeded, please slow down',
  });

  // File upload rate limiter - 10 uploads per hour
  static fileUpload = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
    message: 'File upload rate limit exceeded',
  });

  // Room creation rate limiter - 5 rooms per hour
  static roomCreation = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
    message: 'Room creation rate limit exceeded',
  });

  // Moderation actions rate limiter - 50 actions per hour
  static moderation = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
    message: 'Moderation action rate limit exceeded',
  });

  // Search rate limiter - 100 searches per hour
  static search = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
    keyGenerator: (req: Request) => {
      const userId = (req as any).userId;
      return userId || req.ip;
    },
    message: 'Search rate limit exceeded',
  });
}

// Socket.IO rate limiting for WebSocket events
export class SocketRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  constructor() {
    // Event-specific rate limiters
    this.limiters.set('send_message', new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,
      keyGenerator: () => '', // Will be overridden
    }));

    this.limiters.set('typing_start', new RateLimiter({
      windowMs: 10 * 1000, // 10 seconds
      maxRequests: 10,
      keyGenerator: () => '',
    }));

    this.limiters.set('join_room', new RateLimiter({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
      keyGenerator: () => '',
    }));
  }

  public async checkLimit(event: string, userId: string): Promise<boolean> {
    const limiter = this.limiters.get(event);
    if (!limiter) {
      return true; // No limit configured for this event
    }

    try {
      // Create a mock request object for the rate limiter
      const mockReq = {
        ip: userId, // Use userId as identifier for socket events
      } as Request;

      // Override the key generator to use userId
      const originalKeyGen = (limiter as any).options.keyGenerator;
      (limiter as any).options.keyGenerator = () => `socket:${userId}`;

      const info = await limiter.getRateLimitInfo(mockReq);

      // Restore original key generator
      (limiter as any).options.keyGenerator = originalKeyGen;

      if (info.remaining <= 0) {
        return false; // Rate limit exceeded
      }

      // Manually increment the counter
      const key = `ratelimit:socket:${userId}:${(limiter as any).options.windowMs}`;
      const now = Date.now();
      await (limiter as any).redis.zadd(key, now, `${now}-${Math.random()}`);
      await (limiter as any).redis.expire(key, Math.ceil((limiter as any).options.windowMs / 1000));

      return true;
    } catch (error) {
      console.error('Socket rate limiter error:', error);
      return true; // Don't block on errors
    }
  }

  public async resetUserLimits(userId: string): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [event, limiter] of this.limiters) {
      const key = `ratelimit:socket:${userId}:${(limiter as any).options.windowMs}`;
      promises.push((limiter as any).redis.del(key));
    }

    await Promise.all(promises);
  }
}

// Export middleware functions
export const apiRateLimit = RateLimiters.api.middleware;
export const authRateLimit = RateLimiters.auth.middleware;
export const messageRateLimit = RateLimiters.messages.middleware;
export const fileUploadRateLimit = RateLimiters.fileUpload.middleware;
export const roomCreationRateLimit = RateLimiters.roomCreation.middleware;
export const moderationRateLimit = RateLimiters.moderation.middleware;
export const searchRateLimit = RateLimiters.search.middleware;

export const socketRateLimiter = new SocketRateLimiter();