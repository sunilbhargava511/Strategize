import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rebuildCacheStats } from './_cacheStats';
import { logger } from './_logger';

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
    logger.info('🔄 Rebuilding cache stats to reflect existing data...');
    
    const stats = await rebuildCacheStats();
    
    logger.success(`✅ Cache stats rebuilt successfully`);
    
    return res.status(200).json({
      success: true,
      message: 'Cache stats rebuilt successfully',
      stats: {
        tickers: stats.tickerCount,
        backtests: stats.backtestCount,
        shares: stats.shareCount,
        lastUpdated: stats.lastUpdated
      }
    });
  } catch (error: any) {
    logger.error('Failed to rebuild cache stats:', error);
    return res.status(500).json({
      error: 'Failed to rebuild cache stats',
      message: error.message
    });
  }
}