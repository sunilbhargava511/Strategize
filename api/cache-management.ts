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
      // Advanced cache operations
      const { action, tickers, confirmationCode } = req.body;
      
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

      } else if (action === 'clear_market_data') {
        // Advanced: Clear EODHD market data cache
        if (confirmationCode !== 'CLEAR_MARKET_DATA') {
          return res.status(400).json({
            error: 'Invalid confirmation code. This is a protected operation.'
          });
        }

        console.log('🚨 ADVANCED: Clearing all EODHD market data cache...');
        
        // Get all market data cache keys
        const [priceKeys, marketCapKeys, sharesKeys] = await Promise.all([
          cache.keys('price:*'),
          cache.keys('market-cap:*'), 
          cache.keys('shares:*')
        ]);
        
        const allMarketDataKeys = [...priceKeys, ...marketCapKeys, ...sharesKeys];
        
        if (allMarketDataKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: 'No market data cache to clear'
          });
        }

        const deletedCount = await cache.mdel(allMarketDataKeys);
        
        console.log(`✅ Successfully cleared ${deletedCount} market data cache entries`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} market data cache entries (prices, market caps, shares)`,
          breakdown: {
            prices: priceKeys.length,
            marketCaps: marketCapKeys.length, 
            shares: sharesKeys.length
          }
        });

      } else if (action === 'clear_everything') {
        // Nuclear option: Clear everything
        if (confirmationCode !== 'NUCLEAR_CLEAR_EVERYTHING') {
          return res.status(400).json({
            error: 'Invalid confirmation code. This is a NUCLEAR operation that clears ALL cache.'
          });
        }

        console.log('☢️ NUCLEAR: Clearing ALL cache data...');
        
        // Get all keys
        const allKeys = await cache.keys('*');
        
        if (allKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: 'Cache is already empty'
          });
        }

        const deletedCount = await cache.mdel(allKeys);
        
        console.log(`✅ Successfully cleared ALL cache: ${deletedCount} entries`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `NUCLEAR CLEAR: Deleted ALL ${deletedCount} cache entries`
        });

      } else if (action === 'clear_by_ticker') {
        // Clear all data for specific tickers
        if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
          return res.status(400).json({
            error: 'Missing tickers array for ticker-specific clearing'
          });
        }

        if (confirmationCode !== 'CLEAR_TICKER_DATA') {
          return res.status(400).json({
            error: 'Invalid confirmation code. This is a protected operation.'
          });
        }

        console.log(`🗑️ ADVANCED: Clearing cache data for tickers: ${tickers.join(', ')}`);
        
        let allTickerKeys: string[] = [];
        
        // For each ticker, find all related cache keys
        for (const ticker of tickers) {
          const tickerPattern = ticker.toUpperCase();
          const [priceKeys, marketCapKeys, sharesKeys, backtestKeys] = await Promise.all([
            cache.keys(`price:${tickerPattern}:*`),
            cache.keys(`market-cap:${tickerPattern}:*`),
            cache.keys(`shares:${tickerPattern}:*`),
            cache.keys(`backtest:*${tickerPattern}*`) // Analysis results containing this ticker
          ]);
          
          allTickerKeys.push(...priceKeys, ...marketCapKeys, ...sharesKeys, ...backtestKeys);
        }
        
        if (allTickerKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: `No cache data found for tickers: ${tickers.join(', ')}`
          });
        }

        const deletedCount = await cache.mdel(allTickerKeys);
        
        console.log(`✅ Successfully cleared ${deletedCount} cache entries for ${tickers.length} tickers`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} cache entries for tickers: ${tickers.join(', ')}`
        });

      } else {
        return res.status(400).json({
          error: 'Invalid action. Supported actions: clear_all, clear_market_data, clear_everything, clear_by_ticker'
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