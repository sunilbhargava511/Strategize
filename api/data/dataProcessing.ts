// api/data/dataProcessing.ts
// Data processing and legacy cache functions for individual data points

import { cache } from '../_upstashCache';
import { CACHE_KEYS, DATES, SIZE_LIMITS } from '../_constants';
import { logger } from '../_logger';
import { setTickerInCache, storeFailedTicker, removeFailedTicker, validateCacheCoverage } from '../cache/cacheOperations';
import { 
  getSplitAdjustedPriceWithFallback, 
  getSharesOutstanding, 
  getMarketCapFromAPI, 
  getValidUSTickers,
  isETF 
} from '../external/eodhApi';
import type { TickerCacheData, FillCacheResults } from '../_types';

// Progress callback interface
export interface FillCacheProgress {
  processed: number;
  total: number;
  percentage: number;
  currentTicker?: string;
  successful: number;
  failed: number;
  batchNumber?: number;
  totalBatches?: number;
}

export type ProgressCallback = (progress: FillCacheProgress) => void;

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

// Fill cache function with progress reporting
export async function fillCacheWithProgress(tickers: string[], progressCallback?: ProgressCallback): Promise<FillCacheResults> {
  const results: FillCacheResults = {
    success: [],
    errors: [],
    warnings: []
  };

  logger.info(`Starting cache population for ${tickers.length} tickers (EFFICIENT MODE WITH CACHE CHECKING)`);
  logger.info(`Input tickers: ${tickers.join(', ')}`);
  
  // First, check which tickers are already cached vs missing
  const { missing, eliminated } = await validateCacheCoverage(tickers);
  
  // Report already cached tickers
  const alreadyCached = tickers.filter(t => !missing.includes(t) && !eliminated.find(e => e.ticker === t));
  
  logger.info(`📊 CACHE ANALYSIS RESULTS:`);
  logger.info(`   📁 Already Cached: ${alreadyCached.length} tickers - ${alreadyCached.join(', ') || 'none'}`);
  logger.info(`   🔍 Missing/Need API: ${missing.length} tickers - ${missing.join(', ') || 'none'}`);
  logger.info(`   ❌ Previously Failed: ${eliminated.length} tickers - ${eliminated.map(e => e.ticker).join(', ') || 'none'}`);
  
  if (alreadyCached.length > 0) {
    results.success.push(...alreadyCached);
    logger.success(`✅ ${alreadyCached.length} tickers already cached, skipping API calls for: ${alreadyCached.join(', ')}`);
  }
  
  // Report eliminated tickers
  for (const elim of eliminated) {
    results.errors.push({
      ticker: elim.ticker,
      error: `Previously failed: ${elim.reason}`
    });
    logger.warn(`❌ ${elim.ticker}: Previously failed - ${elim.reason}`);
  }
  
  // Only process missing tickers
  const tickersToProcess = missing;
  logger.info(`🔄 Will fetch ${tickersToProcess.length} missing tickers from EODHD API: ${tickersToProcess.join(', ') || 'none'}`);
  
  if (tickersToProcess.length === 0) {
    logger.success(`🎉 All ${tickers.length} tickers already cached! No API calls needed.`);
    if (progressCallback) {
      progressCallback({
        processed: tickers.length,
        total: tickers.length,
        percentage: 100,
        successful: results.success.length,
        failed: results.errors.length
      });
    }
    return results;
  }
  
  // Get current year for date range
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear;
  const minYear = DATES.MIN_YEAR;
  const BATCH_SIZE = SIZE_LIMITS.FILL_CACHE_BATCH_SIZE;
  const PROGRESS_UPDATE_INTERVAL = SIZE_LIMITS.FILL_CACHE_PROGRESS_INTERVAL;
  
  // Get API token
  const EOD_API_KEY = process.env.EODHD_API_TOKEN;
  if (!EOD_API_KEY) {
    logger.error('EODHD_API_TOKEN not configured');
    throw new Error('EODHD_API_TOKEN environment variable is required');
  }
  
  // Process missing tickers in batches
  const totalBatches = Math.ceil(tickersToProcess.length / BATCH_SIZE);
  logger.info(`📦 Processing ${tickersToProcess.length} missing tickers in ${totalBatches} batches of ${BATCH_SIZE}`);
  
  let processed = results.success.length; // Start with already cached count
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, tickersToProcess.length);
    const batchTickers = tickersToProcess.slice(batchStart, batchEnd);
    const batchStartTime = Date.now();
    
    logger.info(`🔄 BATCH ${batchIndex + 1}/${totalBatches}: Processing missing tickers ${batchStart + 1}-${batchEnd} (${batchTickers.join(', ')})`);
    
    // Process all missing tickers in current batch
    for (const ticker of batchTickers) {
      // Report progress before processing each ticker
      if (progressCallback) {
        progressCallback({
          processed,
          total: tickers.length,
          percentage: (processed / tickers.length) * 100,
          currentTicker: ticker,
          successful: results.success.length,
          failed: results.errors.length,
          batchNumber: batchIndex + 1,
          totalBatches
        });
      }
      
      try {
        logger.info(`🔄 Processing missing ticker: ${ticker}...`);
        
        // Build complete ticker data by fetching directly from EODHD API
        const tickerData: TickerCacheData = {};
        const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
        
        for (let year = minYear; year <= maxYear; year++) {
          try {
            const startOfYearDate = `${year}${DATES.NEW_YEAR_HOLIDAY}`;
            
            // Fetch all data directly from EODHD API (NO individual cache operations)
            const [priceData, sharesOutstanding] = await Promise.all([
              getSplitAdjustedPriceWithFallback(tickerWithExchange, startOfYearDate, EOD_API_KEY),
              isETF(ticker) ? Promise.resolve(null) : getSharesOutstanding(tickerWithExchange, startOfYearDate, EOD_API_KEY)
            ]);
            
            // Calculate market cap if we have both price and shares
            let marketCap: number | undefined;
            if (priceData?.adjusted_close && sharesOutstanding) {
              marketCap = priceData.adjusted_close * sharesOutstanding;
            }
            
            // Only add entry if we have price data (stock was trading)
            if (priceData?.adjusted_close) {
              // For non-ETF stocks, require both price AND market cap data
              if (!isETF(ticker)) {
                // Check for complete data requirements
                if (!sharesOutstanding) {
                  results.errors.push({
                    ticker,
                    error: `DATA QUALITY ERROR: ${year} - Price available ($${priceData.adjusted_close.toFixed(2)}) but historical shares outstanding unavailable. This ticker requires historical fundamentals data.`
                  });
                  continue; // Skip this year - don't store incomplete data
                }
                
                if (!marketCap) {
                  results.errors.push({
                    ticker, 
                    error: `DATA QUALITY ERROR: ${year} - Price available (${priceData.adjusted_close.toFixed(2)}) but market cap calculation failed. Shares: ${sharesOutstanding?.toLocaleString()}`
                  });
                  continue; // Skip this year - don't store incomplete data
                }
              }
              
              // Store the complete data entry
              tickerData[year.toString()] = {
                price: priceData.adjusted_close,
                market_cap: marketCap,
                shares_outstanding: sharesOutstanding || undefined
              };
              
              logger.debug(`${ticker} ${year}: ✅ Complete data - Price: $${priceData.adjusted_close.toFixed(2)}, MarketCap: $${marketCap ? (marketCap/1e9).toFixed(2) + 'B' : 'N/A'}`);
            }
            
          } catch (yearError) {
            // Continue processing other years if one fails
            logger.debug(`${ticker} ${year}: ${yearError}`);
          }
        }
        
        // Save to ticker-based cache if we got any data
        if (Object.keys(tickerData).length > 0) {
          await setTickerInCache(ticker, tickerData);
          // Remove from failed tickers if it was previously failed
          await removeFailedTicker(ticker);
          results.success.push(ticker);
          logger.success(`✅ ${ticker}: Successfully cached ${Object.keys(tickerData).length} years of data (NEW)`)
        } else {
          const errorMsg = 'No price data found for any year';
          results.errors.push({
            ticker,
            error: errorMsg
          });
          // Store in failed tickers
          await storeFailedTicker(ticker, errorMsg);
          logger.error(`${ticker}: No data available`);
        }
        
      } catch (tickerError) {
        const errorMsg = tickerError instanceof Error ? tickerError.message : String(tickerError);
        results.errors.push({
          ticker,
          error: errorMsg
        });
        // Store in failed tickers
        await storeFailedTicker(ticker, errorMsg);
        logger.error(`${ticker}: Failed to process - ${tickerError}`);
      }
      
      processed++;
    }
    
    const batchTime = Date.now() - batchStartTime;
    logger.success(`✅ BATCH ${batchIndex + 1}/${totalBatches} COMPLETE: ${batchTickers.length} tickers processed in ${(batchTime/1000).toFixed(1)}s`);
    
    // Progress update every 5 batches or at completion
    if ((batchIndex + 1) % PROGRESS_UPDATE_INTERVAL === 0 || batchIndex + 1 === totalBatches) {
      const progress = ((processed) / tickers.length * 100);
      const remaining = tickers.length - processed;
      
      logger.info(`📊 PROGRESS UPDATE: ${progress.toFixed(1)}% complete (${processed}/${tickers.length} tickers)`);
      logger.info(`   ✅ Success: ${results.success.length}, ❌ Errors: ${results.errors.length}, ⚠️  Warnings: ${results.warnings.length}`);
      logger.info(`   ⏱️  Average: ${(batchTime/(batchTickers.length * 1000)).toFixed(2)}s per ticker`);
      logger.info(`   📈 Progress Bar: [${'█'.repeat(Math.floor(progress/5))}${'-'.repeat(20-Math.floor(progress/5))}] ${progress.toFixed(1)}%`);
      
      // Send progress callback
      if (progressCallback) {
        progressCallback({
          processed,
          total: tickers.length,
          percentage: progress,
          currentTicker: undefined,
          successful: results.success.length,
          failed: results.errors.length,
          batchNumber: batchIndex + 1,
          totalBatches
        });
      }
      
      if (remaining > 0) {
        logger.info(`   ⏳ Remaining: ${remaining} tickers (${Math.ceil(remaining/BATCH_SIZE)} batches)`);
      }
    }
  }
  
  logger.success(`🎉 FILL CACHE COMPLETE: ${results.success.length} success, ${results.errors.length} errors, ${results.warnings.length} warnings`);
  logger.info(`📊 FINAL STATS: Processed ${tickers.length} tickers in ${totalBatches} batches`);
  
  // Final progress callback
  if (progressCallback) {
    progressCallback({
      processed: tickers.length,
      total: tickers.length,
      percentage: 100,
      currentTicker: undefined,
      successful: results.success.length,
      failed: results.errors.length,
      batchNumber: totalBatches,
      totalBatches
    });
  }
  
  return results;
}

// Original fill cache function for backward compatibility
export async function fillCache(tickers: string[]): Promise<FillCacheResults> {
  return fillCacheWithProgress(tickers);
}