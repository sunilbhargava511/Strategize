// api/_cacheStats.ts
// Persistent cache statistics tracking to avoid Redis KEYS command

import { cache } from './_upstashCache';
import { logger } from './_logger';

// Auto-initialize stats when this module is imported
let initPromise: Promise<CacheStats> | null = null;

async function initializeStats(): Promise<CacheStats> {
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      const stats = await loadCacheStatsInternal();
      logger.info('Cache stats initialized successfully');
      return stats;
    } catch (error) {
      logger.error('Failed to initialize cache stats:', error);
      const emptyStats = createEmptyStats();
      inMemoryStats = emptyStats;
      return emptyStats;
    }
  })();
  
  return initPromise;
}

export interface CacheStats {
  tickerCount: number;
  backtestCount: number;
  shareCount: number;
  tickers: Set<string>;
  backtestKeys: Set<string>;
  shareKeys: Set<string>;
  lastUpdated: string;
  version: string;
}

const CACHE_STATS_KEY = 'cache_stats_v1';
let inMemoryStats: CacheStats | null = null;

// Initialize empty stats
function createEmptyStats(): CacheStats {
  return {
    tickerCount: 0,
    backtestCount: 0,
    shareCount: 0,
    tickers: new Set<string>(),
    backtestKeys: new Set<string>(),
    shareKeys: new Set<string>(),
    lastUpdated: new Date().toISOString(),
    version: '1.0'
  };
}

// Serialize stats for Redis storage (convert Sets to Arrays)
function serializeStats(stats: CacheStats): any {
  return {
    tickerCount: stats.tickerCount,
    backtestCount: stats.backtestCount,
    shareCount: stats.shareCount,
    tickers: Array.from(stats.tickers),
    backtestKeys: Array.from(stats.backtestKeys),
    shareKeys: Array.from(stats.shareKeys),
    lastUpdated: stats.lastUpdated,
    version: stats.version
  };
}

// Deserialize stats from Redis storage (convert Arrays to Sets)
function deserializeStats(data: any): CacheStats {
  return {
    tickerCount: data.tickerCount || 0,
    backtestCount: data.backtestCount || 0,
    shareCount: data.shareCount || 0,
    tickers: new Set(data.tickers || []),
    backtestKeys: new Set(data.backtestKeys || []),
    shareKeys: new Set(data.shareKeys || []),
    lastUpdated: data.lastUpdated || new Date().toISOString(),
    version: data.version || '1.0'
  };
}

// Internal function to load stats from Redis into memory
async function loadCacheStatsInternal(): Promise<CacheStats> {
  try {
    logger.info('Loading cache stats from Redis...');
    const storedStats = await cache.get(CACHE_STATS_KEY);
    
    if (storedStats) {
      inMemoryStats = deserializeStats(storedStats);
      logger.info(`Loaded cache stats: ${inMemoryStats.tickerCount} tickers, ${inMemoryStats.backtestCount} backtests, ${inMemoryStats.shareCount} shares`);
    } else {
      logger.info('No existing cache stats found, creating empty stats');
      inMemoryStats = createEmptyStats();
      await saveCacheStats(inMemoryStats);
    }
    
    return inMemoryStats;
  } catch (error) {
    logger.error('Error loading cache stats:', error);
    inMemoryStats = createEmptyStats();
    return inMemoryStats;
  }
}

// Save stats to Redis
export async function saveCacheStats(stats: CacheStats): Promise<void> {
  try {
    stats.lastUpdated = new Date().toISOString();
    const serialized = serializeStats(stats);
    await cache.set(CACHE_STATS_KEY, serialized);
    inMemoryStats = stats;
    logger.info(`Saved cache stats: ${stats.tickerCount} tickers, ${stats.backtestCount} backtests, ${stats.shareCount} shares`);
  } catch (error) {
    logger.error('Error saving cache stats:', error);
    throw error;
  }
}

// Load stats from Redis into memory (public interface)
export async function loadCacheStats(): Promise<CacheStats> {
  return await initializeStats();
}

// Get current stats (loads from Redis if not in memory)
export async function getCacheStats(): Promise<CacheStats> {
  if (!inMemoryStats) {
    return await initializeStats();
  }
  return inMemoryStats;
}

// Add a ticker to stats
export async function addTickerToStats(ticker: string): Promise<void> {
  const stats = await getCacheStats();
  if (!stats.tickers.has(ticker)) {
    stats.tickers.add(ticker);
    stats.tickerCount = stats.tickers.size;
    await saveCacheStats(stats);
  }
}

// Remove a ticker from stats
export async function removeTickerFromStats(ticker: string): Promise<void> {
  const stats = await getCacheStats();
  if (stats.tickers.has(ticker)) {
    stats.tickers.delete(ticker);
    stats.tickerCount = stats.tickers.size;
    await saveCacheStats(stats);
  }
}

// Add a backtest to stats
export async function addBacktestToStats(key: string): Promise<void> {
  const stats = await getCacheStats();
  if (!stats.backtestKeys.has(key)) {
    stats.backtestKeys.add(key);
    stats.backtestCount = stats.backtestKeys.size;
    await saveCacheStats(stats);
  }
}

// Remove a backtest from stats
export async function removeBacktestFromStats(key: string): Promise<void> {
  const stats = await getCacheStats();
  if (stats.backtestKeys.has(key)) {
    stats.backtestKeys.delete(key);
    stats.backtestCount = stats.backtestKeys.size;
    await saveCacheStats(stats);
  }
}

// Add a shared analysis to stats
export async function addShareToStats(key: string): Promise<void> {
  const stats = await getCacheStats();
  if (!stats.shareKeys.has(key)) {
    stats.shareKeys.add(key);
    stats.shareCount = stats.shareKeys.size;
    await saveCacheStats(stats);
  }
}

// Remove a shared analysis from stats
export async function removeShareFromStats(key: string): Promise<void> {
  const stats = await getCacheStats();
  if (stats.shareKeys.has(key)) {
    stats.shareKeys.delete(key);
    stats.shareCount = stats.shareKeys.size;
    await saveCacheStats(stats);
  }
}

// Rebuild stats by scanning all cache entries (emergency fallback)
export async function rebuildCacheStats(): Promise<CacheStats> {
  try {
    logger.info('Rebuilding cache stats from scratch...');
    
    // This is the fallback - we still need KEYS for rebuilding
    // But this should only be used in emergency situations
    const allKeys = await cache.keys('*');
    
    const stats = createEmptyStats();
    
    for (const key of allKeys) {
      if (key === CACHE_STATS_KEY) continue; // Skip the stats key itself
      
      if (key.startsWith('ticker-data:')) {
        const ticker = key.replace('ticker-data:', '');
        stats.tickers.add(ticker);
      } else if (key.startsWith('backtest:')) {
        stats.backtestKeys.add(key);
      } else if (key.startsWith('shared_analysis:')) {
        stats.shareKeys.add(key);
      }
    }
    
    stats.tickerCount = stats.tickers.size;
    stats.backtestCount = stats.backtestKeys.size;
    stats.shareCount = stats.shareKeys.size;
    
    await saveCacheStats(stats);
    logger.info(`Rebuilt cache stats: ${stats.tickerCount} tickers, ${stats.backtestCount} backtests, ${stats.shareCount} shares`);
    
    return stats;
  } catch (error) {
    logger.error('Error rebuilding cache stats:', error);
    throw error;
  }
}

// Import bulk data and update stats
export async function importDataWithStats(importData: Record<string, any>): Promise<{imported: number, errors: number}> {
  let imported = 0;
  let errors = 0;
  
  const stats = await getCacheStats();
  
  try {
    logger.info(`Importing ${Object.keys(importData).length} cache entries with stats tracking...`);
    
    for (const [key, value] of Object.entries(importData)) {
      if (key === CACHE_STATS_KEY) continue; // Skip importing the stats key itself
      
      try {
        // Determine expiration based on key type
        let expirationSeconds: number | undefined;
        
        if (key.startsWith('shared_analysis:')) {
          expirationSeconds = 604800; // 7 days
        }
        // ticker-data and backtest entries don't expire
        
        const success = await cache.set(key, value, expirationSeconds);
        
        if (success) {
          imported++;
          
          // Update stats
          if (key.startsWith('ticker-data:')) {
            const ticker = key.replace('ticker-data:', '');
            stats.tickers.add(ticker);
          } else if (key.startsWith('backtest:')) {
            stats.backtestKeys.add(key);
          } else if (key.startsWith('shared_analysis:')) {
            stats.shareKeys.add(key);
          }
        } else {
          errors++;
          logger.warn(`Failed to import key: ${key}`);
        }
      } catch (error) {
        errors++;
        logger.error(`Error importing key ${key}:`, error);
      }
    }
    
    // Update counts and save stats
    stats.tickerCount = stats.tickers.size;
    stats.backtestCount = stats.backtestKeys.size;
    stats.shareCount = stats.shareKeys.size;
    await saveCacheStats(stats);
    
    logger.info(`Import completed: ${imported} imported, ${errors} errors`);
    return { imported, errors };
    
  } catch (error) {
    logger.error('Bulk import failed:', error);
    throw error;
  }
}