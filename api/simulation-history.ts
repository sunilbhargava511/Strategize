// api/simulation-history.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSimulationSummariesArray } from './_simulationSummaries';

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
      console.log('📦 Fetching simulation history from centralized summaries...');
      
      // Get all simulation summaries from the centralized object
      const summaries = await getSimulationSummariesArray();
      
      console.log(`Found ${summaries.length} simulation summaries`);
      
      if (summaries.length === 0) {
        return res.status(200).json({
          analyses: [],
          total: 0,
          message: 'No simulations found'
        });
      }

      // Convert summaries to CachedAnalysis format
      const analyses: CachedAnalysis[] = summaries.map(summary => {
        let winningStrategy = null;
        let worstStrategy = null;
        
        if (summary.strategyPerformance) {
          winningStrategy = summary.strategyPerformance.winningStrategy;
          worstStrategy = summary.strategyPerformance.worstStrategy;
        }
        
        return {
          key: summary.key,
          tickers: summary.tickers,
          startYear: summary.startYear,
          endYear: summary.endYear,
          initialInvestment: summary.initialInvestment,
          tickerCount: summary.tickerCount,
          isPermanent: summary.isPermanent,
          size: JSON.stringify(summary).length,
          cachedAt: summary.cachedAt || summary.analysisDate || 'Unknown',
          expiresAt: summary.isPermanent ? 'Never' : 'Within 24 hours',
          customName: summary.customName || undefined,
          winningStrategy: winningStrategy || undefined,
          worstStrategy: worstStrategy || undefined
        };
      });

      console.log(`✅ Successfully retrieved ${analyses.length} simulation summaries`);
      
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
      
      // Remove from centralized summaries
      const { removeSimulationSummary } = await import('./_simulationSummaries');
      for (const key of validKeys) {
        await removeSimulationSummary(key);
      }
      
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