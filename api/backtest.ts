// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';

interface StockData {
  ticker: string;
  date: string;
  price: number;
  adjusted_close: number;
}

interface StrategyResult {
  totalReturn: number;
  annualizedReturn: number;
  finalValue: number;
  yearlyValues: Record<number, number>;
}

async function fetchStockData(ticker: string, date: string, bypassCache: boolean = false): Promise<StockData | null> {
  try {
    // Use our existing market-cap API endpoint
    const bypassParam = bypassCache ? '&bypass_cache=true' : '';
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/market-cap?ticker=${ticker}&date=${date}${bypassParam}`);
    
    console.log(`Fetching data for ${ticker} on ${date}, response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch data for ${ticker} on ${date}, status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Data for ${ticker} on ${date}:`, { 
      price: data.adjusted_close || data.price, 
      from_cache: data.from_cache,
      raw_response: data
    });
    
    // Check if we got valid price data
    if (!data.adjusted_close && !data.price) {
      console.error(`No price data found for ${ticker} on ${date}:`, data);
      return null;
    }
    
    return {
      ticker: ticker, // Use original ticker, not the .US version
      date: data.date,
      price: data.adjusted_close || data.price,
      adjusted_close: data.adjusted_close || data.price
    };
  } catch (error) {
    console.error(`Error fetching ${ticker} on ${date}:`, error);
    return null;
  }
}

async function calculateStrategy(
  tickers: string[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  strategyType: 'equalWeight' | 'marketCap',
  rebalance: boolean,
  bypassCache: boolean = false
): Promise<StrategyResult> {
  const yearlyValues: Record<number, number> = {};
  let currentValue = initialInvestment;
  
  // Get start of year dates
  const years = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year);
  }
  
  // For simplicity, we'll use January 2nd of each year (to avoid holidays)
  const startDate = `${startYear}-01-02`;
  const endDate = `${endYear}-12-31`;
  
  // Fetch initial prices
  const initialPrices: Record<string, number> = {};
  const finalPrices: Record<string, number> = {};
  
  for (const ticker of tickers) {
    const startData = await fetchStockData(ticker, startDate, bypassCache);
    const endData = await fetchStockData(ticker, endDate, bypassCache);
    
    if (startData && endData) {
      initialPrices[ticker] = startData.adjusted_close;
      finalPrices[ticker] = endData.adjusted_close;
    }
  }
  
  // Calculate returns (simplified - not handling yearly rebalancing yet)
  const validTickers = Object.keys(initialPrices);
  console.log('Backtest calculation:', { 
    tickerCount: tickers.length, 
    validTickerCount: validTickers.length,
    validTickers: validTickers.slice(0, 3),
    initialPrices: Object.fromEntries(Object.entries(initialPrices).slice(0, 3)),
    finalPrices: Object.fromEntries(Object.entries(finalPrices).slice(0, 3)),
    startDate,
    endDate,
    strategyType,
    rebalance
  });
  
  if (validTickers.length === 0) {
    console.log('No valid tickers found, returning zero results');
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      finalValue: initialInvestment,
      yearlyValues
    };
  }
  
  // Equal weight calculation
  if (strategyType === 'equalWeight') {
    const perStockInvestment = initialInvestment / validTickers.length;
    let totalEndValue = 0;
    
    for (const ticker of validTickers) {
      const startPrice = initialPrices[ticker];
      const endPrice = finalPrices[ticker];
      const stockReturn = (endPrice - startPrice) / startPrice;
      const stockEndValue = perStockInvestment * (1 + stockReturn);
      totalEndValue += stockEndValue;
    }
    
    currentValue = totalEndValue;
  } else {
    // Market cap weighted - for now, use equal weight as placeholder
    // TODO: Fetch market cap data and weight accordingly
    const perStockInvestment = initialInvestment / validTickers.length;
    let totalEndValue = 0;
    
    for (const ticker of validTickers) {
      const startPrice = initialPrices[ticker];
      const endPrice = finalPrices[ticker];
      const stockReturn = (endPrice - startPrice) / startPrice;
      const stockEndValue = perStockInvestment * (1 + stockReturn);
      totalEndValue += stockEndValue;
    }
    
    currentValue = totalEndValue;
  }
  
  // Calculate returns
  const totalReturn = ((currentValue - initialInvestment) / initialInvestment) * 100;
  const yearsDuration = endYear - startYear;
  const annualizedReturn = yearsDuration > 0 ? (Math.pow(currentValue / initialInvestment, 1 / yearsDuration) - 1) * 100 : totalReturn;
  
  return {
    totalReturn,
    annualizedReturn,
    finalValue: currentValue,
    yearlyValues
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
    console.log('=== BACKTEST API CALLED ===');
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

    // Check cache first (unless bypassed)
    const tickerString = tickers.sort().join(',');
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickerString}`;
    if (!bypass_cache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log('Returning cached backtest results');
        return res.status(200).json({ ...cached, from_cache: true });
      }
    } else {
      console.log('Cache bypassed for backtest');
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
          yearlyValues: {}
        },
        marketCapBuyHold: {
          totalReturn: ((Math.pow(1 + (baseReturn + 2)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 2,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 2)/100, yearRange),
          yearlyValues: {}
        },
        equalWeightRebalanced: {
          totalReturn: ((Math.pow(1 + (baseReturn + 3)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 3,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 3)/100, yearRange),
          yearlyValues: {}
        },
        marketCapRebalanced: {
          totalReturn: ((Math.pow(1 + (baseReturn + 1.5)/100, yearRange) - 1) * 100),
          annualizedReturn: baseReturn + 1.5,
          finalValue: initialInvestment * Math.pow(1 + (baseReturn + 1.5)/100, yearRange),
          yearlyValues: {}
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
    console.log(`EODHD_API_TOKEN found, running real backtest for ${tickers.length} tickers from ${startYear} to ${endYear}`);
    
    const [equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced] = await Promise.all([
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'equalWeight', false, bypass_cache),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'marketCap', false, bypass_cache),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'equalWeight', true, bypass_cache),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'marketCap', true, bypass_cache)
    ]);

    const results = {
      equalWeightBuyHold,
      marketCapBuyHold,
      equalWeightRebalanced,
      marketCapRebalanced,
      parameters: { 
        startYear, 
        endYear, 
        initialInvestment,
        tickerCount: tickers.length,
        tickers: tickers.slice(0, 10)
      },
      debug: {
        equalWeightResult: equalWeightBuyHold.finalValue,
        marketCapResult: marketCapBuyHold.finalValue,
        equalWeightRebalancedResult: equalWeightRebalanced.finalValue,
        marketCapRebalancedResult: marketCapRebalanced.finalValue
      },
      message: tickers.length > 10 ? 
        'Note: Calculations based on real market data. Large portfolios may take time to process.' :
        'Calculations based on real EODHD market data.'
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