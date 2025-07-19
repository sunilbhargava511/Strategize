// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';

// Simple CSV parser for the stock data
async function loadStockData() {
  const csvPath = path.join(process.cwd(), 'data', 'sp500_ticker_start_end.csv');
  const csvContent = await fs.readFile(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      ticker: values[0],
      startDate: values[1],
      endDate: values[2] || null
    };
  });
}

// Mock price data fetcher (replace with actual API call if needed)
async function priceDataFetcher(ticker: string, date: string) {
  // For now, return mock data
  // In production, this would fetch from your market data API
  return {
    ticker,
    date,
    price: 100 + Math.random() * 200,
    adjustedPrice: 100 + Math.random() * 200,
    sharesOutstanding: 1000000000 + Math.random() * 1000000000,
    marketCap: (100 + Math.random() * 200) * (1000000000 + Math.random() * 1000000000)
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      startYear = 2010, 
      endYear = 2024, 
      initialInvestment = 1000000 
    } = req.body;

    console.log('Starting backtest:', { startYear, endYear, initialInvestment });

    // Load stock data
    const stocks = await loadStockData();

    // Dynamic imports for the strategies
    const [
      { runEqualWeightBuyHold },
      { runMarketCapBuyHold },
      { runEqualWeightRebalanced },
      { runMarketCapRebalanced }
    ] = await Promise.all([
      import('../src/lib/strategies/equalWeightBuyHold'),
      import('../src/lib/strategies/marketCapBuyHold'),
      import('../src/lib/strategies/equalWeightRebalanced'),
      import('../src/lib/strategies/marketCapRebalanced')
    ]);

    // Run all strategies with ALL required parameters
    const [equalWeightBH, marketCapBH, equalWeightReb, marketCapReb] = await Promise.all([
      runEqualWeightBuyHold(stocks, startYear, endYear, initialInvestment, priceDataFetcher),
      runMarketCapBuyHold(stocks, startYear, endYear, initialInvestment, priceDataFetcher),
      runEqualWeightRebalanced(stocks, startYear, endYear, initialInvestment, priceDataFetcher),
      runMarketCapRebalanced(stocks, startYear, endYear, initialInvestment, priceDataFetcher)
    ]);

    const results = {
      equalWeightBuyHold: equalWeightBH,
      marketCapBuyHold: marketCapBH,
      equalWeightRebalanced: equalWeightReb,
      marketCapRebalanced: marketCapReb,
      parameters: { startYear, endYear, initialInvestment }
    };

    res.status(200).json(results);
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ 
      error: 'Backtest failed', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}