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
    const { startYear, endYear, initialInvestment } = req.body;

    // Validate inputs
    if (!startYear || !endYear || !initialInvestment) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['startYear', 'endYear', 'initialInvestment']
      });
    }

    // Check cache first
    const cacheKey = `backtest:${startYear}:${endYear}:${initialInvestment}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('Returning cached backtest results');
      return res.status(200).json(cached);
    }

    // For now, return mock results
    // TODO: Implement actual backtest logic here or call an external service
    const results = {
      equalWeightBuyHold: {
        totalReturn: 1245.32,
        annualizedReturn: 20.15,
        finalValue: initialInvestment * 13.45,
        yearlyValues: {}
      },
      marketCapBuyHold: {
        totalReturn: 1658.07,
        annualizedReturn: 22.74,
        finalValue: initialInvestment * 17.58,
        yearlyValues: {}
      },
      equalWeightRebalanced: {
        totalReturn: 4998.60,
        annualizedReturn: 32.45,
        finalValue: initialInvestment * 50.99,
        yearlyValues: {}
      },
      marketCapRebalanced: {
        totalReturn: 1676.94,
        annualizedReturn: 22.84,
        finalValue: initialInvestment * 17.77,
        yearlyValues: {}
      },
      parameters: { startYear, endYear, initialInvestment },
      message: 'Note: This is mock data. Full implementation requires strategy calculation logic.'
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