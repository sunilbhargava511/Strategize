// api/simulation-history.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';

interface CachedAnalysis {
  key: string;
  tickers: string[];
  startYear: number;
  endYear: number;
  initialInvestment: number;
  tickerCount: number;
  cachedAt?: string;
  expiresAt?: string;
  isPermanent: boolean;
  size?: number;
  customName?: string;
  winningStrategy?: {
    name: string;
    finalValue: number;
  };
  worstStrategy?: {
    name: string;
    finalValue: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      console.log('📦 Fetching simulation history (using lightweight summaries for performance)...');
      
      // Get only backtest keys from stats tracking - avoid expensive operations
      const { getCacheStats } = await import('./_cacheStats');
      const cacheStats = await getCacheStats();
      
      // Filter for only actual backtest keys (not summary keys)
      const backtestKeys = Array.from(cacheStats.backtestKeys).filter(key => !key.includes(':summary'));
      
      console.log(`Found ${backtestKeys.length} cached analysis results`);
      
      if (backtestKeys.length === 0) {
        return res.status(200).json({
          analyses: [],
          total: 0,
          message: 'No cached analyses found'
        });
      }

      // Get lightweight summaries instead of full results for performance
      const summaryKeys = backtestKeys.map(key => `${key}:summary`);
      const cachedSummaries = await cache.mgetBatched(summaryKeys, 20); // Larger batch size for small summary objects
      
      const analyses: CachedAnalysis[] = [];
      
      for (let i = 0; i < backtestKeys.length; i++) {
        const key = backtestKeys[i];
        const summary = cachedSummaries[i];
        
        if (!summary) {
          console.warn(`No summary found for key: ${key}, falling back to parsing cache key`);
          // Fallback: parse cache key for basic info when summary doesn't exist
          try {
            const keyParts = key.split(':');
            if (keyParts.length !== 5) continue;
            
            const tickers = keyParts[1].split(',');
            const startYear = parseInt(keyParts[2]);
            const endYear = parseInt(keyParts[3]);
            const initialInvestment = parseInt(keyParts[4]);
            const currentYear = new Date().getFullYear();
            
            analyses.push({
              key,
              tickers,
              startYear,
              endYear,
              initialInvestment,
              tickerCount: tickers.length,
              isPermanent: endYear < currentYear,
              size: 0, // Unknown size without summary
              cachedAt: 'Unknown',
              expiresAt: endYear < currentYear ? 'Never' : 'Within 24 hours',
              customName: undefined,
              winningStrategy: undefined,
              worstStrategy: undefined
            });
          } catch (fallbackError) {
            console.warn(`Failed to parse cache key as fallback: ${key}`, fallbackError);
          }
          continue;
        }

        try {
          // Use summary data directly - no need to parse or calculate
          let winningStrategy = null;
          let worstStrategy = null;
          
          if (summary.strategyPerformance) {
            winningStrategy = summary.strategyPerformance.winningStrategy;
            worstStrategy = summary.strategyPerformance.worstStrategy;
          }
          
          analyses.push({
            key: summary.key,
            tickers: summary.tickers,
            startYear: summary.startYear,
            endYear: summary.endYear,
            initialInvestment: summary.initialInvestment,
            tickerCount: summary.tickerCount,
            isPermanent: summary.isPermanent,
            size: JSON.stringify(summary).length, // Much smaller size for summary
            cachedAt: summary.cachedAt || summary.analysisDate || 'Unknown',
            expiresAt: summary.isPermanent ? 'Never' : 'Within 24 hours',
            customName: summary.customName || undefined,
            winningStrategy: winningStrategy || undefined,
            worstStrategy: worstStrategy || undefined
          });
        } catch (parseError) {
          console.warn(`Failed to process summary for key: ${key}`, parseError);
        }
      }

      // Sort by cache date (newest first)
      analyses.sort((a, b) => {
        const dateA = new Date(a.cachedAt === 'Unknown' || !a.cachedAt ? 0 : a.cachedAt);
        const dateB = new Date(b.cachedAt === 'Unknown' || !b.cachedAt ? 0 : b.cachedAt);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Successfully retrieved ${analyses.length} cached analyses using lightweight summaries (fast mode)`);
      
      return res.status(200).json({
        analyses,
        total: analyses.length,
        totalSizeBytes: analyses.reduce((sum, a) => sum + (a.size || 0), 0)
      });

    } else if (req.method === 'DELETE') {
      // Delete specific cached results
      const { keys } = req.body;
      
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({
          error: 'Missing keys array in request body'
        });
      }

      console.log(`🗑️ Deleting ${keys.length} cached analysis results...`);
      
      // Validate that all keys are backtest keys for security
      const validKeys = keys.filter(key => key.startsWith('backtest:'));
      if (validKeys.length !== keys.length) {
        return res.status(400).json({
          error: 'Invalid cache keys - only backtest results can be deleted'
        });
      }

      const deletedCount = await cache.mdel(validKeys);
      
      // Update stats - remove deleted keys
      const { getCacheStats, saveCacheStats } = await import('./_cacheStats');
      const cacheStats = await getCacheStats();
      
      for (const key of validKeys) {
        cacheStats.backtestKeys.delete(key);
      }
      cacheStats.backtestCount = cacheStats.backtestKeys.size;
      await saveCacheStats(cacheStats);
      
      console.log(`✅ Successfully deleted ${deletedCount} cached analyses`);
      
      return res.status(200).json({
        success: true,
        deletedCount,
        requestedCount: keys.length,
        message: `Deleted ${deletedCount} cached analyses`
      });

    } else if (req.method === 'PUT') {
      // Update cache entry name
      const { key, customName } = req.body;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({
          error: 'Missing or invalid cache key'
        });
      }

      if (!key.startsWith('backtest:')) {
        return res.status(400).json({
          error: 'Invalid cache key - only backtest results can be renamed'
        });
      }

      try {
        console.log(`📝 Updating name for cache key: ${key}`);
        
        // Get the existing cache entry
        const existingData = await cache.get(key);
        if (!existingData) {
          return res.status(404).json({
            error: 'Cache entry not found'
          });
        }

        // Update the cache entry with the new custom name
        const updatedData = {
          ...existingData,
          customName: customName || undefined,
          nameUpdatedAt: new Date().toISOString()
        };

        // Save the updated entry (permanent cache)
        await cache.set(key, updatedData);
        
        console.log(`✅ Successfully updated name for ${key}: "${customName || 'Unnamed'}"`);
        
        return res.status(200).json({
          success: true,
          message: `Updated cache entry name to: "${customName || 'Unnamed'}"`,
          key,
          customName
        });

      } catch (error: any) {
        console.error('Error updating cache entry name:', error);
        return res.status(500).json({
          error: 'Failed to update cache entry name',
          message: error.message
        });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error: any) {
    console.error('Simulation history error:', error);
    return res.status(500).json({
      error: 'Simulation history failed',
      message: error.message
    });
  }
}