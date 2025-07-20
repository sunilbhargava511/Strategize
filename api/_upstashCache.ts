// api/_upstashCache.ts
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

// Initialize Redis if environment variables are available
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

export const cache = {
  get: async (key: string): Promise<any> => {
    if (!redis) return null;
    try {
      return await redis.get(key);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },
  
  set: async (key: string, value: any, expirationInSeconds?: number): Promise<boolean> => {
    if (!redis) return false;
    try {
      if (expirationInSeconds) {
        await redis.set(key, value, { ex: expirationInSeconds });
      } else {
        // No expiration - cache forever
        await redis.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  del: async (key: string): Promise<boolean> => {
    if (!redis) return false;
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  },
  
  getStats: async (): Promise<{ status: string; type?: string; size?: number; error?: string }> => {
    if (!redis) return { status: 'disabled' };
    try {
      const dbSize = await redis.dbsize();
      return { 
        status: 'operational',
        type: 'upstash-redis',
        size: dbSize
      };
    } catch (error: any) {
      return { 
        status: 'error',
        error: error.message
      };
    }
  }
};

// Default export for compatibility
export default cache;