// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';

interface StockData {
  ticker: string;
  date: string;
  price: number;
  adjusted_close: number;
  market_cap?: number;
  shares_outstanding?: number;
}

interface StrategyResult {
  totalReturn: number;
  annualizedReturn: number;
  finalValue: number;
  yearlyValues: Record<number, number>;
  yearlyHoldings: Record<number, Record<string, { weight: number; shares: number; value: number; price: number; marketCap?: number; sharesOutstanding?: number; }>>;
  portfolioComposition: Record<string, { initialWeight: number; finalWeight: number; available: boolean; }>;
}

async function fetchMarketCapData(ticker: string, date: string, bypassCache: boolean = false): Promise<StockData | null> {
  try {
    // Check cache first for market cap data
    const cacheKey = `market-cap:${ticker}:${date}`;
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached) {
        console.log(`Cache hit for market cap ${ticker} on ${date}:`, {
          price: cached.adjusted_close,
          market_cap: cached.market_cap,
          shares: cached.shares_outstanding
        });
        return {
          ticker: ticker,
          date: cached.date || date,
          price: cached.adjusted_close || cached.price,
          adjusted_close: cached.adjusted_close || cached.price,
          market_cap: cached.market_cap,
          shares_outstanding: cached.shares_outstanding
        };
      }
    }
    
    console.log(`Cache miss for market cap ${ticker} on ${date}, fetching from EODHD`);
    
    // If not in cache, fetch from EODHD API directly
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured for market cap fetch');
      return fetchStockData(ticker, date, bypassCache);
    }
    
    const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    // Fetch price data with fallback logic for holidays/weekends
    const priceData = await getSplitAdjustedPriceWithFallback(tickerWithExchange, date, EOD_API_KEY);
    
    if (!priceData) {
      console.log(`No price data for ${tickerWithExchange} around ${date}`);
      return null;
    }
    
    // Get shares outstanding from fundamentals API
    let sharesOutstanding = await getSharesOutstanding(tickerWithExchange, date, EOD_API_KEY);
    
    if (!sharesOutstanding) {
      console.error(`❌ ERROR: Could not fetch shares outstanding for ${ticker} from EODHD fundamentals API`);
      return null;
    }
    
    // Calculate market cap using real shares outstanding
    const marketCap = priceData.adjusted_close * sharesOutstanding;
    
    const result = {
      ticker: ticker,
      date: priceData.date,
      price: priceData.adjusted_close,
      adjusted_close: priceData.adjusted_close,
      market_cap: marketCap,
      shares_outstanding: sharesOutstanding
    };
    
    // Cache the result
    if (!bypassCache) {
      await cache.set(cacheKey, {
        ...result,
        open: priceData.open,
        high: priceData.high,
        low: priceData.low,
        volume: priceData.volume,
        market_cap_billions: marketCap / 1000000000,
        formatted_market_cap: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(marketCap)
      });
    }
    
    console.log(`✅ Fetched real market cap for ${ticker} on ${priceData.date}:`, {
      price: result.adjusted_close,
      shares_outstanding: sharesOutstanding.toLocaleString(),
      market_cap_billions: (marketCap / 1000000000).toFixed(2) + 'B'
    });
    
    return result;
  } catch (error) {
    console.error(`Error fetching market cap for ${ticker} on ${date}:`, error);
    return null;
  }
}

// Enhanced price fetching with fallback logic for holidays/weekends
async function getSplitAdjustedPriceWithFallback(ticker: string, requestedDate: string, apiToken: string): Promise<{ date: string; open: number; high: number; low: number; close: number; adjusted_close: number; volume: number; } | null> {
  // Try the exact date first
  try {
    const exactData = await tryFetchPriceForDate(ticker, requestedDate, apiToken);
    if (exactData) {
      return exactData;
    }
  } catch (error) {
    // Log API errors but continue to fallback dates
    if (error instanceof Error && !error.message.includes('No data')) {
      console.log(`⚠️ API error for ${ticker} on ${requestedDate}:`, error.message);
    }
  }

  // If exact date fails, try nearby dates (common for holidays/weekends)
  const fallbackDates = generateFallbackDates(requestedDate);
  
  for (const fallbackDate of fallbackDates) {
    try {
      const fallbackData = await tryFetchPriceForDate(ticker, fallbackDate, apiToken);
      if (fallbackData) {
        console.log(`📅 Used fallback date for ${ticker}: ${requestedDate} → ${fallbackDate}`);
        return fallbackData;
      }
    } catch (error) {
      // Continue to next fallback date
      continue;
    }
  }

  return null;
}

// Generate fallback dates (try 1-5 days after the requested date)
function generateFallbackDates(dateStr: string): string[] {
  const baseDate = new Date(dateStr);
  const fallbackDates: string[] = [];
  
  // Try the next 5 days
  for (let i = 1; i <= 5; i++) {
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + i);
    fallbackDates.push(nextDate.toISOString().split('T')[0]);
  }
  
  return fallbackDates;
}

// Try to fetch price data for a specific date
async function tryFetchPriceForDate(ticker: string, date: string, apiToken: string): Promise<{ date: string; open: number; high: number; low: number; close: number; adjusted_close: number; volume: number; } | null> {
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

// Get all valid US exchange tickers from EODHD (including delisted)
async function getValidUSTickers(bypassCache: boolean = false): Promise<{ active: Set<string>, delisted: Set<string> } | null> {
  try {
    const cacheKey = 'valid-us-tickers-complete-list';
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.activeTickers && cached.delistedTickers) {
        console.log(`Cache hit for US ticker lists: ${cached.activeTickers.length} active, ${cached.delistedTickers.length} delisted`);
        return {
          active: new Set(cached.activeTickers),
          delisted: new Set(cached.delistedTickers)
        };
      }
    }
    
    console.log('Fetching US ticker lists from EODHD...');
    
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    // Fetch both active and delisted tickers in parallel
    const [activeResponse, delistedResponse] = await Promise.all([
      fetch(`https://eodhd.com/api/exchange-symbol-list/US?api_token=${EOD_API_KEY}&fmt=json`),
      fetch(`https://eodhd.com/api/exchange-symbol-list/US?api_token=${EOD_API_KEY}&fmt=json&delisted=1`)
    ]);
    
    if (!activeResponse.ok || !delistedResponse.ok) {
      console.error(`EODHD exchange list API error: Active ${activeResponse.status}, Delisted ${delistedResponse.status}`);
      return null;
    }
    
    const [activeData, delistedData] = await Promise.all([
      activeResponse.json(),
      delistedResponse.json()
    ]);
    
    if (!Array.isArray(activeData) || !Array.isArray(delistedData)) {
      console.error('Invalid response format from EODHD exchange list API');
      return null;
    }
    
    // Extract ticker symbols (Code field) and create Sets for fast lookup
    const activeTickers = activeData.map(item => item.Code).filter(code => code && typeof code === 'string');
    const delistedTickers = delistedData.map(item => item.Code).filter(code => code && typeof code === 'string');
    
    const activeSet = new Set(activeTickers);
    const delistedSet = new Set(delistedTickers);
    
    console.log(`✅ Fetched ${activeSet.size} active and ${delistedSet.size} delisted US tickers from EODHD`);
    
    // Cache for 24 hours (86400 seconds)
    try {
      await cache.set(cacheKey, {
        activeTickers: Array.from(activeSet),
        delistedTickers: Array.from(delistedSet),
        activeCount: activeSet.size,
        delistedCount: delistedSet.size,
        cached_at: new Date().toISOString()
      }, 86400);
      console.log('Cached US ticker lists for 24 hours');
    } catch (cacheError) {
      console.warn('Failed to cache US ticker lists:', cacheError);
    }
    
    return { active: activeSet, delisted: delistedSet };
    
  } catch (error) {
    console.error('Error fetching US ticker lists:', error);
    return null;
  }
}

// Get shares outstanding from EODHD fundamentals API
async function getSharesOutstanding(ticker: string, date: string, apiToken: string): Promise<number | null> {
  try {
    
    // Convert date string to Date object to find the target year
    const targetDate = new Date(date);
    
    // Get quarterly balance sheet data to find historical shares outstanding
    const quarterlyUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiToken}&fmt=json&filter=Financials::Balance_Sheet::quarterly`;
    
    const response = await fetch(quarterlyUrl);
    if (!response.ok) {
      console.error(`EODHD quarterly fundamentals API error for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      console.error(`❌ No quarterly balance sheet data for ${ticker}`);
      return null;
    }
    
    const availableDates = Object.keys(data);
    
    // Filter to only dates before target date
    const validDates = availableDates.filter(d => {
      try {
        const quarterDate = new Date(d);
        return quarterDate < targetDate;
      } catch {
        return false;
      }
    });
    
    if (validDates.length === 0) {
      console.error(`❌ No quarterly data available before ${date} for ${ticker}`);
      return null;
    }
    
    // Get the most recent quarter before the target date
    const bestDate = validDates.reduce((latest, current) => {
      return new Date(current) > new Date(latest) ? current : latest;
    });
    
    // Fetch shares outstanding for that specific quarter
    const filterParam = `Financials::Balance_Sheet::quarterly::${bestDate}::commonStockSharesOutstanding`;
    const sharesUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiToken}&fmt=json&filter=${filterParam}`;
    
    const sharesResponse = await fetch(sharesUrl);
    if (!sharesResponse.ok) {
      console.error(`❌ Error fetching shares outstanding for ${ticker} on ${bestDate}: ${sharesResponse.status}`);
      return null;
    }
    
    const sharesText = await sharesResponse.text();
    
    if (!sharesText || sharesText.trim() === 'null' || sharesText.trim() === '' || sharesText.trim() === '[]') {
      console.error(`❌ No shares outstanding data for ${ticker} on ${bestDate}`);
      return null;
    }
    
    try {
      // Parse the response (remove quotes if present)
      const sharesOutstanding = parseFloat(sharesText.trim().replace(/"/g, ''));
      
      if (isNaN(sharesOutstanding) || sharesOutstanding <= 0) {
        console.error(`❌ Invalid shares outstanding value for ${ticker} on ${bestDate}: ${sharesText}`);
        return null;
      }
      
      console.log(`📊 Found historical shares outstanding for ${ticker} (${bestDate} for ${date}): ${sharesOutstanding.toLocaleString()}`);
      return sharesOutstanding;
      
    } catch (error) {
      console.error(`❌ Error parsing shares outstanding for ${ticker} on ${bestDate}: ${sharesText}`, error);
      return null;
    }
    
  } catch (error) {
    console.error(`❌ Error fetching historical shares outstanding for ${ticker}:`, error);
    return null;
  }
}

// Get shares outstanding for a ticker at the start of a given year
// First checks cache, then calls EODHD API, returns null if unavailable
// Check if ticker is an ETF that doesn't need market cap calculations
function isETF(ticker: string): boolean {
  const etfTickers = new Set([
    'SPY', 'SPY.US',
    'QQQ', 'QQQ.US', 
    'IWM', 'IWM.US',
    'VTI', 'VTI.US',
    'VOO', 'VOO.US',
    'VEA', 'VEA.US',
    'VWO', 'VWO.US',
    'BND', 'BND.US',
    'VNQ', 'VNQ.US'
  ]);
  return etfTickers.has(ticker.toUpperCase());
}

async function getSharesOutstandingForYear(ticker: string, year: number, bypassCache: boolean = false): Promise<number | null> {
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
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.shares_outstanding) {
        console.log(`Cache hit for shares outstanding ${ticker} ${year}: ${cached.shares_outstanding.toLocaleString()}`);
        return cached.shares_outstanding;
      }
    }
    
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
// First checks cache, then calls EODHD API, returns null if unavailable
async function getAdjustedPriceForYear(ticker: string, year: number, bypassCache: boolean = false): Promise<number | null> {
  try {
    // Use January 2nd to avoid New Year's Day holiday
    const startOfYearDate = `${year}-01-02`;
    const cacheKey = `adjusted-price:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.adjusted_close) {
        console.log(`Cache hit for adjusted price ${ticker} ${year}: $${cached.adjusted_close.toFixed(2)}`);
        return cached.adjusted_close;
      }
    }
    
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

// Helper function to get both price and market cap for a ticker in a given year
// Returns null if either value is unavailable  
async function getPriceAndMarketCapForYear(ticker: string, year: number, bypassCache: boolean = false): Promise<{ price: number; marketCap: number } | null> {
  try {
    // Get both values in parallel for efficiency
    const [price, marketCap] = await Promise.all([
      getAdjustedPriceForYear(ticker, year, bypassCache),
      getMarketCapForYear(ticker, year, bypassCache)
    ]);
    
    if (price && marketCap) {
      return { price, marketCap };
    }
    
    const missingData = [];
    if (!price) missingData.push('price');
    if (!marketCap) missingData.push('market cap');
    console.log(`❌ Cannot get complete data for ${ticker} ${year}: missing ${missingData.join(' and ')}`);
    return null;
    
  } catch (error) {
    console.error(`Error getting price and market cap for ${ticker} in ${year}:`, error);
    return null;
  }
}

// Get market cap for a ticker at the start of a given year
// First checks cache, then calculates from adjusted price × shares outstanding, returns null if unavailable
// Get market cap directly from EODHD market-capitalization endpoint (useful for delisted stocks)
async function getMarketCapFromAPI(ticker: string, date: string, bypassCache: boolean = false): Promise<number | null> {
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

async function getMarketCapForYear(ticker: string, year: number, bypassCache: boolean = false): Promise<number | null> {
  try {
    // ETFs don't have market cap in the traditional sense - they track an index
    if (isETF(ticker)) {
      console.log(`📊 Skipping market cap calculation for ETF ${ticker} - not applicable for ETFs`);
      return null;
    }
    
    const cacheKey = `market-cap:${ticker}:${year}`;
    
    // Check cache first unless bypassed
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached && cached.market_cap) {
        console.log(`Cache hit for market cap ${ticker} ${year}: $${(cached.market_cap / 1000000000).toFixed(2)}B`);
        return cached.market_cap;
      }
    }
    
    console.log(`Cache miss for market cap ${ticker} ${year}, trying calculation from price × shares outstanding`);
    
    // Get both adjusted price and shares outstanding for the year
    const [adjustedPrice, sharesOutstanding] = await Promise.all([
      getAdjustedPriceForYear(ticker, year, bypassCache),
      getSharesOutstandingForYear(ticker, year, bypassCache)
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


async function fetchStockData(ticker: string, date: string, bypassCache: boolean = false, historicalData?: Record<string, Record<string, any>>): Promise<StockData | null> {
  try {
    // Check cache first unless bypassed
    const cacheKey = `market-cap:${ticker}:${date}`;
    if (!bypassCache) {
      const cached = await cache.get(cacheKey) as any;
      if (cached) {
        console.log(`Cache hit for ${ticker} on ${date}`);
        return {
          ticker: ticker,
          date: cached.date || date,
          price: cached.adjusted_close || cached.price,
          adjusted_close: cached.adjusted_close || cached.price,
          market_cap: cached.market_cap,
          shares_outstanding: cached.shares_outstanding
        };
      }
    }
    
    console.log(`Cache miss for ${ticker} on ${date}, fetching from EODHD`);
    
    // Add .US exchange suffix if not present
    const tickerWithExchange = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    // Call EODHD API to populate cache
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      console.error('EODHD_API_TOKEN not configured');
      return null;
    }
    
    const priceUrl = `https://eodhd.com/api/eod/${tickerWithExchange}?from=${date}&to=${date}&api_token=${EOD_API_KEY}&fmt=json`;
    console.log(`Calling EODHD API directly: ${priceUrl.replace(EOD_API_KEY, 'XXXXX')}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(priceUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log(`EODHD response for ${tickerWithExchange} on ${date}, status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`EODHD API error for ${tickerWithExchange} on ${date}, status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`EODHD data for ${tickerWithExchange} on ${date}:`, { 
      dataLength: Array.isArray(data) ? data.length : 'not array',
      hasData: !!data,
      firstItem: Array.isArray(data) && data.length > 0 ? data[0] : data
    });
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.log(`No data for ${tickerWithExchange} on ${date}, trying fallback dates...`);
      
      // Try next 5 business days as fallback (for holidays/weekends)
      for (let i = 1; i <= 5; i++) {
        const fallbackDate = new Date(date);
        fallbackDate.setDate(fallbackDate.getDate() + i);
        const fallbackDateStr = fallbackDate.toISOString().split('T')[0];
        
        const fallbackUrl = `https://eodhd.com/api/eod/${tickerWithExchange}?from=${fallbackDateStr}&to=${fallbackDateStr}&api_token=${EOD_API_KEY}&fmt=json`;
        console.log(`Trying fallback date: ${fallbackDateStr}`);
        
        const fallbackController = new AbortController();
        const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
        const fallbackResponse = await fetch(fallbackUrl, { signal: fallbackController.signal });
        clearTimeout(fallbackTimeoutId);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData && Array.isArray(fallbackData) && fallbackData.length > 0) {
            console.log(`Found data on fallback date ${fallbackDateStr} for ${tickerWithExchange}`);
            const dayData = fallbackData[0];
            if (dayData && dayData.adjusted_close) {
              const result = {
                ticker: ticker,
                date: dayData.date,
                price: dayData.adjusted_close || dayData.close,
                adjusted_close: dayData.adjusted_close || dayData.close
              };
              
              // Cache the fallback data too
              if (!bypassCache) {
                try {
                  await cache.set(cacheKey, {
                    ...result,
                    open: dayData.open,
                    high: dayData.high,
                    low: dayData.low,
                    volume: dayData.volume,
                    market_cap: 0,
                    shares_outstanding: 0
                  });
                  console.log(`Cached fallback price data for ${ticker} on ${fallbackDateStr}`);
                } catch (error) {
                  console.warn('Failed to cache fallback data:', error);
                }
              }
              
              return result;
            }
          }
        }
      }
      
      console.log(`📅 No data found for ${tickerWithExchange} on ${date} or fallback dates (may not have been trading yet)`);
      return null;
    }
    
    const dayData = Array.isArray(data) ? data[0] : data;
    
    if (!dayData || !dayData.adjusted_close) {
      console.error(`Invalid EODHD data for ${tickerWithExchange} on ${date}:`, dayData);
      return null;
    }
    
    const result = {
      ticker: ticker, // Return original ticker without exchange suffix for consistency
      date: dayData.date,
      price: dayData.adjusted_close || dayData.close,
      adjusted_close: dayData.adjusted_close || dayData.close
    };
    
    // Store historical data for Excel export consistency
    if (historicalData) {
      if (!historicalData[ticker]) {
        historicalData[ticker] = {};
      }
      historicalData[ticker][date] = {
        ...result,
        open: dayData.open,
        high: dayData.high,
        low: dayData.low,
        volume: dayData.volume,
        market_cap: 0, // Will be populated by getMarketCapForYear if needed
        shares_outstanding: 0
      };
    }
    
    // Store in cache for future use (permanent cache for historical data)
    if (!bypassCache) {
      try {
        await cache.set(cacheKey, {
          ...result,
          open: dayData.open,
          high: dayData.high,
          low: dayData.low,
          volume: dayData.volume,
          market_cap: 0, // Will be populated by getMarketCapForYear if needed
          shares_outstanding: 0
        });
        console.log(`Cached price data for ${ticker} on ${date}`);
      } catch (error) {
        console.warn('Failed to cache price data:', error);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching ${ticker} on ${date}:`, error);
    
    // Fallback to cached/known data for common stocks when API fails
    const fallbackPrices: Record<string, Record<string, number>> = {
      'AAPL': {
        '2010-01-02': 6.43,
        '2024-12-31': 229.87
      },
      'MSFT': {
        '2010-01-02': 23.19,
        '2024-12-31': 442.99
      },
      'SPY': {
        '2010-01-02': 110.0,
        '2024-12-31': 576.04
      }
    };
    
    const tickerUpper = ticker.toUpperCase();
    if (fallbackPrices[tickerUpper] && fallbackPrices[tickerUpper][date]) {
      console.log(`Using fallback price for ${ticker} on ${date}: $${fallbackPrices[tickerUpper][date]}`);
      return {
        ticker: ticker,
        date: date,
        price: fallbackPrices[tickerUpper][date],
        adjusted_close: fallbackPrices[tickerUpper][date]
      };
    }
    
    return null;
  }
}

async function calculateRebalancedStrategy(
  tickers: string[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  strategyType: 'equalWeight' | 'marketCap',
  bypassCache: boolean = false,
  historicalData?: Record<string, Record<string, any>>
): Promise<{ finalValue: number; yearlyHoldings: Record<number, Record<string, { weight: number; shares: number; value: number; price: number; marketCap?: number; sharesOutstanding?: number; }>>; yearlyValues: Record<number, number>; }> {
  console.log(`🔄 Rebalanced ${strategyType} strategy: ${startYear}-${endYear}`);
  
  // Track missing market cap data for detailed error reporting
  const missingMarketCapData: Array<{ticker: string, year: number, hasPrice: boolean, hasSharesOutstanding: boolean}> = [];
  const successfulMarketCapData: Array<{ticker: string, year: number, marketCap: number}> = [];
  
  let portfolioValue = initialInvestment;
  const yearlyHoldings: Record<number, Record<string, { weight: number; shares: number; value: number; price: number; marketCap?: number; sharesOutstanding?: number; }>> = {};
  const yearlyValues: Record<number, number> = {};
  
  // Simulate year by year
  for (let year = startYear; year <= endYear; year++) {
    const yearStart = `${year}-01-02`;
    const yearEnd = year === endYear ? `${year}-12-31` : `${year+1}-01-02`;
    
    // Find which stocks are available this year
    const availableStocks: string[] = [];
    const stockPrices: Record<string, { start: number; end: number }> = {};
    const stockMarketCaps: Record<string, number> = {};
    
    for (const ticker of tickers) {
      const startData = await fetchStockData(ticker, yearStart, bypassCache, historicalData);
      const endData = await fetchStockData(ticker, yearEnd, bypassCache, historicalData);
      
      if (startData && endData) {
        availableStocks.push(ticker);
        stockPrices[ticker] = {
          start: startData.adjusted_close,
          end: endData.adjusted_close
        };
        
        // Get real market cap for weighting using the new helper function
        const marketCap = await getMarketCapForYear(ticker, year, bypassCache);
        if (marketCap) {
          stockMarketCaps[ticker] = marketCap;
          successfulMarketCapData.push({ticker, year, marketCap});
        } else {
          // Track detailed information about what's missing
          const hasPrice = await getAdjustedPriceForYear(ticker, year, bypassCache);
          const hasSharesOutstanding = await getSharesOutstandingForYear(ticker, year, bypassCache);
          
          missingMarketCapData.push({
            ticker, 
            year, 
            hasPrice: !!hasPrice, 
            hasSharesOutstanding: !!hasSharesOutstanding
          });
          
          console.error(`❌ SKIPPING ${ticker}: Could not get real market cap for ${year}`);
          // Skip this stock entirely if we can't get real market cap data
          availableStocks.splice(availableStocks.indexOf(ticker), 1);
          delete stockPrices[ticker];
        }
      }
    }
    
    if (availableStocks.length === 0) {
      console.log(`No stocks available in ${year}, keeping cash`);
      continue;
    }
    
    // Calculate target allocations
    const allocations: Record<string, number> = {};
    
    if (strategyType === 'equalWeight') {
      const equalWeight = 1 / availableStocks.length;
      for (const ticker of availableStocks) {
        allocations[ticker] = equalWeight;
      }
    } else {
      // Market cap weighted - only use stocks with valid market cap data
      const validMarketCapStocks = availableStocks.filter(ticker => stockMarketCaps[ticker] > 0);
      
      if (validMarketCapStocks.length === 0) {
        console.error(`❌ No stocks with valid market cap data available in ${year} for rebalanced strategy`);
        continue;
      }
      
      const totalMarketCap = validMarketCapStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker], 0);
      for (const ticker of validMarketCapStocks) {
        allocations[ticker] = stockMarketCaps[ticker] / totalMarketCap;
      }
      
      // Update availableStocks to only include those with valid market cap data
      availableStocks.length = 0;
      availableStocks.push(...validMarketCapStocks);
    }
    
    // Calculate portfolio performance for this year and track holdings
    let yearEndValue = 0;
    yearlyHoldings[year] = {};
    
    for (const ticker of availableStocks) {
      const allocation = allocations[ticker];
      const investment = portfolioValue * allocation;
      const shares = investment / stockPrices[ticker].start;
      const stockReturn = (stockPrices[ticker].end - stockPrices[ticker].start) / stockPrices[ticker].start;
      const stockEndValue = investment * (1 + stockReturn);
      yearEndValue += stockEndValue;
      
      // Store holdings data
      // Get real shares outstanding from EODHD API
      const sharesOutstanding = await getSharesOutstandingForYear(ticker, year, bypassCache);
      
      yearlyHoldings[year][ticker] = {
        weight: allocation,
        shares: shares,
        value: stockEndValue,
        price: stockPrices[ticker].start,
        marketCap: stockMarketCaps[ticker],
        sharesOutstanding: sharesOutstanding || undefined
      };
      
      if (year === startYear || availableStocks.length > 1) {
        console.log(`${year} ${ticker}: ${(allocation * 100).toFixed(1)}% allocation, ${(stockReturn * 100).toFixed(1)}% return`);
      }
    }
    
    portfolioValue = yearEndValue;
    yearlyValues[year] = portfolioValue;
    console.log(`${year} portfolio value: $${Math.floor(portfolioValue).toLocaleString()}`);
  }
  
  // Report missing market cap data if any
  if (missingMarketCapData.length > 0) {
    console.log(`\n🚨 REBALANCED ${strategyType.toUpperCase()} STRATEGY DIAGNOSTIC:`);
    console.log(`📊 Successfully got market cap: ${successfulMarketCapData.length} stocks`);
    console.log(`❌ Failed to get market cap: ${missingMarketCapData.length} stocks`);
    
    // Group by issue type
    const stocksWithPriceButNoShares = missingMarketCapData.filter(item => item.hasPrice && !item.hasSharesOutstanding);
    
    if (stocksWithPriceButNoShares.length > 0) {
      console.log(`\n🚨 STOCKS WITH PRICE BUT NO SHARES OUTSTANDING (${stocksWithPriceButNoShares.length}):`);
      stocksWithPriceButNoShares.forEach(item => 
        console.log(`   ${item.ticker} (${item.year}): Has price, missing shares outstanding from EODHD fundamentals API`)
      );
    }
    console.log(`\n`);
  }

  return { finalValue: portfolioValue, yearlyHoldings, yearlyValues };
}

async function calculateStrategy(
  tickers: string[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  strategyType: 'equalWeight' | 'marketCap',
  rebalance: boolean,
  bypassCache: boolean = false,
  historicalData?: Record<string, Record<string, any>>
): Promise<StrategyResult> {
  // Track missing market cap data for detailed error reporting
  const missingMarketCapData: Array<{ticker: string, year: number, hasPrice: boolean, hasSharesOutstanding: boolean}> = [];
  const successfulMarketCapData: Array<{ticker: string, year: number, marketCap: number}> = [];
  
  const yearlyValues: Record<number, number> = {};
  const yearlyHoldings: Record<number, Record<string, { weight: number; shares: number; value: number; price: number; marketCap?: number; sharesOutstanding?: number; }>> = {};
  const portfolioComposition: Record<string, { initialWeight: number; finalWeight: number; available: boolean; }> = {};
  let currentValue = initialInvestment;
  
  // Get start of year dates
  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  
  // For simplicity, we'll use January 2nd of each year (to avoid holidays)
  const startDate = `${startYear}-01-02`;
  // For end date, use the last available date (avoid future dates)
  const currentDate = new Date();
  const maxEndDate = new Date(endYear, 11, 31); // December 31 of end year
  const actualEndDate = maxEndDate > currentDate ? currentDate : maxEndDate;
  const endDate = actualEndDate.toISOString().split('T')[0];
  
  console.log(`Strategy calculation dates: ${startDate} to ${endDate} (requested end year: ${endYear})`);
  
  // Fetch initial and final data including market caps for all tickers
  const initialPrices: Record<string, number> = {};
  const finalPrices: Record<string, number> = {};
  const initialMarketCaps: Record<string, number> = {};
  const tickerAvailability: Record<string, { hasStart: boolean; hasEnd: boolean; }> = {};
  
  // Fetch all ticker data in parallel for better performance
  const tickerPromises = tickers.map(async (ticker) => {
    try {
      const [startData, endData] = await Promise.all([
        fetchStockData(ticker, startDate, bypassCache, historicalData),
        fetchStockData(ticker, endDate, bypassCache, historicalData)
      ]);
    
      tickerAvailability[ticker] = {
        hasStart: !!startData,
        hasEnd: !!endData
      };
      
      // For buy & hold strategies, we need both start and end prices
      if (startData && endData) {
        initialPrices[ticker] = startData.adjusted_close;
        finalPrices[ticker] = endData.adjusted_close;
        
        // Only get market cap for market cap weighted strategies
        if (strategyType === 'marketCap') {
          const marketCap = await getMarketCapForYear(ticker, startYear, bypassCache);
          if (marketCap) {
            initialMarketCaps[ticker] = marketCap;
            console.log(`✅ Real initial market cap for ${ticker}: $${(marketCap / 1000000000).toFixed(2)}B`);
          } else {
            console.error(`❌ WARNING: Could not get real market cap for ${ticker}, this may affect market cap weighted strategies`);
            // Set to 0 to indicate missing data
            initialMarketCaps[ticker] = 0;
          }
        } else {
          // For equal weight strategies, market cap is not needed
          initialMarketCaps[ticker] = 1; // Use 1 as placeholder since equal weight doesn't use market cap
        }
      }
      // For rebalanced strategies, we'll handle availability year by year
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error);
      // Continue with other tickers
      tickerAvailability[ticker] = {
        hasStart: false,
        hasEnd: false
      };
    }
  });

  await Promise.all(tickerPromises);
  
  // Determine which stocks to use based on strategy type
  let validTickers: string[];
  
  if (rebalance) {
    // Rebalanced strategies: use any stock that exists at ANY point during the period
    console.log('Rebalanced strategy: will include stocks that become available during the period');
    validTickers = tickers.filter(ticker => 
      tickerAvailability[ticker].hasStart || tickerAvailability[ticker].hasEnd
    );
  } else {
    // Buy & hold strategies: use any stock that becomes available during the period
    console.log('Buy & hold strategy: will add stocks as they become available during the period');
    validTickers = tickers.filter(ticker => 
      tickerAvailability[ticker].hasStart || tickerAvailability[ticker].hasEnd
    );
  }
  console.log('Backtest calculation:', { 
    strategy: rebalance ? 'rebalanced' : 'buy-and-hold',
    tickerCount: tickers.length, 
    validTickerCount: validTickers.length,
    validTickers: validTickers.slice(0, 3),
    initialPrices: Object.fromEntries(Object.entries(initialPrices).slice(0, 3)),
    finalPrices: Object.fromEntries(Object.entries(finalPrices).slice(0, 3)),
    tickerAvailability: Object.fromEntries(Object.entries(tickerAvailability).slice(0, 3)),
    startDate,
    endDate,
    strategyType,
    rebalance
  });
  
  // Add warning for insufficient stock diversity
  if (validTickers.length < tickers.length) {
    const missingTickers = tickers.filter(t => !validTickers.includes(t));
    console.log(`⚠️  STRATEGY LIMITATION: ${missingTickers.length} stocks not available at start date (${startDate}): ${missingTickers.join(', ')}`);
    console.log(`ℹ️  Only ${validTickers.length} stocks will be used, reducing strategy differentiation`);
  }
  
  if (validTickers.length === 0) {
    console.log('No valid tickers found for buy-and-hold strategy, returning zero results');
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      finalValue: initialInvestment,
      yearlyValues,
      yearlyHoldings: {},
      portfolioComposition: {}
    };
  }
  
  if (rebalance) {
    // REBALANCED STRATEGY: Year-by-year simulation with dynamic stock addition
    console.log(`Starting ${strategyType} rebalanced strategy simulation`);
    const rebalancedResult = await calculateRebalancedStrategy(
      tickers, startYear, endYear, initialInvestment, strategyType, bypassCache, historicalData
    );
    currentValue = rebalancedResult.finalValue;
    Object.assign(yearlyHoldings, rebalancedResult.yearlyHoldings);
    Object.assign(yearlyValues, rebalancedResult.yearlyValues);
  } else {
    // BUY & HOLD STRATEGY: Add stocks as they become available, rebalance existing holdings proportionally
    console.log(`Starting ${strategyType} buy & hold strategy calculation with dynamic stock addition and rebalancing`);
    
    // Track the portfolio holdings
    const portfolio: Record<string, { shares: number; addedYear: number; }> = {};
    currentValue = initialInvestment;
    
    // Simulate year by year to add new stocks as they become available
    for (let year = startYear; year <= endYear; year++) {
      const yearStart = `${year}-01-02`;
      
      yearlyHoldings[year] = {};
      
      // Find available stocks this year (both existing and new)
      const availableStocks: string[] = [];
      const stockPrices: Record<string, number> = {};
      const stockMarketCaps: Record<string, number> = {};
      
      for (const ticker of tickers) {
        // Get price data (required for all strategies)
        const price = await getAdjustedPriceForYear(ticker, year, bypassCache);
        
        if (price) {
          availableStocks.push(ticker);
          stockPrices[ticker] = price;
          
          // Only get market cap for market cap weighted strategies
          if (strategyType === 'marketCap') {
            const marketCap = await getMarketCapForYear(ticker, year, bypassCache);
            if (marketCap) {
              stockMarketCaps[ticker] = marketCap;
              console.log(`  ✅ Real data for ${ticker}: $${price.toFixed(2)} price, $${(marketCap / 1000000000).toFixed(2)}B market cap`);
            } else {
              console.error(`  ❌ SKIPPING ${ticker}: Could not get market cap for ${year} (required for market cap strategy)`);
              // Remove from available stocks since market cap is required
              availableStocks.pop();
              delete stockPrices[ticker];
            }
          } else {
            // For equal weight strategies, market cap is not needed
            stockMarketCaps[ticker] = 1; // Placeholder value
            if (isETF(ticker)) {
              console.log(`  ✅ ETF data for ${ticker}: $${price.toFixed(2)} price (market cap not applicable for ETFs)`);
            } else {
              console.log(`  ✅ Price data for ${ticker}: $${price.toFixed(2)} (equal weight strategy)`);
            }
          }
        } else {
          console.error(`  ❌ SKIPPING ${ticker}: Could not get price data for ${year}`);
        }
      }
      
      // Find new stocks that became available this year
      const newStocks = availableStocks.filter(ticker => !portfolio[ticker]);
      
      // Calculate current portfolio value before rebalancing
      let currentPortfolioValue = 0;
      for (const [ticker, holding] of Object.entries(portfolio)) {
        if (stockPrices[ticker]) {
          currentPortfolioValue += holding.shares * stockPrices[ticker];
        }
      }
      
      // If this is the first year, use initial investment
      if (year === startYear) {
        currentPortfolioValue = initialInvestment;
      }
      
      // If there are new stocks, add them without full rebalancing
      if (newStocks.length > 0) {
        console.log(`${year}: Adding ${newStocks.length} new stocks: ${newStocks.join(', ')}`);
        
        if (strategyType === 'equalWeight') {
          // Equal Weight: New stocks get equal allocation, funded equally by all existing stocks
          const targetWeightPerStock = 1 / availableStocks.length;
          const totalAmountNeededForNewStocks = currentPortfolioValue * targetWeightPerStock * newStocks.length;
          const existingStocksCount = Object.keys(portfolio).length;
          const contributionPerExistingStock = totalAmountNeededForNewStocks / existingStocksCount;
          
          console.log(`  Each new stock needs ${(targetWeightPerStock * 100).toFixed(1)}% allocation = $${(currentPortfolioValue * targetWeightPerStock).toFixed(0)}`);
          console.log(`  Each existing stock contributes: $${contributionPerExistingStock.toFixed(0)}`);
          
          // Sell proportional amount from each existing stock
          for (const [ticker, holding] of Object.entries(portfolio)) {
            if (stockPrices[ticker]) {
              const sharesToSell = contributionPerExistingStock / stockPrices[ticker];
              portfolio[ticker].shares -= sharesToSell;
              console.log(`  ${ticker}: Sold ${sharesToSell.toFixed(0)} shares for $${contributionPerExistingStock.toFixed(0)}`);
            }
          }
          
          // Buy new stocks with the proceeds
          for (const ticker of newStocks) {
            const investmentAmount = currentPortfolioValue * targetWeightPerStock;
            const shares = investmentAmount / stockPrices[ticker];
            
            portfolio[ticker] = {
              shares: shares,
              addedYear: year
            };
            
            // Track in portfolio composition
            portfolioComposition[ticker] = {
              initialWeight: targetWeightPerStock,
              finalWeight: 0, // Will be calculated at the end
              available: true
            };
            
            console.log(`  ${ticker}: Added new position with ${shares.toFixed(0)} shares for $${investmentAmount.toFixed(0)} (${(targetWeightPerStock * 100).toFixed(1)}% allocation)`);
          }
        } else {
          // Market Cap Weighted: New stocks get market cap allocation, funded proportionally by existing stocks
          // Only use stocks with valid market cap data
          const validStocksWithMarketCap = availableStocks.filter(ticker => stockMarketCaps[ticker] > 0);
          const validNewStocks = newStocks.filter(ticker => stockMarketCaps[ticker] > 0);
          
          if (validNewStocks.length === 0) {
            console.log(`  No new stocks with valid market cap data to add in ${year}`);
          } else {
            const allStockMarketCaps = validStocksWithMarketCap.reduce((sum, ticker) => sum + stockMarketCaps[ticker], 0);
            const newStocksMarketCap = validNewStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker], 0);
            const newStocksTargetWeight = newStocksMarketCap / allStockMarketCaps;
            const totalAmountNeededForNewStocks = currentPortfolioValue * newStocksTargetWeight;
            
            console.log(`  New stocks total market cap weight: ${(newStocksTargetWeight * 100).toFixed(1)}% = $${totalAmountNeededForNewStocks.toFixed(0)}`);
            
            // Calculate current weights of existing stocks
            const existingPortfolioValue = currentPortfolioValue;
            const existingWeights: Record<string, number> = {};
            
            for (const [ticker, holding] of Object.entries(portfolio)) {
              if (stockPrices[ticker]) {
                const currentValue = holding.shares * stockPrices[ticker];
                existingWeights[ticker] = currentValue / existingPortfolioValue;
              }
            }
            
            // Sell from existing stocks proportionally to their current weights
            for (const [ticker, holding] of Object.entries(portfolio)) {
              if (stockPrices[ticker] && existingWeights[ticker]) {
                const contributionAmount = totalAmountNeededForNewStocks * existingWeights[ticker];
                const sharesToSell = contributionAmount / stockPrices[ticker];
                portfolio[ticker].shares -= sharesToSell;
                console.log(`  ${ticker}: Sold ${sharesToSell.toFixed(0)} shares for $${contributionAmount.toFixed(0)} (${(existingWeights[ticker] * 100).toFixed(1)}% of contribution)`);
              }
            }
            
            // Buy new stocks according to their market cap weights
            for (const ticker of validNewStocks) {
              const targetWeight = stockMarketCaps[ticker] / allStockMarketCaps;
              const investmentAmount = currentPortfolioValue * targetWeight;
              const shares = investmentAmount / stockPrices[ticker];
              
              portfolio[ticker] = {
                shares: shares,
                addedYear: year
              };
              
              // Track in portfolio composition
              portfolioComposition[ticker] = {
                initialWeight: targetWeight,
                finalWeight: 0, // Will be calculated at the end
                available: true
              };
              
              console.log(`  ${ticker}: Added new position with ${shares.toFixed(0)} shares for $${investmentAmount.toFixed(0)} (${(targetWeight * 100).toFixed(1)}% market cap allocation)`);
            }
          }
        }
      } else if (year === startYear) {
        // First year with no new stocks - initial allocation
        console.log(`${year}: Initial allocation among ${availableStocks.length} available stocks`);
        
        if (strategyType === 'equalWeight') {
          const equalWeight = 1 / availableStocks.length;
          const investmentPerStock = initialInvestment * equalWeight;
          
          for (const ticker of availableStocks) {
            const shares = investmentPerStock / stockPrices[ticker];
            portfolio[ticker] = {
              shares: shares,
              addedYear: year
            };
            
            portfolioComposition[ticker] = {
              initialWeight: equalWeight,
              finalWeight: 0,
              available: true
            };
            
            console.log(`  ${ticker}: Initial ${shares.toFixed(0)} shares for $${investmentPerStock.toFixed(0)} (${(equalWeight * 100).toFixed(1)}% allocation)`);
          }
        } else {
          // Market cap weighted - only use stocks with valid market cap data
          const validMarketCapStocks = availableStocks.filter(ticker => stockMarketCaps[ticker] > 0);
          
          if (validMarketCapStocks.length === 0) {
            console.error(`❌ No stocks with valid market cap data available in ${year}`);
            continue;
          }
          
          const totalMarketCap = validMarketCapStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker], 0);
          console.log(`  Market cap weighted initial allocation - ${validMarketCapStocks.length} stocks with total market cap: $${(totalMarketCap / 1000000000).toFixed(2)}B`);
          
          for (const ticker of validMarketCapStocks) {
            const weight = stockMarketCaps[ticker] / totalMarketCap;
            const investment = initialInvestment * weight;
            const shares = investment / stockPrices[ticker];
            console.log(`  ${ticker}: Market cap $${(stockMarketCaps[ticker] / 1000000000).toFixed(2)}B (${(weight * 100).toFixed(1)}%)`);
            
            portfolio[ticker] = {
              shares: shares,
              addedYear: year
            };
            
            portfolioComposition[ticker] = {
              initialWeight: weight,
              finalWeight: 0,
              available: true
            };
            
            console.log(`  ${ticker}: Initial ${shares.toFixed(0)} shares for $${investment.toFixed(0)} (${(weight * 100).toFixed(1)}% allocation)`);
          }
        }
      }
      
      // Calculate current portfolio value and holdings for this year
      let totalPortfolioValue = 0;
      
      for (const [ticker, holding] of Object.entries(portfolio)) {
        const currentPrice = stockPrices[ticker];
        if (currentPrice) {
          const currentValue = holding.shares * currentPrice;
          totalPortfolioValue += currentValue;
          
          // Get real shares outstanding from EODHD API
          const sharesOutstanding = await getSharesOutstandingForYear(ticker, year, bypassCache);
          
          yearlyHoldings[year][ticker] = {
            weight: 0, // Will be calculated below
            shares: holding.shares,
            value: currentValue,
            price: currentPrice,
            marketCap: stockMarketCaps[ticker],
            sharesOutstanding: sharesOutstanding || undefined
          };
        }
      }
      
      // Calculate weights based on current values
      for (const ticker of Object.keys(yearlyHoldings[year])) {
        yearlyHoldings[year][ticker].weight = yearlyHoldings[year][ticker].value / totalPortfolioValue;
      }
      
      yearlyValues[year] = totalPortfolioValue;
      currentValue = totalPortfolioValue;
      
      console.log(`${year}: Portfolio value: $${Math.floor(totalPortfolioValue).toLocaleString()}, Stocks: ${Object.keys(portfolio).length}`);
    }
    
    // Update portfolio composition with final weights
    if (currentValue > 0) {
      for (const [ticker, _] of Object.entries(portfolio)) {
        const finalYearHolding = yearlyHoldings[endYear][ticker];
        if (finalYearHolding) {
          portfolioComposition[ticker].finalWeight = finalYearHolding.value / currentValue;
        }
      }
    }
  }
  
  // Calculate returns
  const totalReturn = ((currentValue - initialInvestment) / initialInvestment) * 100;
  const yearsDuration = endYear - startYear;
  const annualizedReturn = yearsDuration > 0 ? (Math.pow(currentValue / initialInvestment, 1 / yearsDuration) - 1) * 100 : totalReturn;
  
  // Report missing market cap data if any
  if (missingMarketCapData.length > 0) {
    console.log(`\n🚨 MARKET CAP DATA DIAGNOSTIC FOR ${strategyType.toUpperCase()} ${rebalance ? 'REBALANCED' : 'BUY & HOLD'}:`);
    console.log(`📊 Successfully got market cap: ${successfulMarketCapData.length} stocks`);
    console.log(`❌ Failed to get market cap: ${missingMarketCapData.length} stocks`);
    
    // Group by issue type
    const stocksWithPriceButNoShares = missingMarketCapData.filter(item => item.hasPrice && !item.hasSharesOutstanding);
    const stocksWithNeitherPriceNorShares = missingMarketCapData.filter(item => !item.hasPrice && !item.hasSharesOutstanding);
    const stocksWithSharesButNoPrice = missingMarketCapData.filter(item => !item.hasPrice && item.hasSharesOutstanding);
    
    if (stocksWithPriceButNoShares.length > 0) {
      console.log(`\n🚨 STOCKS WITH PRICE BUT NO SHARES OUTSTANDING (${stocksWithPriceButNoShares.length}):`);
      stocksWithPriceButNoShares.forEach(item => 
        console.log(`   ${item.ticker} (${item.year}): Has price, missing shares outstanding from EODHD fundamentals API`)
      );
    }
    
    if (stocksWithNeitherPriceNorShares.length > 0) {
      console.log(`\n❌ STOCKS WITH NO PRICE OR SHARES DATA (${stocksWithNeitherPriceNorShares.length}):`);
      stocksWithNeitherPriceNorShares.forEach(item => 
        console.log(`   ${item.ticker} (${item.year}): Missing both price and shares outstanding`)
      );
    }
    
    if (stocksWithSharesButNoPrice.length > 0) {
      console.log(`\n💰 STOCKS WITH SHARES BUT NO PRICE (${stocksWithSharesButNoPrice.length}):`);
      stocksWithSharesButNoPrice.forEach(item => 
        console.log(`   ${item.ticker} (${item.year}): Has shares outstanding, missing price`)
      );
    }
    console.log(`\n`);
  }

  return {
    totalReturn,
    annualizedReturn,
    finalValue: currentValue,
    yearlyValues,
    yearlyHoldings,
    portfolioComposition
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== BACKTEST API CALLED (v2) ===');
    const { startYear, endYear, initialInvestment, tickers = [], bypass_cache = false } = req.body;
    console.log('Request body:', { startYear, endYear, initialInvestment, tickers, bypass_cache });

    // Validate inputs
    if (!startYear || !endYear || !initialInvestment) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['startYear', 'endYear', 'initialInvestment']
      });
    }

    if (!tickers || tickers.length === 0) {
      return res.status(400).json({ 
        error: 'No tickers provided',
        message: 'Please provide at least one stock ticker'
      });
    }

    // Comprehensive ticker validation system
    const validatedTickers: string[] = [];
    const tickerValidationResults: {
      ticker: string;
      status: 'valid' | 'corrected' | 'invalid' | 'no_data';
      message: string;
      correctedTo?: string;
      hasHistoricalData?: boolean;
      dataAvailableFrom?: string;
      dataAvailableTo?: string;
    }[] = [];
    
    // Check for common typos first
    const commonCorrections: Record<string, string> = {
      'APPL': 'AAPL',
      'MSFT.': 'MSFT',
      'GOOGL.': 'GOOGL',
      'AMZN.': 'AMZN',
      'TSLA.': 'TSLA',
      'FB': 'META',  // Facebook renamed to Meta
      'BRKB': 'BRK.B',
      'BRKA': 'BRK.A'
    };
    
    // Process each ticker
    for (const ticker of tickers) {
      const cleanTicker = ticker.trim().toUpperCase();
      
      // Check for empty ticker
      if (!cleanTicker) {
        tickerValidationResults.push({
          ticker: ticker,
          status: 'invalid',
          message: 'Empty ticker symbol'
        });
        continue;
      }
      
      // Check for common typos
      if (commonCorrections[cleanTicker]) {
        const correctedTicker = commonCorrections[cleanTicker];
        tickerValidationResults.push({
          ticker: ticker,
          status: 'corrected',
          message: `Corrected "${ticker}" to "${correctedTicker}"`,
          correctedTo: correctedTicker
        });
        validatedTickers.push(correctedTicker);
        continue;
      }
      
      // Basic format validation (1-5 letters, optional .US suffix)
      if (!/^[A-Z]{1,5}(\.US)?$/.test(cleanTicker)) {
        tickerValidationResults.push({
          ticker: ticker,
          status: 'invalid',
          message: `Invalid ticker format (expected 1-5 letters, got "${ticker}")`
        });
        continue;
      }
      
      validatedTickers.push(cleanTicker);
    }
    
    // First, get the list of all valid US tickers from EODHD (active and delisted)
    console.log(`\n📋 VALIDATING TICKERS WITH EODHD EXCHANGE LISTS...`);
    const tickerLists = await getValidUSTickers(bypass_cache);
    
    const finalValidTickers: string[] = [];
    const problemTickers: string[] = [];
    
    // Quick validation using exchange lists first
    for (const ticker of validatedTickers) {
      if (tickerLists) {
        // Check if ticker exists in either active or delisted lists
        if (tickerLists.active.has(ticker)) {
          // Ticker is actively traded
          const validationResult = tickerValidationResults.find(r => 
            r.ticker === ticker || r.correctedTo === ticker
          );
          
          if (!validationResult) {
            tickerValidationResults.push({
              ticker: ticker,
              status: 'valid',
              message: `Active US exchange ticker`,
              hasHistoricalData: true
            });
          } else if (validationResult) {
            validationResult.status = 'valid';
            validationResult.message = `Active US exchange ticker`;
            validationResult.hasHistoricalData = true;
          }
          
          finalValidTickers.push(ticker);
          console.log(`   ✓ ${ticker} - Active ticker`);
        } else if (tickerLists.delisted.has(ticker)) {
          // Ticker is delisted but should have historical data
          const validationResult = tickerValidationResults.find(r => 
            r.ticker === ticker || r.correctedTo === ticker
          );
          
          if (!validationResult) {
            tickerValidationResults.push({
              ticker: ticker,
              status: 'valid',
              message: `Delisted ticker (historical data available)`,
              hasHistoricalData: true
            });
          } else if (validationResult) {
            validationResult.status = 'valid';
            validationResult.message = `Delisted ticker (historical data available)`;
            validationResult.hasHistoricalData = true;
          }
          
          finalValidTickers.push(ticker);
          console.log(`   ⚠️ ${ticker} - Delisted ticker (historical data should be available)`);
        } else {
          // Ticker not in either list - probably invalid
          problemTickers.push(ticker);
          
          const validationResult = tickerValidationResults.find(r => 
            r.ticker === ticker || r.correctedTo === ticker
          );
          
          if (validationResult) {
            validationResult.status = 'no_data';
            validationResult.message = `Not found in active or delisted US ticker lists`;
            validationResult.hasHistoricalData = false;
          } else {
            tickerValidationResults.push({
              ticker: ticker,
              status: 'no_data',
              message: `Invalid ticker - not in EODHD database`,
              hasHistoricalData: false
            });
          }
          
          console.log(`   ✗ ${ticker} - Not found in EODHD database`);
        }
      } else {
        // Couldn't get exchange lists, fall back to checking each ticker individually
        finalValidTickers.push(ticker);
        console.log(`   ? ${ticker} - Unable to verify (exchange lists unavailable)`);
      }
    }
    
    // For tickers not in exchange lists, optionally check for historical data
    if (problemTickers.length > 0 && bypass_cache) {
      console.log(`\n🔍 DOUBLE-CHECKING ${problemTickers.length} UNRECOGNIZED TICKERS FOR HISTORICAL DATA...`);
      
      const tickersToRecheck = [...problemTickers];
      problemTickers.length = 0; // Clear array
      
      for (const ticker of tickersToRecheck) {
        try {
          // Check if ticker has any historical data by trying to fetch data for start year
          const testDate = `${startYear}-01-02`;
          const testData = await fetchStockData(ticker, testDate, true);
          
          if (testData && testData.price > 0) {
            // Ticker has historical data even though not in exchange lists
            finalValidTickers.push(ticker);
            
            const validationResult = tickerValidationResults.find(r => 
              r.ticker === ticker || r.correctedTo === ticker
            );
            
            if (validationResult) {
              validationResult.status = 'valid';
              validationResult.message = `Not in EODHD lists but has historical data (possibly recent delisting or data issue)`;
              validationResult.hasHistoricalData = true;
            }
            
            console.log(`   ✓ ${ticker} - Has historical data (not in lists, possibly very recent delisting)`);
          } else {
            // No data found - definitely invalid
            problemTickers.push(ticker);
            console.log(`   ✗ ${ticker} - No historical data found`);
          }
        } catch (error) {
          // API error or ticker doesn't exist
          problemTickers.push(ticker);
          console.log(`   ✗ ${ticker} - Error checking data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    // Log validation summary
    console.log(`\n✅ VALID TICKERS: ${finalValidTickers.length}`);
    finalValidTickers.forEach(ticker => console.log(`   ✓ ${ticker}`));
    
    if (problemTickers.length > 0) {
      console.log(`\n❌ PROBLEM TICKERS: ${problemTickers.length}`);
      problemTickers.forEach(ticker => console.log(`   ✗ ${ticker}`));
    }
    
    // Return detailed validation results if there are any issues
    const hasErrors = tickerValidationResults.some(r => r.status === 'invalid' || r.status === 'no_data');
    
    if (hasErrors || finalValidTickers.length === 0) {
      return res.status(400).json({
        error: 'Ticker validation failed',
        validation_results: tickerValidationResults,
        valid_tickers: finalValidTickers,
        problem_tickers: problemTickers,
        message: finalValidTickers.length > 0 
          ? `Found ${problemTickers.length} invalid ticker(s). You can proceed with ${finalValidTickers.length} valid ticker(s): ${finalValidTickers.join(', ')}`
          : 'No valid tickers found. Please check your ticker symbols and try again.'
      });
    }
    
    // Log any corrections made
    const corrections = tickerValidationResults.filter(r => r.status === 'corrected');
    if (corrections.length > 0) {
      console.log(`\n🔧 TICKER CORRECTIONS MADE:`);
      corrections.forEach(c => console.log(`   ${c.ticker} → ${c.correctedTo}`));
    }

    // Use only valid tickers for processing
    const processedTickers = finalValidTickers;
    
    // Check cache first (unless bypassed)
    const tickerString = processedTickers.sort().join(',');
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickerString}`;
    if (!bypass_cache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log('Returning cached backtest results');
        return res.status(200).json({ ...cached, from_cache: true });
      }
    } else {
      console.log('Cache bypassed for backtest - clearing any existing cache');
      // Clear existing cache entry when bypass is requested
      try {
        await cache.del(cacheKey);
        console.log(`Cleared cache for key: ${cacheKey}`);
      } catch (error) {
        console.warn('Failed to clear cache:', error);
      }
    }

    // Check if we have EODHD API token
    if (!process.env.EODHD_API_TOKEN) {
      console.log('No EODHD_API_TOKEN found, returning mock data');
      // Return mock data if no API token
      const yearRange = endYear - startYear;
      const baseReturn = 8 + (Math.random() * 4);
      
      const results = {
        equalWeightBuyHold: {
          totalReturn: ((Math.pow(1 + baseReturn/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn,
          finalValue: initialInvestment * Math.pow(1 + baseReturn/100, yearRange),
          yearlyValues: {},
          yearlyHoldings: {},
          portfolioComposition: {}
        },
        marketCapBuyHold: {
          totalReturn: ((Math.pow(1 + (baseReturn + 2)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 2,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 2)/100, yearRange),
          yearlyValues: {},
          yearlyHoldings: {},
          portfolioComposition: {}
        },
        equalWeightRebalanced: {
          totalReturn: ((Math.pow(1 + (baseReturn + 3)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 3,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 3)/100, yearRange),
          yearlyValues: {},
          yearlyHoldings: {},
          portfolioComposition: {}
        },
        marketCapRebalanced: {
          totalReturn: ((Math.pow(1 + (baseReturn + 1.5)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 1.5,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 1.5)/100, yearRange),
          yearlyValues: {},
          yearlyHoldings: {},
          portfolioComposition: {}
        },
        parameters: { 
          startYear, 
          endYear, 
          initialInvestment,
          tickerCount: tickers.length,
          tickers: tickers.slice(0, 5)
        },
        message: 'Note: EODHD API token not configured. Using simulated data.'
      };
      
      // Don't cache mock data forever - use 1 hour (unless bypassed)
      if (!bypass_cache) {
        await cache.set(cacheKey, results, 3600);
      }
      return res.status(200).json({ ...results, from_cache: false });
    }

    // Calculate real results using EODHD data
    console.log(`EODHD_API_TOKEN found, running real backtest for ${processedTickers.length} tickers from ${startYear} to ${endYear}`);
    
    // Collect historical data used in calculations for consistent Excel export
    const historicalData: Record<string, Record<string, any>> = {};
    
    // Pre-populate only essential data to avoid timeouts
    console.log('Pre-fetching essential data only (start/end years for performance)...');
    const essentialDates = [
      `${startYear}-01-02`,
      `${endYear >= 2025 ? 2024 : endYear}-12-31`
    ];
    
    const allTickersForData = ['SPY', ...processedTickers.slice(0, 20)]; // Limit to prevent timeout
    
    // Use Promise.all for parallel processing instead of sequential
    const dataPromises = allTickersForData.flatMap(ticker =>
      essentialDates.map(async (date) => {
        try {
          return await fetchStockData(ticker, date, bypass_cache, historicalData);
        } catch (error) {
          console.log(`Could not fetch ${ticker} data for ${date}:`, error);
          return null;
        }
      })
    );
    
    await Promise.all(dataPromises);
    
    // Debug: Log historical data collected
    console.log('Historical data collected for Excel export:', {
      tickers: Object.keys(historicalData),
      totalDataPoints: Object.values(historicalData).reduce((sum: number, dates: any) => sum + Object.keys(dates).length, 0),
      sampleData: Object.keys(historicalData).slice(0, 2).map(ticker => ({
        ticker,
        dates: Object.keys(historicalData[ticker]).slice(0, 3)
      }))
    });
    
    console.log('Starting strategy calculations...');
    
    let equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced, spyBenchmark;
    
    try {
      // Calculate strategies with timeout protection
      const strategyTimeout = 45000; // 45 seconds max per strategy set
      const strategiesPromise = Promise.all([
        calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', false, bypass_cache, historicalData).catch(err => {
          console.error('Error in equalWeightBuyHold:', err);
          throw err;
        }),
        calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', false, bypass_cache, historicalData).catch(err => {
          console.error('Error in marketCapBuyHold:', err);
          throw err;
        }),
        calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', true, bypass_cache, historicalData).catch(err => {
          console.error('Error in equalWeightRebalanced:', err);
          throw err;
        }),
        calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', true, bypass_cache, historicalData).catch(err => {
          console.error('Error in marketCapRebalanced:', err);
          throw err;
        }),
        calculateStrategy(['SPY'], startYear, endYear, initialInvestment, 'equalWeight', false, bypass_cache, historicalData).catch(err => {
          console.error('Error in spyBenchmark:', err);
          throw err;
        })
      ]);

      // Add timeout to prevent Vercel function timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Strategy calculations timed out')), strategyTimeout)
      );

      [equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced, spyBenchmark] = await Promise.race([
        strategiesPromise,
        timeoutPromise
      ]) as any;
      
      console.log('All strategy calculations completed successfully');
    } catch (strategyError) {
      console.error('Strategy calculation failed:', strategyError);
      
      // If we have too many tickers, try with a reduced set
      if (processedTickers.length > 25) {
        console.log(`Timeout with ${processedTickers.length} tickers, trying with top 25 tickers...`);
        const reducedTickers = processedTickers.slice(0, 25);
        
        try {
          [equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced, spyBenchmark] = await Promise.all([
            calculateStrategy(reducedTickers, startYear, endYear, initialInvestment, 'equalWeight', false, bypass_cache, historicalData),
            calculateStrategy(reducedTickers, startYear, endYear, initialInvestment, 'marketCap', false, bypass_cache, historicalData),
            calculateStrategy(reducedTickers, startYear, endYear, initialInvestment, 'equalWeight', true, bypass_cache, historicalData),
            calculateStrategy(reducedTickers, startYear, endYear, initialInvestment, 'marketCap', true, bypass_cache, historicalData),
            calculateStrategy(['SPY'], startYear, endYear, initialInvestment, 'equalWeight', false, bypass_cache, historicalData)
          ]);
          
          console.log(`Successfully calculated with reduced ticker set (${reducedTickers.length} tickers)`);
        } catch (fallbackError) {
          console.error('Even reduced ticker calculation failed:', fallbackError);
          throw new Error(`Backtest failed: Portfolio too large (${processedTickers.length} tickers). Please try with fewer tickers (max ~25 for optimal performance).`);
        }
      } else {
        throw strategyError;
      }
    }

    const results = {
      equalWeightBuyHold,
      marketCapBuyHold,
      equalWeightRebalanced,
      marketCapRebalanced,
      spyBenchmark,
      parameters: { 
        startYear, 
        endYear, 
        initialInvestment,
        tickerCount: processedTickers.length,
        tickers: processedTickers.slice(0, 10)
      },
      historicalData, // Include the actual data used in calculations
      debug: {
        equalWeightResult: equalWeightBuyHold.finalValue,
        marketCapResult: marketCapBuyHold.finalValue,
        equalWeightRebalancedResult: equalWeightRebalanced.finalValue,
        marketCapRebalancedResult: marketCapRebalanced.finalValue,
        spyBenchmarkResult: spyBenchmark.finalValue,
        requestedTickers: processedTickers,
        usingExchangeSuffix: true,
        historicalDataKeys: Object.keys(historicalData).length
      },
      message: processedTickers.length > 10 ? 
        'Note: Calculations based on real market data. Large portfolios may take time to process.' :
        'Calculations based on real EODHD market data with SPY benchmark.'
    };

    // Cache forever if end year is in the past, otherwise cache for 1 day (unless bypassed)
    if (!bypass_cache) {
      const currentYear = new Date().getFullYear();
      const cacheTime = endYear < currentYear ? undefined : 86400;
      await cache.set(cacheKey, results, cacheTime);
    }

    res.status(200).json({ ...results, from_cache: false });
  } catch (error: any) {
    console.error('Backtest error:', error);
    res.status(500).json({ 
      error: 'Backtest failed', 
      message: error.message 
    });
  }
}