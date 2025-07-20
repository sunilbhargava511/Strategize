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

async function fetchStockData(ticker: string, date: string): Promise<StockData | null> {
  try {
    // Use our existing market-cap API endpoint
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/market-cap?ticker=${ticker}&date=${date}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch data for ${ticker} on ${date}`);
      return null;
    }
    
    const data = await response.json();
    return {
      ticker: data.ticker,
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
  rebalance: boolean
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
    const startData = await fetchStockData(ticker, startDate);
    const endData = await fetchStockData(ticker, endDate);
    
    if (startData && endData) {
      initialPrices[ticker] = startData.adjusted_close;
      finalPrices[ticker] = endData.adjusted_close;
    }
  }
  
  // Calculate returns (simplified - not handling yearly rebalancing yet)
  const validTickers = Object.keys(initialPrices);
  if (validTickers.length === 0) {
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
  const years = endYear - startYear;
  const annualizedReturn = years > 0 ? (Math.pow(currentValue / initialInvestment, 1 / years) - 1) * 100 : totalReturn;
  
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
    const { startYear, endYear, initialInvestment, tickers = [] } = req.body;

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

    // Check cache first
    const tickerString = tickers.sort().join(',');
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickerString}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached backtest results');
      return res.status(200).json(cached);
    }

    // Check if we have EODHD API token
    if (!process.env.EODHD_API_TOKEN) {
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
      
      await cache.set(cacheKey, results, 3600);
      return res.status(200).json(results);
    }

    // Calculate real results using EODHD data
    console.log(`Running backtest for ${tickers.length} tickers from ${startYear} to ${endYear}`);
    
    const [equalWeightBuyHold, marketCapBuyHold, equalWeightRebalanced, marketCapRebalanced] = await Promise.all([
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'equalWeight', false),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'marketCap', false),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'equalWeight', true),
      calculateStrategy(tickers, startYear, endYear, initialInvestment, 'marketCap', true)
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
      message: tickers.length > 10 ? 
        'Note: Calculations based on real market data. Large portfolios may take time to process.' :
        'Calculations based on real EODHD market data.'
    };

    // Cache results for 1 hour
    await cache.set(cacheKey, results, 3600);

    res.status(200).json(results);
  } catch (error: any) {
    console.error('Backtest error:', error);
    res.status(500).json({ 
      error: 'Backtest failed', 
      message: error.message 
    });
  }
}