// api/cache/cacheOperations.ts
// Core ticker-based cache operations

import { cache } from '../_upstashCache';
import { CACHE_KEYS } from '../_constants';
import { logger } from '../_logger';
import type { TickerCacheData, GetDataResults, FailedTickerData } from '../_types';

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

// Validate cache coverage and check for failed tickers
export async function validateCacheCoverage(tickers: string[]): Promise<{
  missing: string[];
  eliminated: Array<{ticker: string, reason: string}>;
}> {
  const missing: string[] = [];
  const eliminated: Array<{ticker: string, reason: string}> = [];
  
  // Get failed tickers once
  const failedTickers = await getFailedTickers();
  
  for (const ticker of tickers) {
    // Check if ticker is in failed list first
    if (failedTickers[ticker]) {
      eliminated.push({
        ticker,
        reason: failedTickers[ticker].error
      });
      continue;
    }
    
    // Check if ticker has cached data
    const cachedData = await getTickerFromCache(ticker);
    if (!cachedData || Object.keys(cachedData).length === 0) {
      missing.push(ticker);
    }
  }
  
  return { missing, eliminated };
}

// Get data function - loads runtime data structure from cache
export async function getDataFromCache(tickers: string[]): Promise<GetDataResults> {
  const data: Record<string, TickerCacheData> = {};
  const missing: string[] = [];
  const eliminated: Array<{ticker: string, reason: string}> = [];
  
  logger.debug(`Loading ${tickers.length} tickers from cache`);
  
  // Get failed tickers once
  const failedTickers = await getFailedTickers();
  
  for (const ticker of tickers) {
    // Check if ticker is in failed list first - eliminate it
    if (failedTickers[ticker]) {
      eliminated.push({
        ticker,
        reason: failedTickers[ticker].error
      });
      logger.debug(`🚫 ${ticker}: Eliminated - ${failedTickers[ticker].error}`);
      continue;
    }
    
    const cachedData = await getTickerFromCache(ticker);
    if (cachedData && Object.keys(cachedData).length > 0) {
      data[ticker] = cachedData;
      logger.debug(`✅ ${ticker}: Loaded ${Object.keys(cachedData).length} years`);
    } else {
      missing.push(ticker);
      logger.debug(`❌ ${ticker}: Not found in cache`);
    }
  }
  
  logger.info(`Cache load complete: ${Object.keys(data).length} loaded, ${missing.length} missing, ${eliminated.length} eliminated`);
  return { data, missing, eliminated };
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

// Year-by-year availability tracking
export interface StockAvailabilityChange {
  ticker: string;
  year: number;
  status: 'enter' | 'exit' | 'continue';
  hasData: boolean;
}

export interface YearlyAvailability {
  year: number;
  availableStocks: string[];
  enteringStocks: string[];
  exitingStocks: string[];
  continuingStocks: string[];
}

export function analyzeStockAvailabilityChanges(
  cachedData: Record<string, TickerCacheData>, 
  tickers: string[], 
  startYear: number, 
  endYear: number
): YearlyAvailability[] {
  const yearlyData: YearlyAvailability[] = [];
  let previousYearAvailable = new Set<string>();

  logger.debug(`Analyzing stock availability changes for ${tickers.length} tickers from ${startYear} to ${endYear}`);

  for (let year = startYear; year <= endYear; year++) {
    const currentYearAvailable = new Set<string>();
    const enteringStocks: string[] = [];
    const exitingStocks: string[] = [];
    const continuingStocks: string[] = [];

    // Check data availability for each ticker this year
    for (const ticker of tickers) {
      const price = getCachedPrice(cachedData, ticker, year);
      const marketCap = getCachedMarketCap(cachedData, ticker, year);
      
      // Determine if stock has valid data for this year
      let hasValidData = false;
      if (price && price > 0) {
        // For non-ETF stocks, require market cap data
        if (ticker === 'SPY' || ticker.match(/ETF|INDEX/i)) {
          hasValidData = true; // ETFs only need price data
        } else if (marketCap && marketCap > 0) {
          hasValidData = true; // Stocks need both price and market cap
        }
      }

      if (hasValidData) {
        currentYearAvailable.add(ticker);
        
        // Determine status compared to previous year
        if (previousYearAvailable.has(ticker)) {
          continuingStocks.push(ticker);
        } else {
          enteringStocks.push(ticker);
          logger.debug(`📈 ${ticker} ENTERING market in ${year} (was unavailable in ${year-1})`);
        }
      }
    }

    // Find stocks that were available last year but not this year (exiting)
    for (const ticker of previousYearAvailable) {
      if (!currentYearAvailable.has(ticker)) {
        exitingStocks.push(ticker);
        logger.debug(`📉 ${ticker} EXITING market in ${year} (was available in ${year-1})`);
      }
    }

    yearlyData.push({
      year,
      availableStocks: Array.from(currentYearAvailable),
      enteringStocks,
      exitingStocks,
      continuingStocks
    });

    // Log year summary
    logger.info(`${year}: ${currentYearAvailable.size} available (${enteringStocks.length} entering, ${exitingStocks.length} exiting, ${continuingStocks.length} continuing)`);

    // Update for next iteration
    previousYearAvailable = currentYearAvailable;
  }

  const totalChanges = yearlyData.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0);
  logger.success(`Stock availability analysis complete: ${totalChanges} total entry/exit events across ${endYear - startYear + 1} years`);

  return yearlyData;
}

// Failed ticker management functions
export async function storeFailedTicker(ticker: string, error: string): Promise<void> {
  try {
    const failedData: FailedTickerData = {
      ticker,
      error,
      failed_at: new Date().toISOString(),
      last_attempt: new Date().toISOString()
    };
    
    await cache.hset(CACHE_KEYS.FAILED_TICKERS, ticker, failedData);
    logger.error(`Stored failed ticker: ${ticker} - ${error}`);
  } catch (cacheError) {
    logger.error(`Error storing failed ticker ${ticker}`, cacheError);
  }
}

export async function getFailedTickers(): Promise<Record<string, FailedTickerData>> {
  try {
    const failedTickers = await cache.hgetall(CACHE_KEYS.FAILED_TICKERS);
    return failedTickers as Record<string, FailedTickerData>;
  } catch (error) {
    logger.error('Error fetching failed tickers', error);
    return {};
  }
}

export async function removeFailedTicker(ticker: string): Promise<void> {
  try {
    await cache.hdel(CACHE_KEYS.FAILED_TICKERS, ticker);
    logger.success(`Removed failed ticker: ${ticker}`);
  } catch (error) {
    logger.error(`Error removing failed ticker ${ticker}`, error);
  }
}