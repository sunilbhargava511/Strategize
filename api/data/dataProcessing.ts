// api/data/dataProcessing.ts
// Data processing and legacy cache functions for individual data points

import { cache } from '../_upstashCache';
import { CACHE_KEYS, DATES } from '../_constants';
import { logger } from '../_logger';
import { setTickerInCache } from '../cache/cacheOperations';
import { 
  getSplitAdjustedPriceWithFallback, 
  getSharesOutstanding, 
  getMarketCapFromAPI, 
  getValidUSTickers,
  isETF 
} from '../external/eodhApi';
import type { TickerCacheData, FillCacheResults } from '../_types';

// Legacy individual cache functions (still needed for fillCache)
export async function getSharesOutstandingForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // ETFs don't have traditional shares outstanding in the same way as stocks
    if (isETF(ticker)) {
      logger.debug(`Skipping shares outstanding for ETF ${ticker} - not applicable for ETFs`);
      return null;
    }
    
    // Use January 2nd to avoid New Year's Day holiday
    const startOfYearDate = `${year}${DATES.NEW_YEAR_HOLIDAY}`;
    const cacheKey = `${CACHE_KEYS.SHARES_OUTSTANDING}:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.shares_outstanding) {
        if (cacheStats) cacheStats.sharesOutstandingHits++;
        logger.debug(`Cache hit for shares outstanding ${ticker} ${year}: ${cached.shares_outstanding.toLocaleString()}`);
        return cached.shares_outstanding;
      }
    }
    
    if (cacheStats) cacheStats.sharesOutstandingMisses++;
    logger.debug(`Cache miss for shares outstanding ${ticker} ${year}, fetching from EODHD`);
    
    // Get API token
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      logger.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    // Add exchange suffix if needed
    const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    // Call EODHD fundamentals API
    const sharesOutstanding = await getSharesOutstanding(tickerWithExchange, startOfYearDate, EOD_API_KEY);
    
    if (sharesOutstanding) {
      // Always cache the result when API call is successful (regardless of bypassCache flag)
      try {
        await cache.set(cacheKey, {
          ticker,
          year,
          date: startOfYearDate,
          shares_outstanding: sharesOutstanding,
          cached_at: new Date().toISOString()
        });
        if (cacheStats) cacheStats.newCacheEntries++;
        logger.success(`Cached shares outstanding for ${ticker} ${year}: ${sharesOutstanding.toLocaleString()}`);
      } catch (cacheError) {
        logger.warn(`Failed to cache shares outstanding for ${ticker} ${year}`, cacheError);
      }
      
      return sharesOutstanding;
    }
    
    logger.debug(`No shares outstanding data available for ${ticker} in ${year}`);
    return null;
    
  } catch (error) {
    logger.error(`Error getting shares outstanding for ${ticker} in ${year}`, error);
    return null;
  }
}

export async function getAdjustedPriceForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // Use January 2nd to avoid New Year's Day holiday
    const startOfYearDate = `${year}${DATES.NEW_YEAR_HOLIDAY}`;
    const cacheKey = `${CACHE_KEYS.ADJUSTED_PRICE}:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.adjusted_close) {
        if (cacheStats) cacheStats.priceDataHits++;
        logger.debug(`Cache hit for adjusted price ${ticker} ${year}: $${cached.adjusted_close.toFixed(2)}`);
        return cached.adjusted_close;
      }
    }
    
    if (cacheStats) cacheStats.priceDataMisses++;
    logger.debug(`Cache miss for adjusted price ${ticker} ${year}, fetching from EODHD`);
    
    // Get API token
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      logger.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    // Add exchange suffix if needed
    const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    // Call EODHD price API with fallback logic
    const priceData = await getSplitAdjustedPriceWithFallback(tickerWithExchange, startOfYearDate, EOD_API_KEY);
    
    if (priceData && priceData.adjusted_close) {
      // Always cache the result when API call is successful (regardless of bypassCache flag)
      try {
        await cache.set(cacheKey, {
          ticker,
          year,
          date: priceData.date,
          adjusted_close: priceData.adjusted_close,
          close: priceData.close,
          open: priceData.open,
          high: priceData.high,
          low: priceData.low,
          volume: priceData.volume,
          cached_at: new Date().toISOString()
        });
        if (cacheStats) cacheStats.newCacheEntries++;
        logger.success(`Cached adjusted price for ${ticker} ${year}: $${priceData.adjusted_close.toFixed(2)} (actual date: ${priceData.date})`);
      } catch (cacheError) {
        logger.warn(`Failed to cache adjusted price for ${ticker} ${year}`, cacheError);
      }
      
      return priceData.adjusted_close;
    }
    
    logger.debug(`No adjusted price data available for ${ticker} in ${year}`);
    return null;
    
  } catch (error) {
    logger.error(`Error getting adjusted price for ${ticker} in ${year}`, error);
    return null;
  }
}

export async function getMarketCapForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // ETFs don't have market cap in the traditional sense - they track an index
    if (isETF(ticker)) {
      logger.debug(`Skipping market cap calculation for ETF ${ticker} - not applicable for ETFs`);
      return null;
    }
    
    const cacheKey = `${CACHE_KEYS.MARKET_CAP}:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.market_cap) {
        if (cacheStats) cacheStats.marketCapHits++;
        logger.debug(`Cache hit for market cap ${ticker} ${year}: $${(cached.market_cap / 1000000000).toFixed(2)}B`);
        return cached.market_cap;
      }
    }
    
    if (cacheStats) cacheStats.marketCapMisses++;
    logger.debug(`Cache miss for market cap ${ticker} ${year}, trying calculation from price × shares outstanding`);
    
    // Get both adjusted price and shares outstanding for the year
    const [adjustedPrice, sharesOutstanding] = await Promise.all([
      getAdjustedPriceForYear(ticker, year, bypassCache, cacheStats),
      getSharesOutstandingForYear(ticker, year, bypassCache, cacheStats)
    ]);
    
    // If we have both values, calculate market cap the traditional way
    if (adjustedPrice && sharesOutstanding) {
      const marketCap = adjustedPrice * sharesOutstanding;
      
      // Cache the calculated result
      try {
        await cache.set(cacheKey, {
          ticker,
          year,
          market_cap: marketCap,
          adjusted_price: adjustedPrice,
          shares_outstanding: sharesOutstanding,
          market_cap_billions: marketCap / 1000000000,
          source: 'calculated_price_shares',
          calculated_at: new Date().toISOString()
        });
        if (cacheStats) cacheStats.newCacheEntries++;
        logger.success(`Cached calculated market cap for ${ticker} ${year}: $${(marketCap / 1000000000).toFixed(2)}B`);
      } catch (cacheError) {
        logger.warn(`Failed to cache market cap for ${ticker} ${year}`, cacheError);
      }
      
      logger.success(`Calculated market cap for ${ticker} ${year}: $${adjustedPrice.toFixed(2)} × ${sharesOutstanding.toLocaleString()} = $${(marketCap / 1000000000).toFixed(2)}B`);
      return marketCap;
    }
    
    // Fallback: Try market cap API for delisted or problematic stocks
    logger.debug(`Cannot calculate market cap for ${ticker} ${year} (missing price or shares outstanding), trying market cap API fallback...`);
    
    // Check if the ticker is delisted
    const tickerLists = await getValidUSTickers(bypassCache);
    const isDelisted = tickerLists?.delisted.has(ticker) || tickerLists?.delisted.has(`${ticker}.US`);
    
    if (isDelisted) {
      logger.debug(`${ticker} is delisted, using market cap API as primary source`);
    } else {
      const missingData = [];
      if (!adjustedPrice) missingData.push('adjusted price');
      if (!sharesOutstanding) missingData.push('shares outstanding');
      logger.debug(`${ticker} ${year} missing ${missingData.join(' and ')}, trying market cap API as fallback`);
    }
    
    // Try to get market cap from the API (for start of year date)
    const startOfYearDate = `${year}-01-01`;
    const apiMarketCap = await getMarketCapFromAPI(ticker, startOfYearDate, bypassCache);
    
    if (apiMarketCap) {
      // Cache the API result under the year-based key too
      try {
        await cache.set(cacheKey, {
          ticker,
          year,
          market_cap: apiMarketCap,
          source: 'eodhd_market_cap_api_fallback',
          date_used: startOfYearDate,
          cached_at: new Date().toISOString()
        });
        logger.success(`Cached API market cap fallback for ${ticker} ${year}: $${(apiMarketCap / 1000000000).toFixed(2)}B`);
      } catch (cacheError) {
        logger.warn(`Failed to cache API market cap fallback for ${ticker} ${year}`, cacheError);
      }
      
      return apiMarketCap;
    }
    
    // If everything fails, log the error and return null
    const missingData = [];
    if (!adjustedPrice) missingData.push('adjusted price');
    if (!sharesOutstanding) missingData.push('shares outstanding');
    logger.error(`COMPLETE FAILURE: ${ticker} ${year} - missing ${missingData.join(' and ')} AND market cap API returned no data`);
    
    return null;
    
  } catch (error) {
    logger.error(`Error getting market cap for ${ticker} in ${year}`, error);
    return null;
  }
}

// Fill cache function - populates cache with complete ticker histories
export async function fillCache(tickers: string[]): Promise<FillCacheResults> {
  const results: FillCacheResults = {
    success: [],
    errors: [],
    warnings: []
  };

  logger.info(`Starting cache population for ${tickers.length} tickers`);
  
  // Get current year for date range
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear; // Up to current year
  const minYear = DATES.MIN_YEAR;
  
  for (const ticker of tickers) {
    try {
      logger.debug(`Processing ${ticker}...`);
      
      
      // Build complete ticker data
      const tickerData: TickerCacheData = {};
      
      for (let year = minYear; year <= maxYear; year++) {
        try {
          // Fetch all three data types for this year (bypass individual caching)
          const [priceData, marketCap, sharesOutstanding] = await Promise.all([
            getAdjustedPriceForYear(ticker, year, true, null),
            getMarketCapForYear(ticker, year, true, null),
            getSharesOutstandingForYear(ticker, year, true, null)
          ]);
          
          // Only add entry if we have price data (stock was trading)
          if (priceData) {
            tickerData[year] = {
              price: priceData,
              market_cap: marketCap || undefined,
              shares_outstanding: sharesOutstanding || undefined
            };
            
            // Warning if we have price but no shares outstanding
            if (!sharesOutstanding) {
              results.warnings.push({
                ticker,
                year: year.toString(),
                issue: 'Price available but shares outstanding missing'
              });
            }
          }
          
        } catch (yearError) {
          // Continue processing other years if one fails
          logger.debug(`${ticker} ${year}: ${yearError}`);
        }
      }
      
      // Save to cache if we got any data
      if (Object.keys(tickerData).length > 0) {
        await setTickerInCache(ticker, tickerData);
        results.success.push(ticker);
        logger.success(`${ticker}: Cached ${Object.keys(tickerData).length} years of data`);
      } else {
        results.errors.push({
          ticker,
          error: 'No price data found for any year'
        });
        logger.error(`${ticker}: No data available`);
      }
      
    } catch (tickerError) {
      results.errors.push({
        ticker,
        error: tickerError instanceof Error ? tickerError.message : String(tickerError)
      });
      logger.error(`${ticker}: Failed to process - ${tickerError}`);
    }
  }
  
  logger.success(`FILL CACHE COMPLETE: ${results.success.length} success, ${results.errors.length} errors, ${results.warnings.length} warnings`);
  return results;
}