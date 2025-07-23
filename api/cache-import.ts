// api/cache-import.ts
// Import cache data from JSON backup and maintain stats tracking

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from './_logger';
import { importDataWithStats, rebuildCacheStats } from './_cacheStats';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, overwrite = false, rebuild = false } = req.body;
    
    if (rebuild) {
      // Emergency rebuild of stats from existing cache
      logger.info('Rebuilding cache stats from existing data...');
      const stats = await rebuildCacheStats();
      return res.status(200).json({
        success: true,
        message: 'Cache stats rebuilt successfully',
        stats: {
          tickerCount: stats.tickerCount,
          backtestCount: stats.backtestCount,
          shareCount: stats.shareCount
        }
      });
    }
    
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid import data. Expected object with cache entries.'
      });
    }
    
    const importKeys = Object.keys(data);
    logger.info(`Starting cache import with stats tracking: ${importKeys.length} entries`);
    
    if (importKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data to import'
      });
    }

    // Filter out stats key to avoid importing old stats
    const importData = { ...data };
    delete importData.cache_stats_v1;
    
    // Use the stats-aware import function
    const result = await importDataWithStats(importData);
    
    logger.info(`Cache import completed: ${result.imported} imported, ${result.errors} errors`);
    
    res.status(200).json({
      success: true,
      imported: result.imported,
      errors: result.errors,
      total: Object.keys(importData).length,
      importedAt: new Date().toISOString(),
      message: result.errors > 0 
        ? `Import completed with ${result.errors} errors. ${result.imported} entries successfully imported.`
        : `Successfully imported ${result.imported} cache entries.`
    });
    
  } catch (error: any) {
    logger.error('Cache import failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import cache',
      error: error.message
    });
  }
}