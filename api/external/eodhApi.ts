// api/external/eodhApi.ts
// EODHD API integration functions

import { cache } from '../_upstashCache';
import { TIMEOUTS, CACHE_DURATION, CACHE_KEYS, DATES } from '../_constants';
import { logger } from '../_logger';
import { createConfigError, createNotFoundError } from '../_errorHandler';
import type { EODHDPriceData, ValidTickerLists } from '../_types';

// ETF detection helper
export function isETF(ticker: string): boolean {
  const etfTickers = new Set([
    'SPY', 'SPY.US', 'QQQ', 'QQQ.US', 'IWM', 'IWM.US',
    'VTI', 'VTI.US', 'EFA', 'EFA.US', 'VEA', 'VEA.US',
    'EEM', 'EEM.US', 'VWO', 'VWO.US', 'AGG', 'AGG.US',
    'BND', 'BND.US', 'TLT', 'TLT.US', 'GLD', 'GLD.US',
    'VB', 'VB.US', 'VTV', 'VTV.US', 'VUG', 'VUG.US',
    'VXUS', 'VXUS.US'
  ]);
  
  return etfTickers.has(ticker) || etfTickers.has(`${ticker}.US`);
}

// Helper function to try fetching price data for a specific date with delisted support
export async function tryFetchPriceForDate(ticker: string, date: string, apiToken: string): Promise<EODHDPriceData | null> {
  // Try multiple ticker formats to handle delisted stocks
  const formatsToTry = [
    ticker, // Original format (might already have .US or .DELISTED)
    ticker.includes('.') ? ticker : `${ticker}.US`, // Add .US if not present
    ticker.includes('.DELISTED') ? ticker : `${ticker}.US.DELISTED` // Try delisted format
  ];
  
  // Remove duplicates
  const uniqueFormats = [...new Set(formatsToTry)];
  
  for (const formattedTicker of uniqueFormats) {
    try {
      const eodUrl = `https://eodhd.com/api/eod/${formattedTicker}?from=${date}&to=${date}&api_token=${apiToken}&fmt=json`;
      
      const response = await fetch(eodUrl);
      
      if (!response.ok) {
        // Don't throw on 404 for delisted tickers, just try next format
        if (response.status === 404) {
          logger.debug(`No data found for ${formattedTicker} on ${date} (404)`);
          continue;
        }
        throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check if we got data
      if (!data || (Array.isArray(data) && data.length === 0)) {
        logger.debug(`No data found for ${formattedTicker} on ${date} (empty response)`);
        continue; // Try next format
      }
      
      // If we got here, we found data!
      if (formattedTicker !== ticker) {
        logger.info(`✅ Found delisted data for ${ticker} using format: ${formattedTicker}`);
      }
      
      const dayData = Array.isArray(data) ? data[0] : data;
      
      if (!dayData || !dayData.adjusted_close) {
        continue; // Try next format
      }
      
      return {
        date: dayData.date,
        open: dayData.open,
        high: dayData.high,
        low: dayData.low,
        close: dayData.close,
        adjusted_close: dayData.adjusted_close,
        volume: dayData.volume
      };
      
    } catch (error) {
      logger.debug(`Failed to fetch ${formattedTicker}: ${error}`);
      continue; // Try next format
    }
  }
  
  // No data found for any format
  return null;
}

// Get split-adjusted price with fallback logic
export async function getSplitAdjustedPriceWithFallback(ticker: string, requestedDate: string, apiToken: string): Promise<EODHDPriceData | null> {
  // Try the exact date first
  try {
    const exactData = await tryFetchPriceForDate(ticker, requestedDate, apiToken);
    if (exactData) {
      return exactData;
    }
  } catch (error) {
    logger.debug(`Failed to fetch exact date ${requestedDate} for ${ticker}: ${error}`);
  }
  
  // If exact date fails, try a few days forward (markets might have been closed)
  const requestedDateObj = new Date(requestedDate);
  for (let i = 1; i <= 5; i++) {
    try {
      const fallbackDate = new Date(requestedDateObj);
      fallbackDate.setDate(requestedDateObj.getDate() + i);
      const fallbackDateStr = fallbackDate.toISOString().split('T')[0];
      
      const fallbackData = await tryFetchPriceForDate(ticker, fallbackDateStr, apiToken);
      if (fallbackData) {
        logger.info(`Used fallback date ${fallbackDateStr} instead of ${requestedDate} for ${ticker}`);
        return fallbackData;
      }
    } catch (error) {
      // Continue trying next date
      continue;
    }
  }
  
  logger.warn(`No price data found for ${ticker} around ${requestedDate} (tried exact date + 5 days forward)`);
  return null;
}

// Get valid US tickers (for delisted ticker detection)
export async function getValidUSTickers(bypassCache: boolean = false): Promise<ValidTickerLists | null> {
  try {
    const cacheKey = CACHE_KEYS.VALID_TICKERS;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.active && cached.delisted) {
        logger.debug(`Cache hit for ticker lists: ${cached.active.length} active, ${cached.delisted.length} delisted`);
        return {
          active: new Set(cached.active),
          delisted: new Set(cached.delisted)
        };
      }
    }
    
    logger.info('Fetching complete ticker list from EODHD...');
    
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      throw createConfigError('EODHD_API_TOKEN not configured');
    }
    
    // Get exchange symbol list from EODHD
    const exchangeUrl = `https://eodhd.com/api/exchange-symbol-list/US?api_token=${EOD_API_KEY}&fmt=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.EODHD_EXCHANGE);
    
    const response = await fetch(exchangeUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ticker list: ${response.status} ${response.statusText}`);
    }
    
    const tickers = await response.json();
    
    if (!Array.isArray(tickers)) {
      throw new Error('Invalid ticker list response format');
    }
    
    // Split into active and delisted
    const active = new Set<string>();
    const delisted = new Set<string>();
    
    for (const ticker of tickers) {
      if (ticker.Code && ticker.Name) {
        if (ticker.IsDelisted === true || ticker.IsDelisted === '1') {
          delisted.add(ticker.Code);
          delisted.add(`${ticker.Code}.US`);
        } else {
          active.add(ticker.Code);
          active.add(`${ticker.Code}.US`);
        }
      }
    }
    
    // Cache the result
    const cacheData = {
      active: Array.from(active),
      delisted: Array.from(delisted),
      updated_at: new Date().toISOString()
    };
    
    try {
      await cache.set(cacheKey, cacheData, CACHE_DURATION.TICKER_LISTS);
      logger.success(`Cached ticker lists: ${active.size} active, ${delisted.size} delisted`);
    } catch (cacheError) {
      logger.warn('Failed to cache ticker lists', cacheError);
    }
    
    return { active, delisted };
    
  } catch (error) {
    logger.error('Error fetching valid US tickers', error);
    return null;
  }
}

// Get shares outstanding from fundamentals API
export async function getSharesOutstanding(ticker: string, date: string, apiToken: string): Promise<number | null> {
  const targetDate = new Date(date);
  const cutoffDate = targetDate;
  
  try {
    
    logger.debug(`Fetching shares outstanding for ${ticker} as of ${date} using EODHD quarterly balance sheet method`);
    
    // Step 1: Get all available quarterly balance sheet dates (following Python example)
    const periodsUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiToken}&fmt=json&filter=Financials::Balance_Sheet::quarterly`;
    
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), TIMEOUTS.EODHD_API);
    
    const periodsResponse = await fetch(periodsUrl, { signal: controller1.signal });
    clearTimeout(timeoutId1);
    
    if (!periodsResponse.ok) {
      logger.error(`HISTORICAL DATA ERROR: Failed to get quarterly periods for ${ticker}: ${periodsResponse.status} - cannot retrieve historical shares outstanding`);
      return null;
    }
    
    const allQuarters = await periodsResponse.json();
    
    if (!allQuarters || typeof allQuarters !== 'object') {
      logger.error(`HISTORICAL DATA ERROR: Invalid quarterly data structure for ${ticker} - cannot retrieve historical shares outstanding`);
      return null;
    }
    
    // Step 2: Find the most recent quarter before the cutoff date
    let bestDate: string | null = null;
    const availableDates = Object.keys(allQuarters).sort().reverse(); // Sort descending
    
    for (const dateStr of availableDates) {
      try {
        const reportDate = new Date(dateStr);
        if (reportDate < cutoffDate) {
          bestDate = dateStr;
          break;
        }
      } catch (dateError) {
        continue; // Skip invalid dates
      }
    }
    
    if (!bestDate) {
      logger.error(`HISTORICAL DATA ERROR: No quarterly reports found before ${date} for ${ticker} - cannot retrieve historical shares outstanding`);
      return null;
    }
    
    // Step 3: Query for outstanding shares on that specific date
    const sharesUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiToken}&fmt=json&filter=Financials::Balance_Sheet::quarterly::${bestDate}::commonStockSharesOutstanding`;
    
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), TIMEOUTS.EODHD_API);
    
    const sharesResponse = await fetch(sharesUrl, { signal: controller2.signal });
    clearTimeout(timeoutId2);
    
    if (!sharesResponse.ok) {
      logger.error(`HISTORICAL DATA ERROR: Failed to get shares outstanding for ${ticker} on ${bestDate}: ${sharesResponse.status}`);
      return null;
    }
    
    const sharesOutstanding = await sharesResponse.json();
    
    // Handle both string and number responses from EODHD API
    let sharesValue: number | null = null;
    if (typeof sharesOutstanding === 'number' && sharesOutstanding > 0) {
      sharesValue = sharesOutstanding;
    } else if (typeof sharesOutstanding === 'string' && sharesOutstanding.trim() !== '') {
      sharesValue = parseFloat(sharesOutstanding);
    }
    
    if (sharesValue && sharesValue > 0) {
      logger.success(`Found historical shares outstanding for ${ticker} as of ${bestDate}: ${sharesValue.toLocaleString()}`);
      return sharesValue;
    }
    
    logger.error(`HISTORICAL DATA ERROR: Invalid shares outstanding value for ${ticker} on ${bestDate}: ${sharesOutstanding}`);
    return null;
    
  } catch (error) {
    logger.error(`HISTORICAL DATA ERROR: Failed fetching shares outstanding for ${ticker}: ${error}`);
    return null;
  }
}


// Get market cap directly from EODHD market-capitalization endpoint
export async function getMarketCapFromAPI(ticker: string, date: string, bypassCache: boolean = false): Promise<number | null> {
  try {
    const cacheKey = `${CACHE_KEYS.MARKET_CAP_API}:${ticker}:${date}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.market_cap) {
        logger.debug(`Cache hit for API market cap ${ticker} ${date}: $${(cached.market_cap / 1000000000).toFixed(2)}B`);
        return cached.market_cap;
      }
    }
    
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      throw createConfigError('EODHD_API_TOKEN not configured');
    }
    
    // Try multiple ticker formats to handle delisted stocks
    const formatsToTry = [
      ticker, // Original format
      ticker.includes('.') ? ticker : `${ticker}.US`, // Add .US if not present
      ticker.includes('.DELISTED') ? ticker : `${ticker}.US.DELISTED` // Try delisted format
    ];
    
    // Remove duplicates
    const uniqueFormats = [...new Set(formatsToTry)];
    
    for (const formattedTicker of uniqueFormats) {
      try {
        logger.debug(`Fetching market cap from EODHD API for ${formattedTicker} on ${date}`);
        
        // Use EODHD market-capitalization endpoint
        const marketCapUrl = `https://eodhd.com/api/market-capitalization/${formattedTicker}?from=${date}&to=${date}&api_token=${EOD_API_KEY}&fmt=json`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.EODHD_API);
        
        const response = await fetch(marketCapUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 404) {
            logger.debug(`No market cap data found for ${formattedTicker} on ${date} (404)`);
            continue; // Try next format
          }
          throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || (Array.isArray(data) && data.length === 0)) {
          logger.debug(`No market cap data from API for ${formattedTicker} on ${date} (empty response)`);
          continue; // Try next format
        }
        
        // If we got here, we found data!
        if (formattedTicker !== ticker) {
          logger.info(`✅ Found delisted market cap data for ${ticker} using format: ${formattedTicker}`);
        }
        
        const dayData = Array.isArray(data) ? data[0] : data;
        
        // Check both possible field names for market cap
        const marketCapValue = dayData.MarketCapitalization || dayData.market_cap;
        if (dayData && marketCapValue) {
          const marketCap = marketCapValue;
          
          // Cache the result
          try {
            await cache.set(cacheKey, {
              ticker,
              date,
              market_cap: marketCap,
              format_used: formattedTicker,
              cached_at: new Date().toISOString()
            });
            logger.success(`Cached API market cap for ${ticker} ${date}: $${(marketCap / 1000000000).toFixed(2)}B`);
          } catch (cacheError) {
            logger.warn(`Failed to cache API market cap for ${ticker} ${date}`, cacheError);
          }
          
          return marketCap;
        }
        
      } catch (error) {
        logger.debug(`Failed to fetch market cap for ${formattedTicker}: ${error}`);
        continue; // Try next format
      }
    }
    
    // No data found for any format
    logger.debug(`No market cap data found for ${ticker} on ${date} (tried all formats)`);
    return null;
    
  } catch (error) {
    logger.debug(`Error getting market cap from API for ${ticker} on ${date}: ${error}`);
    return null;
  }
}