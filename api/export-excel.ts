import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const { results } = req.body;

    if (!results) {
      return res.status(400).json({ error: 'No results data provided' });
    }

    // Create a simple CSV format (Excel-compatible)
    let csv = 'Strategy,Total Return (%),Annualized Return (%),Final Value\n';
    
    const strategies = [
      { key: 'equalWeightBuyHold', name: 'Equal Weight Buy & Hold' },
      { key: 'marketCapBuyHold', name: 'Market Cap Buy & Hold' },
      { key: 'equalWeightRebalanced', name: 'Equal Weight Rebalanced' },
      { key: 'marketCapRebalanced', name: 'Market Cap Rebalanced' },
    ];

    strategies.forEach(strategy => {
      if (results[strategy.key]) {
        const data = results[strategy.key];
        csv += `"${strategy.name}",${data.totalReturn},${data.annualizedReturn},${data.finalValue}\n`;
      }
    });

    // Add parameters section
    if (results.parameters) {
      csv += '\n\nAnalysis Parameters\n';
      csv += `Period,${results.parameters.startYear} - ${results.parameters.endYear}\n`;
      csv += `Initial Investment,$${results.parameters.initialInvestment}\n`;
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="backtest-results.csv"');
    
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}