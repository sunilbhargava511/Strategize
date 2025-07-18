// api/backtest.js
const { runEqualWeightBuyHold } = require('../src/lib/strategies/equalWeightBuyHold');
const { runMarketCapBuyHold } = require('../src/lib/strategies/marketCapBuyHold');
const { runEqualWeightRebalanced } = require('../src/lib/strategies/equalWeightRebalanced');
const { runMarketCapRebalanced } = require('../src/lib/strategies/marketCapRebalanced');

module.exports = async (req, res) => {
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
      message: error.message 
    });
  }
};
