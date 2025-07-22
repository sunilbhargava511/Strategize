// api/batch-backtest.ts
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

  const { tickers, startYear, endYear, initialInvestment, bypass_cache } = req.body;

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

  // Validate input
  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid tickers array' });
  }

  if (tickers.length < 100) {
    return res.status(400).json({ 
      error: 'Use regular /api/backtest for portfolios under 100 tickers',
      redirect: '/api/backtest'
    });
  }

  console.log(`🚀 BATCH PROCESSING: Starting analysis for ${tickers.length} tickers`);
  console.log(`📊 This will be processed in smaller batches to avoid timeouts`);

  try {
    // For very large portfolios, we'll return a simplified analysis
    // Focus on the most important metrics and reduce computation complexity
    
    const batchSize = 25; // Process in batches of 25
    const batches = [];
    
    for (let i = 0; i < tickers.length; i += batchSize) {
      batches.push(tickers.slice(i, i + batchSize));
    }
    
    console.log(`📦 Split ${tickers.length} tickers into ${batches.length} batches of ~${batchSize} tickers each`);
    
    // For now, return a placeholder response indicating batch processing is needed
    return res.status(202).json({
      message: 'Large portfolio detected - batch processing required',
      totalTickers: tickers.length,
      batchCount: batches.length,
      batchSize: batchSize,
      estimatedTime: `${Math.ceil(batches.length * 2)} minutes`,
      recommendation: 'Consider reducing portfolio size to under 75 tickers for single-batch processing',
      status: 'batch_required'
    });

  } catch (error: any) {
    console.error('Batch backtest error:', error);
    return res.status(500).json({
      error: 'Batch processing failed',
      message: error.message
    });
  }
}