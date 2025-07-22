// api/_cacheUtils.ts
// Shared cache utility functions for ticker-based data caching

import { cache } from './_upstashCache';

// New ticker-based cache structure
export interface TickerYearData {
  price?: number;
  market_cap?: number;
  shares_outstanding?: number;
}

export interface TickerCacheData {
  [year: string]: TickerYearData;
}

// Cache utility functions for ticker-based structure
export async function getTickerFromCache(ticker: string): Promise<TickerCacheData | null> {
  try {
    const cacheKey = `ticker-data:${ticker}`;
    const cachedData = await cache.get(cacheKey);
    return cachedData as TickerCacheData | null;
  } catch (error) {
    console.error(`Error fetching ticker ${ticker} from cache:`, error);
    return null;
  }
}

export async function setTickerInCache(ticker: string, data: TickerCacheData): Promise<void> {
  try {
    const cacheKey = `ticker-data:${ticker}`;
    await cache.set(cacheKey, data); // Permanent cache for historical data
    console.log(`✅ Cached complete data for ${ticker} (${Object.keys(data).length} years)`);
  } catch (error) {
    console.error(`Error caching ticker ${ticker}:`, error);
  }
}

export async function listCachedTickers(): Promise<string[]> {
  try {
    const tickerKeys = await cache.keys('ticker-data:*');
    return tickerKeys.map(key => key.replace('ticker-data:', ''));
  } catch (error) {
    console.error('Error listing cached tickers:', error);
    return [];
  }
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
export async function getDataFromCache(tickers: string[]): Promise<{
  data: Record<string, TickerCacheData>;
  missing: string[];
}> {
  const data: Record<string, TickerCacheData> = {};
  const missing: string[] = [];
  
  console.log(`📊 GET DATA: Loading ${tickers.length} tickers from cache`);
  
  for (const ticker of tickers) {
    const cachedData = await getTickerFromCache(ticker);
    if (cachedData && Object.keys(cachedData).length > 0) {
      data[ticker] = cachedData;
      console.log(`   ✅ ${ticker}: Loaded ${Object.keys(cachedData).length} years`);
    } else {
      missing.push(ticker);
      console.log(`   ❌ ${ticker}: Not found in cache`);
    }
  }
  
  console.log(`📊 GET DATA COMPLETE: ${Object.keys(data).length} loaded, ${missing.length} missing`);
  return { data, missing };
}

// ETF detection helper
export function isETF(ticker: string): boolean {
  const etfTickers = new Set([
    'SPY', 'SPY.US',
    'QQQ', 'QQQ.US', 
    'IWM', 'IWM.US',
    'VTI', 'VTI.US',
    'EFA', 'EFA.US',
    'VEA', 'VEA.US',
    'EEM', 'EEM.US',
    'VWO', 'VWO.US',
    'AGG', 'AGG.US',
    'BND', 'BND.US',
    'TLT', 'TLT.US',
    'GLD', 'GLD.US',
    'VB', 'VB.US',
    'VTV', 'VTV.US',
    'VUG', 'VUG.US',
    'VXUS', 'VXUS.US'
  ]);
  
  return etfTickers.has(ticker) || etfTickers.has(`${ticker}.US`);
}

// Helper function to try fetching price data for a specific date
export async function tryFetchPriceForDate(ticker: string, date: string, apiToken: string): Promise<{
  date: string; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  adjusted_close: number; 
  volume: number;
} | null> {
  const eodUrl = `https://eodhd.com/api/eod/${ticker}?from=${date}&to=${date}&api_token=${apiToken}&fmt=json`;
  
  const response = await fetch(eodUrl);
  
  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Check if we got data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null; // No data for this date
  }
  
  const dayData = Array.isArray(data) ? data[0] : data;
  
  if (!dayData || !dayData.adjusted_close) {
    return null;
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
}

// Get split-adjusted price with fallback logic
export async function getSplitAdjustedPriceWithFallback(ticker: string, requestedDate: string, apiToken: string): Promise<{
  date: string; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  adjusted_close: number; 
  volume: number;
} | null> {
  // Try the exact date first
  try {
    const exactData = await tryFetchPriceForDate(ticker, requestedDate, apiToken);
    if (exactData) {
      return exactData;
    }
  } catch (error) {
    console.log(`Failed to fetch exact date ${requestedDate} for ${ticker}: ${error}`);
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
        console.log(`✅ Used fallback date ${fallbackDateStr} instead of ${requestedDate} for ${ticker}`);
        return fallbackData;
      }
    } catch (error) {
      // Continue trying next date
      continue;
    }
  }
  
  console.log(`❌ No price data found for ${ticker} around ${requestedDate} (tried exact date + 5 days forward)`);
  return null;
}

// Get valid US tickers (for delisted ticker detection)
export async function getValidUSTickers(bypassCache: boolean = false): Promise<{ active: Set<string>, delisted: Set<string> } | null> {
  try {
    const cacheKey = 'valid-us-tickers-complete-list';
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.active && cached.delisted) {
        console.log(`Cache hit for ticker lists: ${cached.active.length} active, ${cached.delisted.length} delisted`);
        return {
          active: new Set(cached.active),
          delisted: new Set(cached.delisted)
        };
      }
    }
    
    console.log('Fetching complete ticker list from EODHD...');
    
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    // Get exchange symbol list from EODHD
    const exchangeUrl = `https://eodhd.com/api/exchange-symbol-list/US?api_token=${EOD_API_KEY}&fmt=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
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
      await cache.set(cacheKey, cacheData, 86400); // Cache for 24 hours
      console.log(`✅ Cached ticker lists: ${active.size} active, ${delisted.size} delisted`);
    } catch (cacheError) {
      console.warn('Failed to cache ticker lists:', cacheError);
    }
    
    return { active, delisted };
    
  } catch (error) {
    console.error('Error fetching valid US tickers:', error);
    return null;
  }
}

// Get shares outstanding from fundamentals API
export async function getSharesOutstanding(ticker: string, date: string, apiToken: string): Promise<number | null> {
  try {
    
    // Convert date string to Date object to find the target year
    const targetDate = new Date(date);
    const targetYear = targetDate.getFullYear();
    
    console.log(`Fetching shares outstanding for ${ticker} as of ${date} (year: ${targetYear})`);
    
    // Use fundamentals API to get shares outstanding
    const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiToken}&fmt=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(fundamentalsUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`EODHD fundamentals API error for ${ticker}: ${response.status}`);
      return null;
    }
    
    const fundamentals = await response.json();
    
    if (!fundamentals) {
      console.log(`No fundamentals data for ${ticker}`);
      return null;
    }
    
    // Look for shares outstanding - EODHD provides this in multiple possible locations
    let sharesOutstanding: number | null = null;
    
    // Check SharesOutstanding in General section (most common location)
    if (fundamentals.General && fundamentals.General.SharesOutstanding) {
      sharesOutstanding = fundamentals.General.SharesOutstanding;
      console.log(`✅ Found shares outstanding in General.SharesOutstanding for ${ticker}: ${sharesOutstanding?.toLocaleString()}`);
    }
    
    // Fallback: Check in SharesStats section
    else if (fundamentals.SharesStats && fundamentals.SharesStats.SharesOutstanding) {
      sharesOutstanding = fundamentals.SharesStats.SharesOutstanding;
      console.log(`✅ Found shares outstanding in SharesStats.SharesOutstanding for ${ticker}: ${sharesOutstanding?.toLocaleString()}`);
    }
    
    // Another fallback: Check SharesOutstandingDate in General
    else if (fundamentals.General && fundamentals.General.SharesOutstandingDate) {
      sharesOutstanding = fundamentals.General.SharesOutstandingDate;
      console.log(`✅ Found shares outstanding in General.SharesOutstandingDate for ${ticker}: ${sharesOutstanding?.toLocaleString()}`);
    }
    
    if (!sharesOutstanding || sharesOutstanding <= 0) {
      console.log(`❌ No valid shares outstanding found for ${ticker} in fundamentals data`);
      return null;
    }
    
    return sharesOutstanding;
    
  } catch (error) {
    console.log(`Error fetching shares outstanding for ${ticker}: ${error}`);
    return null;
  }
}

// Get shares outstanding for a specific year
export async function getSharesOutstandingForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // ETFs don't have traditional shares outstanding in the same way as stocks
    if (isETF(ticker)) {
      console.log(`📊 Skipping shares outstanding for ETF ${ticker} - not applicable for ETFs`);
      return null;
    }
    
    // Use January 2nd to avoid New Year's Day holiday
    const startOfYearDate = `${year}-01-02`;
    const cacheKey = `shares-outstanding:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.shares_outstanding) {
        if (cacheStats) cacheStats.sharesOutstandingHits++;
        console.log(`Cache hit for shares outstanding ${ticker} ${year}: ${cached.shares_outstanding.toLocaleString()}`);
        return cached.shares_outstanding;
      }
    }
    
    if (cacheStats) cacheStats.sharesOutstandingMisses++;
    console.log(`Cache miss for shares outstanding ${ticker} ${year}, fetching from EODHD`);
    
    // Get API token
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
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
        console.log(`✅ Cached shares outstanding for ${ticker} ${year}: ${sharesOutstanding.toLocaleString()}`);
      } catch (cacheError) {
        console.warn(`Failed to cache shares outstanding for ${ticker} ${year}:`, cacheError);
      }
      
      return sharesOutstanding;
    }
    
    console.log(`❌ No shares outstanding data available for ${ticker} in ${year}`);
    return null;
    
  } catch (error) {
    console.error(`Error getting shares outstanding for ${ticker} in ${year}:`, error);
    return null;
  }
}

// Get adjusted price for a ticker at the start of a given year
export async function getAdjustedPriceForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // Use January 2nd to avoid New Year's Day holiday
    const startOfYearDate = `${year}-01-02`;
    const cacheKey = `adjusted-price:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.adjusted_close) {
        if (cacheStats) cacheStats.priceDataHits++;
        console.log(`Cache hit for adjusted price ${ticker} ${year}: $${cached.adjusted_close.toFixed(2)}`);
        return cached.adjusted_close;
      }
    }
    
    if (cacheStats) cacheStats.priceDataMisses++;
    console.log(`Cache miss for adjusted price ${ticker} ${year}, fetching from EODHD`);
    
    // Get API token
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
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
        console.log(`✅ Cached adjusted price for ${ticker} ${year}: $${priceData.adjusted_close.toFixed(2)} (actual date: ${priceData.date})`);
      } catch (cacheError) {
        console.warn(`Failed to cache adjusted price for ${ticker} ${year}:`, cacheError);
      }
      
      return priceData.adjusted_close;
    }
    
    console.log(`❌ No adjusted price data available for ${ticker} in ${year}`);
    return null;
    
  } catch (error) {
    console.error(`Error getting adjusted price for ${ticker} in ${year}:`, error);
    return null;
  }
}

// Get market cap directly from EODHD market-capitalization endpoint
export async function getMarketCapFromAPI(ticker: string, date: string, bypassCache: boolean = false): Promise<number | null> {
  try {
    const cacheKey = `market-cap-api:${ticker}:${date}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.market_cap) {
        console.log(`Cache hit for API market cap ${ticker} ${date}: $${(cached.market_cap / 1000000000).toFixed(2)}B`);
        return cached.market_cap;
      }
    }
    
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    // Add .US exchange suffix if not present
    const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    console.log(`Fetching market cap from EODHD API for ${tickerWithExchange} on ${date}`);
    
    // Use EODHD market-capitalization endpoint
    const marketCapUrl = `https://eodhd.com/api/market-capitalization/${tickerWithExchange}?from=${date}&to=${date}&api_token=${EOD_API_KEY}&fmt=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(marketCapUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`EODHD market cap API error for ${tickerWithExchange}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log(`No market cap data from API for ${tickerWithExchange} on ${date}`);
      return null;
    }
    
    // Get the first record (should be the requested date or closest available)
    const dayData = Array.isArray(data) ? data[0] : data;
    
    if (!dayData || !dayData.MarketCapitalization) {
      console.log(`No MarketCapitalization field in API response for ${tickerWithExchange}`);
      return null;
    }
    
    const marketCap = dayData.MarketCapitalization;
    
    // Cache the result
    try {
      await cache.set(cacheKey, {
        ticker,
        date: dayData.Date || date,
        market_cap: marketCap,
        source: 'eodhd_market_cap_api',
        cached_at: new Date().toISOString()
      });
      console.log(`✅ Cached API market cap for ${ticker} ${date}: $${(marketCap / 1000000000).toFixed(2)}B`);
    } catch (cacheError) {
      console.warn(`Failed to cache API market cap for ${ticker} ${date}:`, cacheError);
    }
    
    console.log(`✅ Got market cap from API for ${ticker} ${date}: $${(marketCap / 1000000000).toFixed(2)}B`);
    return marketCap;
    
  } catch (error) {
    console.log(`Error getting market cap from API for ${ticker} on ${date}:`, error);
    return null;
  }
}

// Get market cap for a ticker at the start of a given year
export async function getMarketCapForYear(ticker: string, year: number, bypassCache: boolean = false, cacheStats?: any): Promise<number | null> {
  try {
    // ETFs don't have market cap in the traditional sense - they track an index
    if (isETF(ticker)) {
      console.log(`📊 Skipping market cap calculation for ETF ${ticker} - not applicable for ETFs`);
      return null;
    }
    
    const cacheKey = `market-cap:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      if (cacheStats) cacheStats.totalCacheOperations++;
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.market_cap) {
        if (cacheStats) cacheStats.marketCapHits++;
        console.log(`Cache hit for market cap ${ticker} ${year}: $${(cached.market_cap / 1000000000).toFixed(2)}B`);
        return cached.market_cap;
      }
    }
    
    if (cacheStats) cacheStats.marketCapMisses++;
    console.log(`Cache miss for market cap ${ticker} ${year}, trying calculation from price × shares outstanding`);
    
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
        console.log(`✅ Cached calculated market cap for ${ticker} ${year}: $${(marketCap / 1000000000).toFixed(2)}B`);
      } catch (cacheError) {
        console.warn(`Failed to cache market cap for ${ticker} ${year}:`, cacheError);
      }
      
      console.log(`✅ Calculated market cap for ${ticker} ${year}: $${adjustedPrice.toFixed(2)} × ${sharesOutstanding.toLocaleString()} = $${(marketCap / 1000000000).toFixed(2)}B`);
      return marketCap;
    }
    
    // Fallback: Try market cap API for delisted or problematic stocks
    console.log(`⚠️ Cannot calculate market cap for ${ticker} ${year} (missing price or shares outstanding), trying market cap API fallback...`);
    
    // Check if the ticker is delisted
    const tickerLists = await getValidUSTickers(bypassCache);
    const isDelisted = tickerLists?.delisted.has(ticker) || tickerLists?.delisted.has(`${ticker}.US`);
    
    if (isDelisted) {
      console.log(`📅 ${ticker} is delisted, using market cap API as primary source`);
    } else {
      const missingData = [];
      if (!adjustedPrice) missingData.push('adjusted price');
      if (!sharesOutstanding) missingData.push('shares outstanding');
      console.log(`❌ ${ticker} ${year} missing ${missingData.join(' and ')}, trying market cap API as fallback`);
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
        console.log(`✅ Cached API market cap fallback for ${ticker} ${year}: $${(apiMarketCap / 1000000000).toFixed(2)}B`);
      } catch (cacheError) {
        console.warn(`Failed to cache API market cap fallback for ${ticker} ${year}:`, cacheError);
      }
      
      return apiMarketCap;
    }
    
    // If everything fails, log the error and return null
    const missingData = [];
    if (!adjustedPrice) missingData.push('adjusted price');
    if (!sharesOutstanding) missingData.push('shares outstanding');
    console.error(`🚨 COMPLETE FAILURE: ${ticker} ${year} - missing ${missingData.join(' and ')} AND market cap API returned no data`);
    
    return null;
    
  } catch (error) {
    console.error(`Error getting market cap for ${ticker} in ${year}:`, error);
    return null;
  }
}

// Fill cache function - populates cache with complete ticker histories
export async function fillCache(tickers: string[]): Promise<{
  success: string[];
  errors: Array<{ticker: string, error: string}>;
  warnings: Array<{ticker: string, year: string, issue: string}>;
}> {
  const results = {
    success: [] as string[],
    errors: [] as Array<{ticker: string, error: string}>,
    warnings: [] as Array<{ticker: string, year: string, issue: string}>
  };

  console.log(`🔄 FILL CACHE: Starting cache population for ${tickers.length} tickers`);
  
  // Get current year for date range
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear; // Up to current year
  const minYear = 2000; // Start from 2000
  
  for (const ticker of tickers) {
    try {
      console.log(`📈 Processing ${ticker}...`);
      
      // Check if already cached
      const existingData = await getTickerFromCache(ticker);
      if (existingData && Object.keys(existingData).length > 0) {
        console.log(`   ✅ ${ticker} already cached (${Object.keys(existingData).length} years)`);
        results.success.push(ticker);
        continue;
      }
      
      // Build complete ticker data
      const tickerData: TickerCacheData = {};
      
      for (let year = minYear; year <= maxYear; year++) {
        try {
          // Fetch all three data types for this year
          const [priceData, marketCap, sharesOutstanding] = await Promise.all([
            getAdjustedPriceForYear(ticker, year, false, null),
            getMarketCapForYear(ticker, year, false, null),
            getSharesOutstandingForYear(ticker, year, false, null)
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
          console.log(`   ⚠️ ${ticker} ${year}: ${yearError}`);
        }
      }
      
      // Save to cache if we got any data
      if (Object.keys(tickerData).length > 0) {
        await setTickerInCache(ticker, tickerData);
        results.success.push(ticker);
        console.log(`   ✅ ${ticker}: Cached ${Object.keys(tickerData).length} years of data`);
      } else {
        results.errors.push({
          ticker,
          error: 'No price data found for any year'
        });
        console.log(`   ❌ ${ticker}: No data available`);
      }
      
    } catch (tickerError) {
      results.errors.push({
        ticker,
        error: tickerError instanceof Error ? tickerError.message : String(tickerError)
      });
      console.log(`   ❌ ${ticker}: Failed to process - ${tickerError}`);
    }
  }
  
  console.log(`✅ FILL CACHE COMPLETE: ${results.success.length} success, ${results.errors.length} errors, ${results.warnings.length} warnings`);
  return results;
}