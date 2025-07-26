import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { getCacheStats, saveCacheStats, createEmptyStats } from './_cacheStats';
import { logger } from './_logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clearType } = req.body;

    if (clearType === 'all') {
      // Clear entire cache database
      logger.info('🗑️ Clearing entire cache database...');
      
      // Use FLUSHDB to clear all keys
      await cache.flushdb();
      
      // Reset cache stats to empty
      const emptyStats = createEmptyStats();
      await saveCacheStats(emptyStats);
      
      logger.info('✅ Entire cache cleared successfully');
      
      return res.status(200).json({
        success: true,
        message: 'Entire cache cleared successfully',
        clearedType: 'all'
      });
      
    } else if (clearType === 'backtests') {
      // Clear only backtest-related keys
      logger.info('🗑️ Clearing backtest cache entries...');
      
      const stats = await getCacheStats();
      const backtestKeys = Array.from(stats.backtestKeys);
      
      if (backtestKeys.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No backtest entries found to clear',
          clearedCount: 0
        });
      }
      
      logger.info(`Found ${backtestKeys.length} backtest keys to delete`);
      
      // Delete all backtest keys (includes both full results and summaries)
      const deletedCount = await cache.mdel(backtestKeys);
      
      // Update cache stats - remove all backtest keys
      stats.backtestKeys.clear();
      stats.backtestCount = 0;
      await saveCacheStats(stats);
      
      logger.info(`✅ Cleared ${deletedCount} backtest cache entries`);
      
      return res.status(200).json({
        success: true,
        message: `Cleared ${deletedCount} backtest cache entries`,
        clearedCount: deletedCount,
        clearedType: 'backtests'
      });
      
    } else {
      return res.status(400).json({
        error: 'Invalid clearType. Must be "all" or "backtests"'
      });
    }
    
  } catch (error: any) {
    logger.error('Failed to clear cache:', error);
    return res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
}