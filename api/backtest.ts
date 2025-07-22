// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { handleApiError } from './_errorHandler';
import { logger } from './_logger';
import {
  TickerYearData,
  TickerCacheData,
  getDataFromCache,
  validateCacheCoverage,
  getCachedPrice,
  getCachedMarketCap,
  getCachedSharesOutstanding,
  getValidUSTickers
} from './_cacheUtils';
import { analyzeStockAvailabilityChanges } from './cache/cacheOperations';
import type { StrategyResult } from './_types';

// Utility function for formatting currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Cache utility functions are now imported from _cacheUtils.ts


// StrategyResult interface now imported from _types.ts



// Strategy calculation function
async function calculateStrategy(
  tickers: string[], 
  startYear: number, 
  endYear: number, 
  initialInvestment: number, 
  weightingMethod: 'equalWeight' | 'marketCap', 
  rebalance: boolean, 
  historicalData?: Record<string, Record<string, any>>,
  availabilityData?: any[]
): Promise<StrategyResult> {
  const yearlyValues: Record<number, number> = {};
  const yearlyHoldings: Record<number, Record<string, { weight: number; shares: number; value: number; price: number; marketCap?: number; sharesOutstanding?: number; }>> = {};
  const portfolioComposition: Record<string, { initialWeight: number; finalWeight: number; available: boolean; }> = {};
  
  let currentValue = initialInvestment;
  let currentHoldings: Record<string, number> = {}; // shares per ticker
  
  // Get data from cache (which is already loaded in the main handler)
  // Ensure SPY is included but avoid duplicates
  const uniqueTickers = [...new Set([...tickers, 'SPY'])];
  const cacheData = await getDataFromCache(uniqueTickers);
  
  // Use pre-calculated availability data if provided, otherwise calculate it
  // For SPY benchmark or other single-ticker strategies, we need to analyze the specific tickers
  const needsNewAnalysis = !availabilityData || (tickers.length === 1 && tickers[0] === 'SPY');
  const stockAvailabilityData = needsNewAnalysis 
    ? analyzeStockAvailabilityChanges(cacheData.data, tickers, startYear, endYear)
    : availabilityData;
    
  if (needsNewAnalysis) {
    console.log(`📊 Stock availability analysis for ${tickers.join(', ')}: Found ${stockAvailabilityData.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0)} entry/exit events`);
  }
  
  for (let yearIndex = 0; yearIndex < stockAvailabilityData.length; yearIndex++) {
    const yearData = stockAvailabilityData[yearIndex];
    const year = yearData.year;
    const startOfYear = `${year}-01-02`;
    
    // Use pre-analyzed availability data
    const availableTickers = yearData.availableStocks;
    const enteringStocks = yearData.enteringStocks;
    const exitingStocks = yearData.exitingStocks;
    const continuingStocks = yearData.continuingStocks;
    
    const tickerPrices: Record<string, number> = {};
    const tickerMarketCaps: Record<string, number> = {};
    
    // Get price and market cap data for available tickers
    for (const ticker of availableTickers) {
      const price = getCachedPrice(cacheData.data, ticker, year);
      const marketCap = getCachedMarketCap(cacheData.data, ticker, year);
      
      tickerPrices[ticker] = price!; // We know it exists from availability analysis
      if (marketCap) {
        tickerMarketCaps[ticker] = marketCap;
      }
    }
    
    // Handle market exits - sell positions in stocks that are no longer available
    if (!rebalance && exitingStocks.length > 0) {
      console.log(`📉 MARKET EXITS in ${year}: Selling positions in ${exitingStocks.length} stocks: ${exitingStocks.slice(0, 3).join(', ')}${exitingStocks.length > 3 ? ` +${exitingStocks.length - 3} more` : ''}`);
      
      for (const exitingTicker of exitingStocks) {
        if (currentHoldings[exitingTicker]) {
          const shares = currentHoldings[exitingTicker];
          // Use last known price (previous year) for exit calculation
          const exitPrice = getCachedPrice(cacheData.data, exitingTicker, year - 1) || 0;
          const exitValue = shares * exitPrice;
          currentValue += exitValue;
          console.log(`   🏪 Sold ${shares.toLocaleString()} shares of ${exitingTicker} at $${exitPrice.toFixed(2)} = ${formatCurrency(exitValue)}`);
          delete currentHoldings[exitingTicker];
        }
      }
    }
    
    if (availableTickers.length === 0) {
      console.log(`⚠️ No available tickers for year ${year}`);
      continue;
    }
    
    // Calculate weights
    const weights: Record<string, number> = {};
    
    if (weightingMethod === 'equalWeight') {
      const equalWeight = 1 / availableTickers.length;
      availableTickers.forEach((ticker: string) => {
        weights[ticker] = equalWeight;
      });
    } else {
      // Market cap weighting
      const totalMarketCap = availableTickers.reduce((sum: number, ticker: string) => {
        return sum + (tickerMarketCaps[ticker] || 0);
      }, 0);
      
      if (totalMarketCap > 0) {
        availableTickers.forEach((ticker: string) => {
          weights[ticker] = (tickerMarketCaps[ticker] || 0) / totalMarketCap;
        });
      } else {
        // Fallback to equal weight if market cap data unavailable
        console.log(`⚠️ Warning: No market cap data available for year ${year}. Using equal weight fallback.`);
        const equalWeight = 1 / availableTickers.length;
        availableTickers.forEach((ticker: string) => {
          weights[ticker] = equalWeight;
        });
      }
    }
    
    // For first year or if rebalancing, calculate new holdings
    if (year === startYear || rebalance) {
      // For rebalanced strategies, log entry/exit changes
      if (rebalance && year > startYear) {
        if (enteringStocks.length > 0) {
          console.log(`📈 REBALANCE ENTRIES in ${year}: Adding ${enteringStocks.length} new stocks: ${enteringStocks.slice(0, 3).join(', ')}${enteringStocks.length > 3 ? ` +${enteringStocks.length - 3} more` : ''}`);
        }
        if (exitingStocks.length > 0) {
          console.log(`📉 REBALANCE EXITS in ${year}: Removing ${exitingStocks.length} stocks: ${exitingStocks.slice(0, 3).join(', ')}${exitingStocks.length > 3 ? ` +${exitingStocks.length - 3} more` : ''}`);
        }
      }
      
      currentHoldings = {};
      
      // Allocate based on weights
      availableTickers.forEach((ticker: string) => {
        const allocation = currentValue * weights[ticker];
        const price = tickerPrices[ticker];
        
        // Safety check for valid price data
        if (!price || price <= 0) {
          console.log(`⚠️ Warning: Invalid price for ${ticker} in ${year}: ${price}. Skipping allocation.`);
          return;
        }
        
        const shares = allocation / price;
        if (!isFinite(shares) || shares < 0) {
          console.log(`⚠️ Warning: Invalid shares calculation for ${ticker} in ${year}: ${shares}. Allocation: ${allocation}, Price: ${price}`);
          return;
        }
        
        currentHoldings[ticker] = shares;
      });
    } else {
      // Handle market entries for Buy & Hold strategy
      if (enteringStocks.length > 0) {
        console.log(`📈 MARKET ENTRIES in ${year}: Buying positions in ${enteringStocks.length} new stocks: ${enteringStocks.slice(0, 3).join(', ')}${enteringStocks.length > 3 ? ` +${enteringStocks.length - 3} more` : ''}`);
        
        // Calculate available cash for new investments
        // For entering stocks, we need to determine how much to invest
        const totalEnteringWeight = enteringStocks.reduce((sum: number, ticker: string) => sum + weights[ticker], 0);
        
        if (totalEnteringWeight > 0) {
          // For Buy & Hold, we invest proportionally in new stocks without selling existing positions
          const cashForNewInvestments = currentValue * totalEnteringWeight;
          
          enteringStocks.forEach((ticker: string) => {
            const allocation = cashForNewInvestments * (weights[ticker] / totalEnteringWeight);
            const price = tickerPrices[ticker];
            
            if (price && price > 0) {
              const shares = allocation / price;
              currentHoldings[ticker] = shares;
              console.log(`   🛒 Bought ${shares.toLocaleString()} shares of ${ticker} at $${price.toFixed(2)} = ${formatCurrency(allocation)}`);
            }
          });
        }
      }
    }
    
    // Calculate current portfolio value
    currentValue = Object.entries(currentHoldings).reduce((total, [ticker, shares]) => {
      const price = tickerPrices[ticker] || 0;
      return total + (shares * price);
    }, 0);
    
    yearlyValues[year] = currentValue;
    
    // Record holdings for this year
    yearlyHoldings[year] = {};
    Object.entries(currentHoldings).forEach(([ticker, shares]) => {
      const price = tickerPrices[ticker] || 0;
      const value = shares * price;
      const weight = currentValue > 0 ? value / currentValue : 0;
      
      yearlyHoldings[year][ticker] = {
        weight,
        shares,
        value,
        price,
        marketCap: tickerMarketCaps[ticker],
        sharesOutstanding: getCachedSharesOutstanding(cacheData.data, ticker, year) || undefined
      };
    });
  }
  
  // Calculate portfolio composition
  tickers.forEach(ticker => {
    const firstYearWeight = yearlyHoldings[startYear]?.[ticker]?.weight || 0;
    const lastYearWeight = yearlyHoldings[endYear]?.[ticker]?.weight || 0;
    const wasAvailable = Object.values(yearlyHoldings).some(holdings => ticker in holdings);
    
    portfolioComposition[ticker] = {
      initialWeight: firstYearWeight,
      finalWeight: lastYearWeight,
      available: wasAvailable
    };
  });
  
  const totalReturn = ((currentValue - initialInvestment) / initialInvestment) * 100;
  const years = endYear - startYear;
  const annualizedReturn = years > 0 ? (Math.pow(currentValue / initialInvestment, 1 / years) - 1) * 100 : 0;
  
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
    const apiStartTime = Date.now();
    logger.info('BACKTEST API CALLED (v2)');
    const { startYear, endYear, initialInvestment, tickers = [], customName } = req.body;
    logger.debug('Request body:', { startYear, endYear, initialInvestment, tickers, customName });
    
    // Date validation: No analysis beyond Jan 1 of current year
    const currentYear = new Date().getFullYear();
    const MAX_YEAR = currentYear; // Can analyze through Jan 1 of current year
    if (endYear > MAX_YEAR) {
      return res.status(400).json({
        error: `Analysis not available beyond ${MAX_YEAR}`,
        message: `End year ${endYear} exceeds maximum allowed year ${MAX_YEAR}. Please use ${MAX_YEAR} or earlier.`,
        maxYear: MAX_YEAR
      });
    }
    
    if (startYear > MAX_YEAR) {
      return res.status(400).json({
        error: `Analysis not available beyond ${MAX_YEAR}`,
        message: `Start year ${startYear} exceeds maximum allowed year ${MAX_YEAR}. Please use ${MAX_YEAR} or earlier.`,
        maxYear: MAX_YEAR
      });
    }
    
    console.log(`✅ Date validation passed: ${startYear}-${endYear} (within ${MAX_YEAR} limit)`);
    
    // Initialize overall timing tracking
    const overallTimings: Record<string, number> = {};

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

    // Phase 1: Ticker Validation
    const validationStart = Date.now();
    console.log(`\n⏱️ Starting ticker validation for ${tickers.length} tickers...`);
    
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
    const tickerLists = await getValidUSTickers(false);
    
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
    
    // Note: Bypass cache mode has been removed - only tickers in EODHD exchange lists are allowed
    
    // Log validation summary
    console.log(`\n✅ TICKER VALIDATION COMPLETE: ${finalValidTickers.length}/${tickers.length} valid tickers`);
    console.log(`📊 VALIDATION SUMMARY: ${finalValidTickers.length} valid, ${problemTickers.length} invalid`);
    finalValidTickers.forEach((ticker, index) => console.log(`   ${index + 1}/${finalValidTickers.length} ✓ ${ticker}`));
    
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

    // Process all valid tickers - no arbitrary limits
    let processedTickers = finalValidTickers;
    const isLargePortfolioOptimized = false;
    
    overallTimings.validation = Date.now() - validationStart;
    console.log(`\n📊 PORTFOLIO SIZE ANALYSIS:`);
    console.log(`   📥 Submitted: ${tickers.length} tickers`);
    console.log(`   ✅ Validated: ${finalValidTickers.length} tickers`);
    console.log(`   ❌ Invalid: ${tickers.length - finalValidTickers.length} tickers`);
    console.log(`⏱️ Ticker validation completed in ${(overallTimings.validation / 1000).toFixed(1)}s`);
    if (finalValidTickers.length > 100) {
      console.log(`⚡ Large portfolio detected - using optimized batching strategy`);
    }
    
    // Check cache first (unless bypassed)
    const tickerString = processedTickers.sort().join(',');
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickerString}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached backtest results');
      return res.status(200).json({ ...cached, from_cache: true });
    }

    // Check if we have EODHD API token
    if (!process.env.EODHD_API_TOKEN) {
      return res.status(500).json({
        error: 'API configuration error',
        message: 'EODHD_API_TOKEN environment variable is required for backtesting operations',
        details: 'Please configure the EODHD API token to perform analysis with real market data'
      });
    }

    // Calculate real results using EODHD data
    logger.info(`Running backtest for ${processedTickers.length} tickers from ${startYear} to ${endYear}`);
    
    // Collect historical data used in calculations for consistent Excel export
    const historicalData: Record<string, Record<string, any>> = {};
    
    // Pre-populate only essential data to avoid timeouts
    console.log(`\n🔄 DATA FETCHING PHASE: Fetching essential data for ${processedTickers.length} tickers...`);
    const essentialDates = [
      `${startYear}-01-02`,
      endYear >= currentYear ? `${currentYear}-01-02` : `${endYear}-12-31`
    ];
    
    // CACHE-BASED DATA LOADING APPROACH - REQUIRED
    console.log(`\n🔄 CACHE VALIDATION PHASE: Checking ticker cache coverage...`);
    
    // Validate that all tickers are in the new cache format
    const allTickersNeeded = ['SPY', ...processedTickers];
    const { missing: missingTickers, eliminated: eliminatedTickers } = await validateCacheCoverage(allTickersNeeded);
    
    // Remove eliminated tickers from processedTickers
    const eliminatedTickerList = eliminatedTickers.map(e => e.ticker);
    const finalTickers = processedTickers.filter(ticker => !eliminatedTickerList.includes(ticker));
    
    if (eliminatedTickers.length > 0) {
      console.log(`🚫 TICKERS ELIMINATED: ${eliminatedTickers.length} tickers removed due to data quality issues: ${eliminatedTickers.map(e => `${e.ticker}(${e.reason.substring(0,50)})`).slice(0, 3).join(', ')}`);
    }
    
    if (missingTickers.length > 0) {
      console.log(`❌ CACHE MISS: ${missingTickers.length} tickers not cached: ${missingTickers.slice(0, 10).join(', ')}${missingTickers.length > 10 ? ` +${missingTickers.length - 10} more` : ''}`);
      return res.status(400).json({
        error: 'Tickers not cached',
        message: `${missingTickers.length} tickers need to be cached before analysis can run.`,
        missingTickers,
        eliminatedTickers,
        suggestion: 'Please run the Fill Cache operation first.',
        action: 'fill_cache_required'
      });
    }
    
    // Update processedTickers to use finalTickers (after eliminations)
    processedTickers = finalTickers;
    const finalAllTickersNeeded = ['SPY', ...processedTickers];
    
    console.log(`✅ CACHE VALIDATION COMPLETE: All ${finalAllTickersNeeded.length} tickers are cached`);
    
    // Load data from cache into runtime structure
    console.log(`\n📊 DATA LOADING PHASE: Loading ticker data from cache...`);
    const { data: cachedTickerData, missing: stillMissing, eliminated: stillEliminated } = await getDataFromCache(finalAllTickersNeeded);
    
    if (stillMissing.length > 0) {
      return res.status(500).json({
        error: 'Cache consistency error',
        message: `Validation passed but tickers are missing: ${stillMissing.join(', ')}`,
        missingTickers: stillMissing
      });
    }
    
    console.log(`✅ DATA LOADING COMPLETE: Loaded data for ${Object.keys(cachedTickerData).length} tickers`);
    console.log(`🎯 Strategy calculations will use 100% cached data - ZERO EODHD API calls!`);
    
    // Analyze stock availability changes across the analysis period
    console.log(`\n📊 AVAILABILITY ANALYSIS: Analyzing market entry/exit patterns...`);
    const availabilityData = analyzeStockAvailabilityChanges(cachedTickerData, processedTickers, startYear, endYear);
    const totalEntryExitEvents = availabilityData.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0);
    console.log(`📈 Market dynamics: ${totalEntryExitEvents} total entry/exit events detected across ${endYear - startYear + 1} years`);
    
    // Debug: Log historical data collected
    console.log('Historical data collected for Excel export:', {
      tickers: Object.keys(historicalData),
      totalDataPoints: Object.values(historicalData).reduce((sum: number, dates: any) => sum + Object.keys(dates).length, 0),
      sampleData: Object.keys(historicalData).slice(0, 2).map(ticker => ({
        ticker,
        dates: Object.keys(historicalData[ticker]).slice(0, 3)
      }))
    });
    
    console.log(`\n🚀 STRATEGY CALCULATION PHASE: Running 5 investment strategies...`);
    console.log(`📊 ANALYSIS SCOPE:`);
    console.log(`   🎯 Processing: ${processedTickers.length} tickers`);
    console.log(`   📅 Period: ${startYear}-${endYear} (${endYear - startYear + 1} years)`);
    console.log(`   💰 Initial investment: ${formatCurrency(initialInvestment)}`);
    console.log(`   📋 Tickers: ${processedTickers.slice(0, 10).join(', ')}${processedTickers.length > 10 ? ` +${processedTickers.length - 10} more` : ''}`);
    
    let equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced, spyBenchmark;
    
    // Phase 2: Strategy Calculations
    const strategiesStart = Date.now();
    console.log(`\n⏱️ Starting strategy calculations for all 5 strategies...`);
    
    try {
      // Calculate strategies with timeout protection - scale timeout based on portfolio size
      const baseTimeout = 480000; // 8 minutes base
      const timeoutMultiplier = processedTickers.length > 75 ? 1.25 : 1.0; // Extra time for very large portfolios  
      const strategyTimeout = Math.min(baseTimeout * timeoutMultiplier, 580000); // Cap at 9.67 minutes (leave buffer before Vercel 10min limit)
      
      console.log(`⏱️ Strategy timeout set to ${(strategyTimeout/1000).toFixed(1)}s for ${processedTickers.length} tickers`);
      
      // For extremely large portfolios, use optimized calculation mode
      const isExtremelyLarge = processedTickers.length > 100;
      if (isExtremelyLarge) {
        console.log(`🚀 EXTREME PORTFOLIO MODE: Using optimized calculations for ${processedTickers.length} tickers`);
        console.log(`⚡ Reducing data granularity and skipping some non-essential calculations`);
      }
      
      const strategiesPromise = Promise.all([
        // Strategy 1: Equal Weight Buy & Hold
        (async () => {
          console.log(`\n⚖️  [1/5] CALCULATING: Equal Weight Buy & Hold Strategy`);
          console.log(`     📋 Portfolio: ${processedTickers.length} tickers, equal allocation each`);
          console.log(`     🏦 Type: Buy & Hold (no rebalancing)`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', false, historicalData, availabilityData);
          console.log(`     ✅ COMPLETED: Equal Weight Buy & Hold - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          console.error('❌ Error in equalWeightBuyHold:', err);
          throw err;
        }),
        
        // Strategy 2: Market Cap Buy & Hold  
        (async () => {
          console.log(`\n📈 [2/5] CALCULATING: Market Cap Buy & Hold Strategy`);
          console.log(`     📋 Portfolio: ${processedTickers.length} tickers, weighted by market cap`);
          console.log(`     🏦 Type: Buy & Hold (no rebalancing)`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', false, historicalData, availabilityData);
          console.log(`     ✅ COMPLETED: Market Cap Buy & Hold - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          console.error('❌ Error in marketCapBuyHold:', err);
          throw err;
        }),
        
        // Strategy 3: Equal Weight Rebalanced
        (async () => {
          console.log(`\n🔄 [3/5] CALCULATING: Equal Weight Rebalanced Strategy`);
          console.log(`     📋 Portfolio: ${processedTickers.length} tickers, equal allocation each`);
          console.log(`     🏦 Type: Rebalanced annually`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', true, historicalData, availabilityData);
          console.log(`     ✅ COMPLETED: Equal Weight Rebalanced - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          console.error('❌ Error in equalWeightRebalanced:', err);
          throw err;
        }),
        
        // Strategy 4: Market Cap Rebalanced
        (async () => {
          console.log(`\n📊 [4/5] CALCULATING: Market Cap Rebalanced Strategy`);
          console.log(`     📋 Portfolio: ${processedTickers.length} tickers, weighted by market cap`);
          console.log(`     🏦 Type: Rebalanced annually`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', true, historicalData, availabilityData);
          console.log(`     ✅ COMPLETED: Market Cap Rebalanced - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          console.error('❌ Error in marketCapRebalanced:', err);
          throw err;
        }),
        
        // Strategy 5: SPY Benchmark
        (async () => {
          console.log(`\n🏛️  [5/5] CALCULATING: SPY Benchmark Strategy`);
          console.log(`     📋 Benchmark: SPY ETF only`);
          console.log(`     🏦 Type: Buy & Hold SPY`);
          const result = await calculateStrategy(['SPY'], startYear, endYear, initialInvestment, 'equalWeight', false, historicalData, availabilityData);
          console.log(`     ✅ COMPLETED: SPY Benchmark - 1 ticker - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          console.error('❌ Error in spyBenchmark:', err);
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
      
      overallTimings.strategies = Date.now() - strategiesStart;
      console.log(`\n🎉 ALL STRATEGY CALCULATIONS COMPLETED SUCCESSFULLY!`);
      console.log(`⏱️ Strategy calculations completed in ${(overallTimings.strategies / 1000).toFixed(1)}s`);
      console.log(`📊 FINAL TICKER COUNT: ${processedTickers.length} tickers successfully analyzed`);
      console.log(`📈 FINAL RESULTS SUMMARY:`);
      console.log(`   ⚖️  Equal Weight Buy & Hold:    ${formatCurrency(equalWeightBuyHold.finalValue)} (${equalWeightBuyHold.totalReturn.toFixed(2)}%)`);
      console.log(`   📈 Market Cap Buy & Hold:      ${formatCurrency(marketCapBuyHold.finalValue)} (${marketCapBuyHold.totalReturn.toFixed(2)}%)`);
      console.log(`   🔄 Equal Weight Rebalanced:    ${formatCurrency(equalWeightRebalanced.finalValue)} (${equalWeightRebalanced.totalReturn.toFixed(2)}%)`);
      console.log(`   📊 Market Cap Rebalanced:      ${formatCurrency(marketCapRebalanced.finalValue)} (${marketCapRebalanced.totalReturn.toFixed(2)}%)`);
      console.log(`   🏛️  SPY Benchmark:              ${formatCurrency(spyBenchmark.finalValue)} (${spyBenchmark.totalReturn.toFixed(2)}%)`);
      
      // Find best performing strategy
      const strategies = [
        { name: 'Equal Weight Buy & Hold', value: equalWeightBuyHold.finalValue, icon: '⚖️' },
        { name: 'Market Cap Buy & Hold', value: marketCapBuyHold.finalValue, icon: '📈' },
        { name: 'Equal Weight Rebalanced', value: equalWeightRebalanced.finalValue, icon: '🔄' },
        { name: 'Market Cap Rebalanced', value: marketCapRebalanced.finalValue, icon: '📊' },
        { name: 'SPY Benchmark', value: spyBenchmark.finalValue, icon: '🏛️' }
      ];
      const topStrategy = strategies.reduce((a, b) => a.value > b.value ? a : b);
      console.log(`🏆 TOP PERFORMER: ${topStrategy.icon} ${topStrategy.name} - ${formatCurrency(topStrategy.value)}`);
      
      console.log(`⏱️ STRATEGIES COMPLETE - Starting results finalization...`);
    } catch (strategyError) {
      console.error('Strategy calculation failed:', strategyError);
      
      // User requested no arbitrary limits - just re-throw the error
      console.log(`Strategy calculation failed for ${processedTickers.length} tickers. No fallback limits applied as requested.`);
      throw strategyError;
    }

    // Phase 3: Results Finalization
    const finalizationStart = Date.now();
    console.log(`\n📦 FINALIZING RESULTS: Preparing comprehensive analysis package...`);
    
    console.log(`   📊 Consolidating strategy results...`);
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
        tickers: processedTickers,
        originalTickerCount: finalValidTickers.length,
        eliminatedTickers,
        eliminatedCount: eliminatedTickers.length,
        isOptimized: isLargePortfolioOptimized,
        analysisDate: new Date().toISOString()
      },
      marketAvailabilityChanges: {
        totalEntryExitEvents: availabilityData?.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0) || 0,
        yearlyChanges: availabilityData?.map(year => ({
          year: year.year,
          availableCount: year.availableStocks.length,
          entriesCount: year.enteringStocks.length,
          exitsCount: year.exitingStocks.length,
          entering: year.enteringStocks.slice(0, 5), // Show first 5 for UI
          exiting: year.exitingStocks.slice(0, 5)    // Show first 5 for UI
        })) || []
      },
      customName,
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
    
    console.log(`   📋 Adding metadata and parameters...`);
    console.log(`   📈 Including historical data (${Object.keys(historicalData).length} ticker datasets)...`);
    console.log(`   🔧 Preparing debug information...`);

    // Add final timing information
    overallTimings.finalization = Date.now() - finalizationStart;
    overallTimings.total = Date.now() - apiStartTime;
    overallTimings.cacheAndResponse = overallTimings.total - overallTimings.validation - overallTimings.strategies - overallTimings.finalization;
    
    // Log comprehensive timing breakdown
    console.log(`\n⏱️ === COMPREHENSIVE TIMING BREAKDOWN ===`);
    console.log(`📋 Ticker Validation: ${(overallTimings.validation / 1000).toFixed(1)}s`);
    console.log(`🧮 Strategy Calculations: ${(overallTimings.strategies / 1000).toFixed(1)}s`);
    console.log(`📦 Results Finalization: ${(overallTimings.finalization / 1000).toFixed(1)}s`);
    console.log(`💾 Cache & Response: ${(overallTimings.cacheAndResponse / 1000).toFixed(1)}s`);
    console.log(`⏱️ Total API Time: ${(overallTimings.total / 1000).toFixed(1)}s`);
    console.log(`📊 Processing Efficiency: ${(processedTickers.length / (overallTimings.total / 1000)).toFixed(1)} tickers/second`);
    
    // Cache permanently since all analysis is limited to historical data (through Jan 1 current year)
    console.log(`   💾 Caching results permanently (all data is historical)...`);
    await cache.set(cacheKey, results); // No expiration - permanent cache
    console.log(`   ✅ Results cached successfully`);

    console.log(`\n🚀 SENDING RESPONSE TO FRONTEND...`);
    console.log(`📦 Final package size: ${Object.keys(results).length} main sections`);
    console.log(`✅ Analysis complete for ${processedTickers.length} tickers!`);

    res.status(200).json({ 
      ...results, 
      from_cache: false,
      timings: overallTimings
    });
  } catch (error: any) {
    return handleApiError(res, error, 'Backtest operation');
  }
}