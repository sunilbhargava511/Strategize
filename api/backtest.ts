// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { cache } from './_upstashCache';

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

    // Check cache first
    const tickerString = tickers.sort().join(',');
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickerString}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached backtest results');
      return res.status(200).json(cached);
    }

    // Generate more realistic mock results based on input
    // TODO: Replace with actual strategy calculations
    const yearRange = endYear - startYear;
    const baseReturn = 8 + (Math.random() * 4); // 8-12% base annual return
    
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
        tickerCount: tickers.length || 0,
        tickers: tickers.slice(0, 5) // Show first 5 tickers
      },
      message: 'Note: This is simulated data. Integration with actual strategy calculations is in progress.'
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