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
  const cacheData = await getDataFromCache(tickers);
  
  // Always calculate availability data for the specific tickers being analyzed
  const stockAvailabilityData = analyzeStockAvailabilityChanges(cacheData.data, tickers, startYear, endYear);
  logger.debug(`📊 Stock availability analysis for ${tickers.join(', ')}: Found ${stockAvailabilityData.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0)} entry/exit events`);
  
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
      logger.debug(`📉 MARKET EXITS in ${year}: Selling positions in ${exitingStocks.length} stocks: ${exitingStocks.slice(0, 3).join(', ')}${exitingStocks.length > 3 ? ` +${exitingStocks.length - 3} more` : ''}`);
      
      for (const exitingTicker of exitingStocks) {
        if (currentHoldings[exitingTicker]) {
          const shares = currentHoldings[exitingTicker];
          // Use last known price (previous year) for exit calculation
          const exitPrice = getCachedPrice(cacheData.data, exitingTicker, year - 1) || 0;
          const exitValue = shares * exitPrice;
          currentValue += exitValue;
          logger.debug(`   🏪 Sold ${shares.toLocaleString()} shares of ${exitingTicker} at $${exitPrice.toFixed(2)} = ${formatCurrency(exitValue)}`);
          delete currentHoldings[exitingTicker];
        }
      }
    }
    
    if (availableTickers.length === 0) {
      logger.warn(`No available tickers for year ${year}`);
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
        logger.warn(`Warning: No market cap data available for year ${year}. Using equal weight fallback.`);
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
          logger.debug(`📈 REBALANCE ENTRIES in ${year}: Adding ${enteringStocks.length} new stocks: ${enteringStocks.slice(0, 3).join(', ')}${enteringStocks.length > 3 ? ` +${enteringStocks.length - 3} more` : ''}`);
        }
        if (exitingStocks.length > 0) {
          logger.debug(`📉 REBALANCE EXITS in ${year}: Removing ${exitingStocks.length} stocks: ${exitingStocks.slice(0, 3).join(', ')}${exitingStocks.length > 3 ? ` +${exitingStocks.length - 3} more` : ''}`);
        }
        
        // For rebalancing: first calculate current portfolio value, then liquidate
        const portfolioValueBeforeRebalancing = Object.entries(currentHoldings).reduce((total, [ticker, shares]) => {
          const currentPrice = tickerPrices[ticker];
          return total + (shares * currentPrice || 0);
        }, 0);
        
        logger.debug(`💰 Portfolio value before rebalancing ${year}: ${formatCurrency(portfolioValueBeforeRebalancing)}`);
        currentValue = portfolioValueBeforeRebalancing;
      }
      
      currentHoldings = {};
      
      // Allocate based on weights
      availableTickers.forEach((ticker: string) => {
        const allocation = currentValue * weights[ticker];
        const price = tickerPrices[ticker];
        
        // Safety check for valid price data
        if (!price || price <= 0) {
          logger.warn(`Warning: Invalid price for ${ticker} in ${year}: ${price}. Skipping allocation.`);
          return;
        }
        
        const shares = allocation / price;
        if (!isFinite(shares) || shares < 0) {
          logger.warn(`Warning: Invalid shares calculation for ${ticker} in ${year}: ${shares}. Allocation: ${allocation}, Price: ${price}`);
          return;
        }
        
        currentHoldings[ticker] = shares;
      });
    } else {
      // Handle market entries for Buy & Hold strategy
      if (enteringStocks.length > 0) {
        logger.debug(`📈 MARKET ENTRIES in ${year}: Buying positions in ${enteringStocks.length} new stocks: ${enteringStocks.slice(0, 3).join(', ')}${enteringStocks.length > 3 ? ` +${enteringStocks.length - 3} more` : ''}`);
        
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
              logger.debug(`   🛒 Bought ${shares.toLocaleString()} shares of ${ticker} at $${price.toFixed(2)} = ${formatCurrency(allocation)}`);
            }
          });
        }
      }
    }
    
    // Calculate current portfolio value (only update for Buy & Hold strategies)
    // For rebalanced strategies, currentValue is already set during rebalancing
    if (!rebalance || year === startYear) {
      currentValue = Object.entries(currentHoldings).reduce((total, [ticker, shares]) => {
        const price = tickerPrices[ticker] || 0;
        return total + (shares * price);
      }, 0);
    }
    
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
    
    logger.success(`Date validation passed: ${startYear}-${endYear} (within ${MAX_YEAR} limit)`);
    
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
    logger.debug(`\n⏱️ Starting ticker validation for ${tickers.length} tickers...`);
    
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
    
    // Validate tickers against cache instead of EODHD exchange lists
    logger.debug(`\n📋 VALIDATING TICKERS AGAINST CACHE...`);
    
    const finalValidTickers: string[] = [];
    const problemTickers: string[] = [];
    
    // Check cache coverage for all tickers
    const { missing: missingFromCache, eliminated: eliminatedFromCache } = await validateCacheCoverage(validatedTickers);
    
    // Process each ticker
    for (const ticker of validatedTickers) {
      if (missingFromCache.includes(ticker)) {
        // Ticker not in cache
        problemTickers.push(ticker);
        
        const validationResult = tickerValidationResults.find(r => 
          r.ticker === ticker || r.correctedTo === ticker
        );
        
        if (validationResult) {
          validationResult.status = 'no_data';
          validationResult.message = `Not found in cache`;
          validationResult.hasHistoricalData = false;
        } else {
          tickerValidationResults.push({
            ticker: ticker,
            status: 'no_data',
            message: `Not found in cache`,
            hasHistoricalData: false
          });
        }
        
        logger.debug(`   ✗ ${ticker} - Not found in cache`);
      } else if (eliminatedFromCache.find(e => e.ticker === ticker)) {
        // Ticker eliminated due to data quality issues
        const elimination = eliminatedFromCache.find(e => e.ticker === ticker);
        problemTickers.push(ticker);
        
        const validationResult = tickerValidationResults.find(r => 
          r.ticker === ticker || r.correctedTo === ticker
        );
        
        if (validationResult) {
          validationResult.status = 'no_data';
          validationResult.message = `Eliminated: ${elimination?.reason}`;
          validationResult.hasHistoricalData = false;
        } else {
          tickerValidationResults.push({
            ticker: ticker,
            status: 'no_data',
            message: `Eliminated: ${elimination?.reason}`,
            hasHistoricalData: false
          });
        }
        
        logger.debug(`   ✗ ${ticker} - Eliminated: ${elimination?.reason}`);
      } else {
        // Ticker is available in cache
        const validationResult = tickerValidationResults.find(r => 
          r.ticker === ticker || r.correctedTo === ticker
        );
        
        if (!validationResult) {
          tickerValidationResults.push({
            ticker: ticker,
            status: 'valid',
            message: `Available in cache`,
            hasHistoricalData: true
          });
        } else if (validationResult) {
          validationResult.status = 'valid';
          validationResult.message = `Available in cache`;
          validationResult.hasHistoricalData = true;
        }
        
        finalValidTickers.push(ticker);
        logger.debug(`   ✓ ${ticker} - Available in cache`);
      }
    }
    
    // Note: Validation now checks against cache instead of EODHD exchange lists for backtesting
    
    // Log validation summary
    logger.success(`TICKER VALIDATION COMPLETE: ${finalValidTickers.length}/${tickers.length} valid tickers`);
    logger.debug(`📊 VALIDATION SUMMARY: ${finalValidTickers.length} valid, ${problemTickers.length} invalid`);
    finalValidTickers.forEach((ticker, index) => logger.debug(`   ${index + 1}/${finalValidTickers.length} ✓ ${ticker}`));
    
    if (problemTickers.length > 0) {
      logger.debug(`\n❌ PROBLEM TICKERS: ${problemTickers.length}`);
      problemTickers.forEach(ticker => logger.debug(`   ✗ ${ticker}`));
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
      logger.debug(`\n🔧 TICKER CORRECTIONS MADE:`);
      corrections.forEach(c => logger.debug(`   ${c.ticker} → ${c.correctedTo}`));
    }

    // Process all valid tickers - no arbitrary limits
    let processedTickers = finalValidTickers;
    const isLargePortfolioOptimized = false;
    
    // Ensure SPY is included for benchmark calculation
    if (!processedTickers.includes('SPY') && !processedTickers.includes('SPY.US')) {
      processedTickers = [...processedTickers, 'SPY'];
      logger.debug(`   📊 Adding SPY for benchmark calculation`);
    }
    
    overallTimings.validation = Date.now() - validationStart;
    logger.debug(`\n📊 PORTFOLIO SIZE ANALYSIS:`);
    logger.debug(`   📥 Submitted: ${tickers.length} tickers`);
    logger.debug(`   ✅ Validated: ${finalValidTickers.length} tickers`);
    logger.debug(`   ❌ Invalid: ${tickers.length - finalValidTickers.length} tickers`);
    logger.debug(`⏱️ Ticker validation completed in ${(overallTimings.validation / 1000).toFixed(1)}s`);
    if (finalValidTickers.length > 100) {
      logger.debug(`⚡ Large portfolio detected - using optimized batching strategy`);
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
    logger.debug(`\n🔄 DATA FETCHING PHASE: Fetching essential data for ${processedTickers.length} tickers...`);
    const essentialDates = [
      `${startYear}-01-02`,
      endYear >= currentYear ? `${currentYear}-01-02` : `${endYear}-12-31`
    ];
    
    // CACHE-BASED DATA LOADING APPROACH - REQUIRED
    logger.debug(`\n🔄 CACHE VALIDATION PHASE: Checking ticker cache coverage...`);
    
    // Validate that all tickers are in the new cache format
    const allTickersNeeded = ['SPY', ...processedTickers];
    const { missing: missingTickers, eliminated: eliminatedTickers } = await validateCacheCoverage(allTickersNeeded);
    
    // Remove eliminated tickers from processedTickers
    const eliminatedTickerList = eliminatedTickers.map(e => e.ticker);
    const finalTickers = processedTickers.filter(ticker => !eliminatedTickerList.includes(ticker));
    
    if (eliminatedTickers.length > 0) {
      logger.debug(`🚫 TICKERS ELIMINATED: ${eliminatedTickers.length} tickers removed due to data quality issues: ${eliminatedTickers.map(e => `${e.ticker}(${e.reason.substring(0,50)})`).slice(0, 3).join(', ')}`);
    }
    
    if (missingTickers.length > 0) {
      logger.debug(`❌ CACHE MISS: ${missingTickers.length} tickers not cached: ${missingTickers.slice(0, 10).join(', ')}${missingTickers.length > 10 ? ` +${missingTickers.length - 10} more` : ''}`);
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
    
    logger.success(`CACHE VALIDATION COMPLETE: All ${finalAllTickersNeeded.length} tickers are cached`);
    
    // Check cache first (after ticker elimination to ensure correct cache key)
    const tickerString = processedTickers.sort().join(',');
    const cacheKey = `backtest:${tickerString}:${startYear}:${endYear}:${initialInvestment}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached backtest results');
      return res.status(200).json({ ...cached, from_cache: true });
    }
    
    // Load data from cache into runtime structure
    logger.debug(`\n📊 DATA LOADING PHASE: Loading ticker data from cache...`);
    const { data: cachedTickerData, missing: stillMissing, eliminated: stillEliminated } = await getDataFromCache(finalAllTickersNeeded);
    
    if (stillMissing.length > 0) {
      return res.status(500).json({
        error: 'Cache consistency error',
        message: `Validation passed but tickers are missing: ${stillMissing.join(', ')}`,
        missingTickers: stillMissing
      });
    }
    
    logger.success(`DATA LOADING COMPLETE: Loaded data for ${Object.keys(cachedTickerData).length} tickers`);
    logger.debug(`🎯 Strategy calculations will use 100% cached data - ZERO EODHD API calls!`);
    
    // Analyze stock availability changes across the analysis period
    logger.debug(`\n📊 AVAILABILITY ANALYSIS: Analyzing market entry/exit patterns...`);
    const availabilityData = analyzeStockAvailabilityChanges(cachedTickerData, processedTickers, startYear, endYear);
    const totalEntryExitEvents = availabilityData.reduce((sum, year) => sum + year.enteringStocks.length + year.exitingStocks.length, 0);
    logger.debug(`📈 Market dynamics: ${totalEntryExitEvents} total entry/exit events detected across ${endYear - startYear + 1} years`);
    
    // Debug: Log historical data collected
    logger.debug('Historical data collected for Excel export:', {
      tickers: Object.keys(historicalData),
      totalDataPoints: Object.values(historicalData).reduce((sum: number, dates: any) => sum + Object.keys(dates).length, 0),
      sampleData: Object.keys(historicalData).slice(0, 2).map(ticker => ({
        ticker,
        dates: Object.keys(historicalData[ticker]).slice(0, 3)
      }))
    });
    
    logger.debug(`\n🚀 STRATEGY CALCULATION PHASE: Running 5 investment strategies...`);
    logger.debug(`📊 ANALYSIS SCOPE:`);
    logger.debug(`   🎯 Processing: ${processedTickers.length} tickers`);
    logger.debug(`   📅 Period: ${startYear}-${endYear} (${endYear - startYear + 1} years)`);
    logger.debug(`   💰 Initial investment: ${formatCurrency(initialInvestment)}`);
    logger.debug(`   📋 Tickers: ${processedTickers.slice(0, 10).join(', ')}${processedTickers.length > 10 ? ` +${processedTickers.length - 10} more` : ''}`);
    
    let equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced, spyBenchmark;
    
    // Phase 2: Strategy Calculations
    const strategiesStart = Date.now();
    logger.debug(`\n⏱️ Starting strategy calculations for all 5 strategies...`);
    
    try {
      // Calculate strategies with timeout protection - scale timeout based on portfolio size
      const baseTimeout = 480000; // 8 minutes base
      const timeoutMultiplier = processedTickers.length > 75 ? 1.25 : 1.0; // Extra time for very large portfolios  
      const strategyTimeout = Math.min(baseTimeout * timeoutMultiplier, 580000); // Cap at 9.67 minutes (leave buffer before Vercel 10min limit)
      
      logger.debug(`⏱️ Strategy timeout set to ${(strategyTimeout/1000).toFixed(1)}s for ${processedTickers.length} tickers`);
      
      // For extremely large portfolios, use optimized calculation mode
      const isExtremelyLarge = processedTickers.length > 100;
      if (isExtremelyLarge) {
        logger.debug(`🚀 EXTREME PORTFOLIO MODE: Using optimized calculations for ${processedTickers.length} tickers`);
        logger.debug(`⚡ Reducing data granularity and skipping some non-essential calculations`);
      }
      
      const strategiesPromise = Promise.all([
        // Strategy 1: Equal Weight Buy & Hold
        (async () => {
          logger.debug(`\n⚖️  [1/5] CALCULATING: Equal Weight Buy & Hold Strategy`);
          logger.debug(`     📋 Portfolio: ${processedTickers.length} tickers, equal allocation each`);
          logger.debug(`     🏦 Type: Buy & Hold (no rebalancing)`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', false, historicalData, availabilityData);
          logger.success(`     COMPLETED: Equal Weight Buy & Hold - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          logger.error('Error in equalWeightBuyHold:', err);
          throw err;
        }),
        
        // Strategy 2: Market Cap Buy & Hold  
        (async () => {
          logger.debug(`\n📈 [2/5] CALCULATING: Market Cap Buy & Hold Strategy`);
          logger.debug(`     📋 Portfolio: ${processedTickers.length} tickers, weighted by market cap`);
          logger.debug(`     🏦 Type: Buy & Hold (no rebalancing)`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', false, historicalData, availabilityData);
          logger.success(`     COMPLETED: Market Cap Buy & Hold - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          logger.error('Error in marketCapBuyHold:', err);
          throw err;
        }),
        
        // Strategy 3: Equal Weight Rebalanced
        (async () => {
          logger.debug(`\n🔄 [3/5] CALCULATING: Equal Weight Rebalanced Strategy`);
          logger.debug(`     📋 Portfolio: ${processedTickers.length} tickers, equal allocation each`);
          logger.debug(`     🏦 Type: Rebalanced annually`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'equalWeight', true, historicalData, availabilityData);
          logger.success(`     COMPLETED: Equal Weight Rebalanced - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          logger.error('Error in equalWeightRebalanced:', err);
          throw err;
        }),
        
        // Strategy 4: Market Cap Rebalanced
        (async () => {
          logger.debug(`\n📊 [4/5] CALCULATING: Market Cap Rebalanced Strategy`);
          logger.debug(`     📋 Portfolio: ${processedTickers.length} tickers, weighted by market cap`);
          logger.debug(`     🏦 Type: Rebalanced annually`);
          const result = await calculateStrategy(processedTickers, startYear, endYear, initialInvestment, 'marketCap', true, historicalData, availabilityData);
          logger.success(`     COMPLETED: Market Cap Rebalanced - ${processedTickers.length} tickers - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          logger.error('Error in marketCapRebalanced:', err);
          throw err;
        }),
        
        // Strategy 5: SPY Benchmark
        (async () => {
          logger.debug(`\n🏛️  [5/5] CALCULATING: SPY Benchmark Strategy`);
          logger.debug(`     📋 Benchmark: SPY ETF only`);
          logger.debug(`     🏦 Type: Buy & Hold SPY`);
          
          // Check if SPY data is available
          const spyTicker = historicalData['SPY'] ? 'SPY' : historicalData['SPY.US'] ? 'SPY.US' : null;
          if (!spyTicker) {
            logger.warn(`     ⚠️  SPY data not available in historical data`);
            return null;
          }
          
          const result = await calculateStrategy([spyTicker], startYear, endYear, initialInvestment, 'equalWeight', false, historicalData, availabilityData);
          logger.success(`     COMPLETED: SPY Benchmark - 1 ticker - Final value: ${formatCurrency(result.finalValue)}`);
          return result;
        })().catch(err => {
          logger.error('Error in spyBenchmark:', err);
          return null; // Return null instead of throwing
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
      logger.success(`ALL STRATEGY CALCULATIONS COMPLETED SUCCESSFULLY!`);
      logger.debug(`⏱️ Strategy calculations completed in ${(overallTimings.strategies / 1000).toFixed(1)}s`);
      logger.debug(`📊 FINAL TICKER COUNT: ${processedTickers.length} tickers successfully analyzed`);
      logger.debug(`📈 FINAL RESULTS SUMMARY:`);
      logger.debug(`   ⚖️  Equal Weight Buy & Hold:    ${formatCurrency(equalWeightBuyHold.finalValue)} (${equalWeightBuyHold.totalReturn.toFixed(2)}%)`);
      logger.debug(`   📈 Market Cap Buy & Hold:      ${formatCurrency(marketCapBuyHold.finalValue)} (${marketCapBuyHold.totalReturn.toFixed(2)}%)`);
      logger.debug(`   🔄 Equal Weight Rebalanced:    ${formatCurrency(equalWeightRebalanced.finalValue)} (${equalWeightRebalanced.totalReturn.toFixed(2)}%)`);
      logger.debug(`   📊 Market Cap Rebalanced:      ${formatCurrency(marketCapRebalanced.finalValue)} (${marketCapRebalanced.totalReturn.toFixed(2)}%)`);
      logger.debug(`   🏛️  SPY Benchmark:              ${formatCurrency(spyBenchmark.finalValue)} (${spyBenchmark.totalReturn.toFixed(2)}%)`);
      
      // Find best performing strategy
      const strategies = [
        { name: 'Equal Weight Buy & Hold', value: equalWeightBuyHold.finalValue, icon: '⚖️' },
        { name: 'Market Cap Buy & Hold', value: marketCapBuyHold.finalValue, icon: '📈' },
        { name: 'Equal Weight Rebalanced', value: equalWeightRebalanced.finalValue, icon: '🔄' },
        { name: 'Market Cap Rebalanced', value: marketCapRebalanced.finalValue, icon: '📊' },
        { name: 'SPY Benchmark', value: spyBenchmark.finalValue, icon: '🏛️' }
      ];
      const topStrategy = strategies.reduce((a, b) => a.value > b.value ? a : b);
      logger.debug(`🏆 TOP PERFORMER: ${topStrategy.icon} ${topStrategy.name} - ${formatCurrency(topStrategy.value)}`);
      
      logger.debug(`⏱️ STRATEGIES COMPLETE - Starting results finalization...`);
    } catch (strategyError) {
      logger.error('Strategy calculation failed:', strategyError);
      
      // User requested no arbitrary limits - just re-throw the error
      logger.debug(`Strategy calculation failed for ${processedTickers.length} tickers. No fallback limits applied as requested.`);
      throw strategyError;
    }

    // Phase 3: Results Finalization
    const finalizationStart = Date.now();
    logger.debug(`\n📦 FINALIZING RESULTS: Preparing comprehensive analysis package...`);
    
    logger.debug(`   📊 Consolidating strategy results...`);
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
      // Strategy performance summary for quick access in simulation history
      strategyPerformance: (() => {
        const strategies = [
          { name: 'Equal Weight Buy & Hold', data: equalWeightBuyHold },
          { name: 'Market Cap Buy & Hold', data: marketCapBuyHold },
          { name: 'Equal Weight Rebalanced', data: equalWeightRebalanced },
          { name: 'Market Cap Rebalanced', data: marketCapRebalanced }
        ].filter(s => s.data && s.data.finalValue);

        if (strategies.length === 0) return null;

        const winningStrategy = strategies.reduce((prev, current) => 
          (current.data.finalValue > prev.data.finalValue) ? current : prev
        );
        const worstStrategy = strategies.reduce((prev, current) => 
          (current.data.finalValue < prev.data.finalValue) ? current : prev
        );

        return {
          winningStrategy: {
            name: winningStrategy.name,
            finalValue: winningStrategy.data.finalValue
          },
          worstStrategy: {
            name: worstStrategy.name,
            finalValue: worstStrategy.data.finalValue
          },
          spyBenchmark: spyBenchmark ? {
            name: 'SPY Benchmark',
            finalValue: spyBenchmark.finalValue,
            annualizedReturn: spyBenchmark.annualizedReturn || (
              // Calculate annualized return if not provided
              endYear > startYear 
                ? Math.pow(spyBenchmark.finalValue / initialInvestment, 1 / (endYear - startYear)) - 1
                : (spyBenchmark.finalValue - initialInvestment) / initialInvestment
            )
          } : undefined
        };
      })(),
      message: processedTickers.length > 10 ? 
        'Note: Calculations based on real market data. Large portfolios may take time to process.' :
        'Calculations based on real EODHD market data with SPY benchmark.'
    };
    
    logger.debug(`   📋 Adding metadata and parameters...`);
    logger.debug(`   📈 Including historical data (${Object.keys(historicalData).length} ticker datasets)...`);
    logger.debug(`   🔧 Preparing debug information...`);

    // Add final timing information
    overallTimings.finalization = Date.now() - finalizationStart;
    overallTimings.total = Date.now() - apiStartTime;
    overallTimings.cacheAndResponse = overallTimings.total - overallTimings.validation - overallTimings.strategies - overallTimings.finalization;
    
    // Log comprehensive timing breakdown
    logger.debug(`\n⏱️ === COMPREHENSIVE TIMING BREAKDOWN ===`);
    logger.debug(`📋 Ticker Validation: ${(overallTimings.validation / 1000).toFixed(1)}s`);
    logger.debug(`🧮 Strategy Calculations: ${(overallTimings.strategies / 1000).toFixed(1)}s`);
    logger.debug(`📦 Results Finalization: ${(overallTimings.finalization / 1000).toFixed(1)}s`);
    logger.debug(`💾 Cache & Response: ${(overallTimings.cacheAndResponse / 1000).toFixed(1)}s`);
    logger.debug(`⏱️ Total API Time: ${(overallTimings.total / 1000).toFixed(1)}s`);
    logger.debug(`📊 Processing Efficiency: ${(processedTickers.length / (overallTimings.total / 1000)).toFixed(1)} tickers/second`);
    
    // Cache permanently since all analysis is limited to historical data (through Jan 1 current year)
    logger.debug(`   💾 Caching results permanently (all data is historical)...`);
    await cache.set(cacheKey, results); // No expiration - permanent cache
    
    // Add to centralized simulation summaries
    const summary = {
      key: cacheKey,
      tickers: finalValidTickers,
      startYear,
      endYear,
      initialInvestment,
      tickerCount: finalValidTickers.length,
      cachedAt: new Date().toISOString(),
      isPermanent: endYear < new Date().getFullYear(),
      customName: results.customName || undefined,
      strategyPerformance: results.strategyPerformance,
      analysisDate: results.parameters?.analysisDate
    };
    
    const { addSimulationSummary } = await import('./_simulationSummaries');
    await addSimulationSummary(summary);
    
    // Update cache stats
    const { addBacktestToStats } = await import('./_cacheStats');
    await addBacktestToStats(cacheKey);
    
    logger.success(`   Results cached successfully`);

    logger.debug(`\n🚀 SENDING RESPONSE TO FRONTEND...`);
    logger.debug(`📦 Final package size: ${Object.keys(results).length} main sections`);
    logger.success(`Analysis complete for ${processedTickers.length} tickers!`);

    res.status(200).json({ 
      ...results, 
      from_cache: false,
      timings: overallTimings
    });
  } catch (error: any) {
    return handleApiError(res, error, 'Backtest operation');
  }
}