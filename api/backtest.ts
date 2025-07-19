// api/backtest.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

    // Run all strategies
    const [equalWeightBH, marketCapBH, equalWeightReb, marketCapReb] = await Promise.all([
      runEqualWeightBuyHold(startYear, endYear, initialInvestment),
      runMarketCapBuyHold(startYear, endYear, initialInvestment),
      runEqualWeightRebalanced(startYear, endYear, initialInvestment),
      runMarketCapRebalanced(startYear, endYear, initialInvestment)
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
