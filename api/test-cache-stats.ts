// api/test-cache-stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCacheStats, loadCacheStats, rebuildCacheStats } from './_cacheStats';
import { cache } from './_upstashCache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      // Get current cache stats
      console.log('Getting cache stats...');
      const stats = await getCacheStats();
      
      // Also check if cache_stats_v1 key exists
      const statsKey = await cache.get('cache_stats_v1');
      
      // Get some sample backtest keys directly
      const sampleKeys: string[] = [];
      let cursor = 0;
      const scanResult = await cache.scan(cursor, { count: 10 });
      const keys = scanResult[1];
      
      for (const key of keys) {
        if (key.startsWith('backtest:')) {
          sampleKeys.push(key);
        }
      }
      
      return res.status(200).json({
        stats: {
          tickerCount: stats.tickerCount,
          backtestCount: stats.backtestCount,
          shareCount: stats.shareCount,
          lastUpdated: stats.lastUpdated,
          version: stats.version,
          backtestKeysSize: stats.backtestKeys.size,
          backtestKeysArray: Array.from(stats.backtestKeys).slice(0, 5) // First 5 keys
        },
        cacheStatsKeyExists: !!statsKey,
        sampleBacktestKeys: sampleKeys,
        message: 'Cache stats retrieved successfully'
      });
      
    } else if (req.method === 'POST') {
      // Rebuild cache stats
      console.log('Rebuilding cache stats...');
      const rebuiltStats = await rebuildCacheStats();
      
      return res.status(200).json({
        message: 'Cache stats rebuilt successfully',
        stats: {
          tickerCount: rebuiltStats.tickerCount,
          backtestCount: rebuiltStats.backtestCount,
          shareCount: rebuiltStats.shareCount,
          lastUpdated: rebuiltStats.lastUpdated,
          version: rebuiltStats.version
        }
      });
    }
    
  } catch (error: any) {
    console.error('Test cache stats error:', error);
    return res.status(500).json({
      error: 'Failed to test cache stats',
      message: error.message,
      stack: error.stack
    });
  }
}