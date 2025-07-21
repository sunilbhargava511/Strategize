// api/cache-management.ts
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // List all cached analysis results
      console.log('📦 Fetching all cached analysis results...');
      
      // Get all keys that match the backtest pattern
      const backtestKeys = await cache.keys('backtest:*');
      console.log(`Found ${backtestKeys.length} cached analysis results`);
      
      if (backtestKeys.length === 0) {
        return res.status(200).json({
          analyses: [],
          total: 0,
          message: 'No cached analyses found'
        });
      }

      // Get all cached results
      const cachedResults = await cache.mget(backtestKeys);
      
      const analyses: CachedAnalysis[] = [];
      
      for (let i = 0; i < backtestKeys.length; i++) {
        const key = backtestKeys[i];
        const result = cachedResults[i];
        
        if (!result) continue;

        try {
          // Parse the cache key to extract parameters
          // Format: backtest:TICKER1,TICKER2:startYear:endYear:initialInvestment
          const keyParts = key.split(':');
          if (keyParts.length !== 5) continue;
          
          const tickers = keyParts[1].split(',');
          const startYear = parseInt(keyParts[2]);
          const endYear = parseInt(keyParts[3]);
          const initialInvestment = parseInt(keyParts[4]);
          
          // Determine if permanent (historical data)
          const currentYear = new Date().getFullYear();
          const isPermanent = endYear < currentYear;
          
          // Calculate size estimate
          const size = JSON.stringify(result).length;
          
          analyses.push({
            key,
            tickers,
            startYear,
            endYear,
            initialInvestment,
            tickerCount: tickers.length,
            isPermanent,
            size,
            cachedAt: result.parameters?.analysisDate || result.cached_at || 'Unknown',
            expiresAt: isPermanent ? 'Never' : 'Within 24 hours'
          });
        } catch (parseError) {
          console.warn(`Failed to parse cache key: ${key}`, parseError);
        }
      }

      // Sort by cache date (newest first)
      analyses.sort((a, b) => {
        const dateA = new Date(a.cachedAt === 'Unknown' ? 0 : a.cachedAt);
        const dateB = new Date(b.cachedAt === 'Unknown' ? 0 : b.cachedAt);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Successfully retrieved ${analyses.length} cached analyses`);
      
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
      
      console.log(`✅ Successfully deleted ${deletedCount} cached analyses`);
      
      return res.status(200).json({
        success: true,
        deletedCount,
        requestedCount: keys.length,
        message: `Deleted ${deletedCount} cached analyses`
      });

    } else if (req.method === 'POST') {
      // Clear all cached analysis results
      const { action } = req.body;
      
      if (action === 'clear_all') {
        console.log('🗑️ Clearing all cached analysis results...');
        
        const backtestKeys = await cache.keys('backtest:*');
        if (backtestKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: 'No cached analyses to clear'
          });
        }

        const deletedCount = await cache.mdel(backtestKeys);
        
        console.log(`✅ Successfully cleared ${deletedCount} cached analyses`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} cached analyses`
        });
      } else {
        return res.status(400).json({
          error: 'Invalid action. Use "clear_all" to clear all cached results.'
        });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error: any) {
    console.error('Cache management error:', error);
    return res.status(500).json({
      error: 'Cache management failed',
      message: error.message
    });
  }
}