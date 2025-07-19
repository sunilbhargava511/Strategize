// api/market-cap.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const cache = require('./_upstashCache');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticker, date } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    // Add your market cap logic here
    // For now, returning mock data
    const mockData = {
      ticker: ticker as string,
      date: date as string || new Date().toISOString().split('T')[0],
      marketCap: 1000000000,
      price: 100,
      shares: 10000000
    };

    res.status(200).json(mockData);
  } catch (error) {
    console.error('Market cap error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market cap', 
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
