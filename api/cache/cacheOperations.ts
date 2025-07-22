// api/cache/cacheOperations.ts
// Core ticker-based cache operations

import { cache } from '../_upstashCache';
import { CACHE_KEYS } from '../_constants';
import { logger } from '../_logger';
import type { TickerCacheData, GetDataResults } from '../_types';

// Cache utility functions for ticker-based structure
export async function getTickerFromCache(ticker: string): Promise<TickerCacheData | null> {
  try {
    const cacheKey = `${CACHE_KEYS.TICKER_DATA}:${ticker}`;
    const cachedData = await cache.get(cacheKey);
    return cachedData as TickerCacheData | null;
  } catch (error) {
    logger.error(`Error fetching ticker ${ticker} from cache`, error);
    return null;
  }
}

export async function setTickerInCache(ticker: string, data: TickerCacheData): Promise<void> {
  try {
    const cacheKey = `${CACHE_KEYS.TICKER_DATA}:${ticker}`;
    await cache.set(cacheKey, data); // Permanent cache for historical data
    logger.success(`Cached complete data for ${ticker} (${Object.keys(data).length} years)`);
  } catch (error) {
    logger.error(`Error caching ticker ${ticker}`, error);
  }
}

export async function listCachedTickers(): Promise<string[]> {
  try {
    const tickerKeys = await cache.keys(`${CACHE_KEYS.TICKER_DATA}:*`);
    return tickerKeys.map(key => key.replace(`${CACHE_KEYS.TICKER_DATA}:`, ''));
  } catch (error) {
    logger.error('Error listing cached tickers', error);
    return [];
  }
}

// Validate cache coverage
export async function validateCacheCoverage(tickers: string[]): Promise<string[]> {
  const missing: string[] = [];
  
  for (const ticker of tickers) {
    const cachedData = await getTickerFromCache(ticker);
    if (!cachedData || Object.keys(cachedData).length === 0) {
      missing.push(ticker);
    }
  }
  
  return missing;
}

// Get data function - loads runtime data structure from cache
export async function getDataFromCache(tickers: string[]): Promise<GetDataResults> {
  const data: Record<string, TickerCacheData> = {};
  const missing: string[] = [];
  
  logger.debug(`Loading ${tickers.length} tickers from cache`);
  
  for (const ticker of tickers) {
    const cachedData = await getTickerFromCache(ticker);
    if (cachedData && Object.keys(cachedData).length > 0) {
      data[ticker] = cachedData;
      logger.debug(`✅ ${ticker}: Loaded ${Object.keys(cachedData).length} years`);
    } else {
      missing.push(ticker);
      logger.debug(`❌ ${ticker}: Not found in cache`);
    }
  }
  
  logger.info(`Cache load complete: ${Object.keys(data).length} loaded, ${missing.length} missing`);
  return { data, missing };
}

// Helper functions to extract data from cache structure
export function getCachedPrice(cachedData: Record<string, TickerCacheData>, ticker: string, year: number): number | null {
  const tickerData = cachedData[ticker];
  if (!tickerData || !tickerData[year.toString()]) {
    return null;
  }
  return tickerData[year.toString()].price || null;
}

export function getCachedMarketCap(cachedData: Record<string, TickerCacheData>, ticker: string, year: number): number | null {
  const tickerData = cachedData[ticker];
  if (!tickerData || !tickerData[year.toString()]) {
    return null;
  }
  return tickerData[year.toString()].market_cap || null;
}

export function getCachedSharesOutstanding(cachedData: Record<string, TickerCacheData>, ticker: string, year: number): number | null {
  const tickerData = cachedData[ticker];
  if (!tickerData || !tickerData[year.toString()]) {
    return null;
  }
  return tickerData[year.toString()].shares_outstanding || null;
}