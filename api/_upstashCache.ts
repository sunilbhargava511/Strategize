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
  },

  // List all keys matching a pattern
  keys: async (pattern: string): Promise<string[]> => {
    if (!redis) return [];
    try {
      return await redis.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  },

  // Get multiple values at once
  mget: async (keys: string[]): Promise<any[]> => {
    if (!redis || keys.length === 0) return [];
    try {
      return await redis.mget(...keys);
    } catch (error) {
      console.error('Cache mget error:', error);
      return [];
    }
  },

  // Get multiple values at once with batching to handle size limits
  mgetBatched: async (keys: string[], batchSize: number = 10): Promise<any[]> => {
    if (!redis || keys.length === 0) return [];
    
    const results: any[] = [];
    
    // Process keys in batches to avoid hitting the 10MB request limit
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      try {
        const batchResults = await redis.mget(...batch);
        results.push(...batchResults);
      } catch (error: any) {
        console.error(`Cache mget batch error (batch ${Math.floor(i/batchSize) + 1}):`, error);
        
        // If batch still fails, try one by one
        for (const key of batch) {
          try {
            const singleResult = await redis.get(key);
            results.push(singleResult);
          } catch (singleError) {
            console.error(`Cache get error for key ${key}:`, singleError);
            results.push(null);
          }
        }
      }
    }
    
    return results;
  },

  // Delete multiple keys at once
  mdel: async (keys: string[]): Promise<number> => {
    if (!redis || keys.length === 0) return 0;
    try {
      return await redis.del(...keys);
    } catch (error) {
      console.error('Cache mdel error:', error);
      return 0;
    }
  },

  // Flush all keys in the database (nuclear option)
  flushdb: async (): Promise<boolean> => {
    if (!redis) return false;
    try {
      await redis.flushdb();
      return true;
    } catch (error) {
      console.error('Cache flushdb error:', error);
      return false;
    }
  },

  // Scan keys iteratively (for large datasets)
  scan: async (cursor: number | string, options?: { count?: number }): Promise<[number | string, string[]]> => {
    if (!redis) return [0, []];
    try {
      const result = await redis.scan(cursor, { count: options?.count || 100 });
      return result;
    } catch (error) {
      console.error('Cache scan error:', error);
      return [0, []];
    }
  }
};

// Default export for compatibility
export default cache;