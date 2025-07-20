import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check if Redis is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(500).json({ 
        error: 'Cache not configured',
        message: 'Redis environment variables not set'
      });
    }

    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const { action, pattern } = req.body || {};

    switch (req.method) {
      case 'POST':
        return await handleCacheAction(redis, action, pattern, res);
      case 'DELETE':
        return await handleCacheClear(redis, pattern, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Cache management error:', error);
    res.status(500).json({ 
      error: 'Cache operation failed', 
      message: error.message 
    });
  }
}

async function handleCacheAction(redis: Redis, action: string, pattern: string, res: VercelResponse) {
  switch (action) {
    case 'stats':
      return await getCacheStats(redis, res);
    case 'keys':
      return await getCacheKeys(redis, pattern, res);
    case 'clear-pattern':
      return await clearCachePattern(redis, pattern, res);
    default:
      return res.status(400).json({ error: 'Invalid action', validActions: ['stats', 'keys', 'clear-pattern'] });
  }
}

async function getCacheStats(redis: Redis, res: VercelResponse) {
  try {
    const marketCapKeys = await redis.keys('market-cap:*');
    const backtestKeys = await redis.keys('backtest:*');
    const allKeys = await redis.keys('*');
    
    // Get sample data for analysis
    const sampleKey = marketCapKeys[0];
    const sampleData = sampleKey ? await redis.get(sampleKey) : null;
    
    const stats = {
      total_keys: allKeys.length,
      market_cap_entries: marketCapKeys.length,
      backtest_entries: backtestKeys.length,
      other_entries: allKeys.length - marketCapKeys.length - backtestKeys.length,
      sample_key: sampleKey,
      sample_data_size: sampleData ? JSON.stringify(sampleData).length : 0,
      memory_usage_estimate: `${((allKeys.length * 2000) / 1024 / 1024).toFixed(2)} MB`,
      categories: {
        'market-cap': marketCapKeys.length,
        'backtest': backtestKeys.length,
        'other': allKeys.length - marketCapKeys.length - backtestKeys.length
      }
    };
    
    return res.status(200).json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get cache stats', message: error.message });
  }
}

async function getCacheKeys(redis: Redis, pattern: string = '*', res: VercelResponse) {
  try {
    const keys = await redis.keys(pattern);
    const limitedKeys = keys.slice(0, 100); // Limit to first 100 keys
    
    return res.status(200).json({
      pattern,
      total_matches: keys.length,
      keys: limitedKeys,
      limited: keys.length > 100
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to get cache keys', message: error.message });
  }
}

async function clearCachePattern(redis: Redis, pattern: string, res: VercelResponse) {
  try {
    if (!pattern) {
      return res.status(400).json({ 
        error: 'Pattern required', 
        message: 'Specify a pattern like "market-cap:*", "backtest:*", or "*" to clear data'
      });
    }
    
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return res.status(200).json({ 
        message: 'No keys found matching pattern',
        pattern,
        deleted: 0
      });
    }
    
    // Delete keys in batches to avoid timeout
    const batchSize = 100;
    let totalDeleted = 0;
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const deleted = await redis.del(...batch);
      totalDeleted += deleted;
    }
    
    return res.status(200).json({ 
      message: 'Cache cleared successfully',
      pattern,
      deleted: totalDeleted,
      total_found: keys.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to clear cache', message: error.message });
  }
}

async function handleCacheClear(redis: Redis, pattern: string, res: VercelResponse) {
  // DELETE method for clearing cache
  return await clearCachePattern(redis, pattern || 'market-cap:*', res);
}