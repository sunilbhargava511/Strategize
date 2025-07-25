// api/cache-management.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { getFailedTickers, removeFailedTicker } from './cache/cacheOperations';


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
      // Check if requesting a specific cache entry
      const { key } = req.query;
      
      if (key && typeof key === 'string') {
        // Fetch specific cache entry
        console.log(`📦 Fetching specific cache entry: ${key}`);
        
        if (!key.startsWith('backtest:') && !key.startsWith('ticker-data:')) {
          return res.status(400).json({
            error: 'Invalid cache key - only backtest results and ticker data can be fetched'
          });
        }

        const cachedData = await cache.get(key);
        if (!cachedData) {
          return res.status(404).json({
            error: 'Cache entry not found'
          });
        }

        console.log(`✅ Successfully retrieved cache entry: ${key}`);
        return res.status(200).json({
          success: true,
          data: cachedData,
          key
        });
      }
      
      // List all cached analysis results
      console.log('📦 Fetching all cached analysis results and ticker statistics...');
      
      // Get cache statistics from stats tracking (no KEYS command needed)
      console.log('Fetching cached analysis results and ticker statistics from stats tracking...');
      
      const { getCacheStats } = await import('./_cacheStats');
      const cacheStats = await getCacheStats();
      
      const backtestKeys = Array.from(cacheStats.backtestKeys);
      const uniqueTickers = cacheStats.tickers;
      
      console.log(`Found ${backtestKeys.length} cached analysis results and ${uniqueTickers.size} unique tickers from stats`);
      
      // Get failed ticker data
      const failedTickers = await getFailedTickers();
      const failedTickersList = Object.values(failedTickers).map(failed => ({
        ticker: failed.ticker,
        error: failed.error,
        failed_at: failed.failed_at,
        last_attempt: failed.last_attempt
      }));
      
      if (backtestKeys.length === 0) {
        return res.status(200).json({
          analyses: [],
          total: 0,
          message: 'No cached analyses found',
          cacheStatistics: {
            uniqueTickers: uniqueTickers.size,
            tickersList: Array.from(uniqueTickers).sort(),
            cacheStructure: 'ticker-based',
            failedTickers: failedTickersList,
            failedTickersCount: failedTickersList.length
          }
        });
      }

      // Get all cached results using batched approach to avoid 10MB limit
      const cachedResults = await cache.mgetBatched(backtestKeys, 5); // Small batch size for large analysis objects
      
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
            expiresAt: isPermanent ? 'Never' : 'Within 24 hours',
            customName: result.customName || undefined
          });
        } catch (parseError) {
          console.warn(`Failed to parse cache key: ${key}`, parseError);
        }
      }

      // Sort by cache date (newest first)
      analyses.sort((a, b) => {
        const dateA = new Date(a.cachedAt === 'Unknown' || !a.cachedAt ? 0 : a.cachedAt);
        const dateB = new Date(b.cachedAt === 'Unknown' || !b.cachedAt ? 0 : b.cachedAt);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Successfully retrieved ${analyses.length} cached analyses`);
      
      return res.status(200).json({
        analyses,
        total: analyses.length,
        totalSizeBytes: analyses.reduce((sum, a) => sum + (a.size || 0), 0),
        cacheStatistics: {
          uniqueTickers: uniqueTickers.size,
          tickersList: Array.from(uniqueTickers).sort(),
          cacheStructure: 'ticker-based',
          failedTickers: failedTickersList,
          failedTickersCount: failedTickersList.length
        }
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
      const { action, tickers, confirmationCode, ticker } = req.body;
      
      if (action === 'clear_all') {
        console.log('🗑️ Clearing all cached analysis results...');
        
        const { getCacheStats, saveCacheStats } = await import('./_cacheStats');
        const cacheStats = await getCacheStats();
        const backtestKeys = Array.from(cacheStats.backtestKeys);
        
        if (backtestKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: 'No cached analyses to clear'
          });
        }

        const deletedCount = await cache.mdel(backtestKeys);
        
        // Update stats - clear all backtest keys
        cacheStats.backtestKeys.clear();
        cacheStats.backtestCount = 0;
        await saveCacheStats(cacheStats);
        
        console.log(`✅ Successfully cleared ${deletedCount} cached analyses`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} cached analyses`
        });

      } else if (action === 'clear_everything') {
        // Nuclear option: Clear everything
        if (confirmationCode !== 'NUCLEAR_CLEAR_EVERYTHING') {
          return res.status(400).json({
            error: 'Invalid confirmation code. This is a NUCLEAR operation that clears ALL cache.'
          });
        }

        console.log('☢️ NUCLEAR: Clearing ALL cache data...');
        
        // Use FLUSHDB for nuclear option and reset stats
        try {
          const flushed = await cache.flushdb();
          if (flushed) {
            // Reset cache stats after nuclear clear
            const { getCacheStats, saveCacheStats } = await import('./_cacheStats');
            const cacheStats = await getCacheStats();
            cacheStats.tickers.clear();
            cacheStats.backtestKeys.clear();
            cacheStats.shareKeys.clear();
            cacheStats.tickerCount = 0;
            cacheStats.backtestCount = 0;
            cacheStats.shareCount = 0;
            await saveCacheStats(cacheStats);
            
            console.log(`✅ Successfully cleared ALL cache using FLUSHDB and reset stats`);
            
            return res.status(200).json({
              success: true,
              deletedCount: 'ALL',
              message: `NUCLEAR CLEAR: Deleted ALL cache entries using FLUSHDB and reset stats`
            });
          } else {
            throw new Error('FLUSHDB returned false');
          }
        } catch (flushError) {
          console.error('FLUSHDB failed, trying stats-based approach:', flushError);
          
          // Fallback to stats-based approach
          try {
            const { getCacheStats, saveCacheStats } = await import('./_cacheStats');
            const cacheStats = await getCacheStats();
            
            const allKeys = [
              ...Array.from(cacheStats.tickers).map(ticker => `ticker-data:${ticker}`),
              ...Array.from(cacheStats.backtestKeys),
              ...Array.from(cacheStats.shareKeys)
            ];
            
            if (allKeys.length === 0) {
              return res.status(200).json({
                success: true,
                deletedCount: 0,
                message: 'Cache is already empty'
              });
            }

            const deletedCount = await cache.mdel(allKeys);
            
            // Reset stats
            cacheStats.tickers.clear();
            cacheStats.backtestKeys.clear();
            cacheStats.shareKeys.clear();
            cacheStats.tickerCount = 0;
            cacheStats.backtestCount = 0;
            cacheStats.shareCount = 0;
            await saveCacheStats(cacheStats);
            
            console.log(`✅ Successfully cleared ALL cache: ${deletedCount} entries and reset stats`);
            
            return res.status(200).json({
              success: true,
              deletedCount,
              message: `NUCLEAR CLEAR: Deleted ALL ${deletedCount} cache entries and reset stats`
            });
          } catch (statsError: any) {
            console.error('Stats-based nuclear clear also failed:', statsError);
            return res.status(500).json({
              success: false,
              error: 'Nuclear clear failed',
              message: 'Unable to clear cache due to Redis limitations. Please contact support.',
              details: statsError.message
            });
          }
        }

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
        
        const { getCacheStats, saveCacheStats } = await import('./_cacheStats');
        const cacheStats = await getCacheStats();
        
        let allTickerKeys: string[] = [];
        
        // For each ticker, find all related cache keys using stats
        for (const ticker of tickers) {
          const tickerPattern = ticker.toUpperCase();
          
          // Check if ticker exists in stats
          if (cacheStats.tickers.has(tickerPattern)) {
            allTickerKeys.push(`ticker-data:${tickerPattern}`);
          }
          
          // Find backtest keys containing this ticker
          for (const backtestKey of cacheStats.backtestKeys) {
            if (backtestKey.includes(tickerPattern)) {
              allTickerKeys.push(backtestKey);
            }
          }
        }
        
        if (allTickerKeys.length === 0) {
          return res.status(200).json({
            success: true,
            deletedCount: 0,
            message: `No cache data found for tickers: ${tickers.join(', ')}`
          });
        }

        const deletedCount = await cache.mdel(allTickerKeys);
        
        // Update stats - remove deleted keys
        for (const key of allTickerKeys) {
          if (key.startsWith('ticker-data:')) {
            const ticker = key.replace('ticker-data:', '');
            cacheStats.tickers.delete(ticker);
          } else if (key.startsWith('backtest:')) {
            cacheStats.backtestKeys.delete(key);
          }
        }
        
        cacheStats.tickerCount = cacheStats.tickers.size;
        cacheStats.backtestCount = cacheStats.backtestKeys.size;
        await saveCacheStats(cacheStats);
        
        console.log(`✅ Successfully cleared ${deletedCount} cache entries for ${tickers.length} tickers and updated stats`);
        
        return res.status(200).json({
          success: true,
          deletedCount,
          message: `Cleared ${deletedCount} cache entries for tickers: ${tickers.join(', ')}`
        });

      } else if (action === 'remove_failed_ticker') {
        // Remove a ticker from the failed tickers list
        if (!ticker || typeof ticker !== 'string') {
          return res.status(400).json({
            error: 'Missing ticker for failed ticker removal'
          });
        }

        console.log(`🔧 Removing failed ticker: ${ticker}`);
        
        try {
          await removeFailedTicker(ticker);
          
          console.log(`✅ Successfully removed failed ticker: ${ticker}`);
          
          return res.status(200).json({
            success: true,
            message: `Removed ${ticker} from failed tickers list. You can now try to cache it again.`,
            ticker
          });
        } catch (error: any) {
          console.error(`Error removing failed ticker ${ticker}:`, error);
          return res.status(500).json({
            error: 'Failed to remove failed ticker',
            message: error.message,
            ticker
          });
        }

      } else {
        return res.status(400).json({
          error: 'Invalid action. Supported actions: clear_all, clear_everything, clear_by_ticker, remove_failed_ticker'
        });
      }

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

        // All cache entries are now permanent since analysis is limited to historical data
        // Save the updated entry
        await cache.set(key, updatedData); // No expiration - permanent cache
        
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
    console.error('Cache management error:', error);
    return res.status(500).json({
      error: 'Cache management failed',
      message: error.message
    });
  }
}