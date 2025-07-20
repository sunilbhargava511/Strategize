// api/market-cap.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { cache } from './_upstashCache';

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

    // Type assertions for query parameters
    const tickerStr = ticker as string;
    const dateStr = date as string || new Date().toISOString().split('T')[0];

    // Check cache first
    const cacheKey = `market-cap:${tickerStr}:${dateStr}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${tickerStr} on ${dateStr}`);
      return res.status(200).json(cached);
    }

    console.log(`Cache miss for ${tickerStr} on ${dateStr} - fetching from EOD API`);

    // Get API key from environment - note it's EODHD_API_TOKEN not EOD_API_KEY
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
      return res.status(500).json({ 
        error: 'API configuration error',
        message: 'EODHD_API_TOKEN not configured'
      });
    }

    // Fetch price data from EOD API
    const priceUrl = `https://eodhd.com/api/eod/${tickerStr}.US?from=${dateStr}&to=${dateStr}&api_token=${EOD_API_KEY}&fmt=json`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      throw new Error(`EOD API price request failed: ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    
    if (!priceData || !Array.isArray(priceData) || priceData.length === 0) {
      return res.status(404).json({ 
        error: 'No data found',
        message: `No price data available for ${tickerStr} on ${dateStr}`,
        ticker: tickerStr,
        date: dateStr
      });
    }

    // Get the price data for the requested date
    const dayData = priceData[0];

    // Prepare result
    const result = {
      ticker: `${tickerStr}.US`,
      date: dateStr,
      price: dayData.close,
      open: dayData.open,
      high: dayData.high,
      low: dayData.low,
      volume: dayData.volume,
      adjusted_close: dayData.adjusted_close
    };

    // Cache forever - historical data doesn't change
    await cache.set(cacheKey, result);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Market cap error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      message: error.message 
    });
  }
}