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

    // Type assertions for query parameters
    const tickerStr = ticker as string;
    const dateStr = date as string || new Date().toISOString().split('T')[0];

    // Check cache first
    const cached = await cache.get(tickerStr, dateStr);
    if (cached) {
      console.log(`Cache hit for ${tickerStr} on ${dateStr}`);
      return res.status(200).json(cached);
    }

    console.log(`Cache miss for ${tickerStr} on ${dateStr} - fetching from EOD API`);

    // Get API key from environment
    const EOD_API_KEY = process.env.EOD_API_KEY;
    if (!EOD_API_KEY) {
      return res.status(500).json({ 
        error: 'API configuration error',
        message: 'EOD_API_KEY not configured'
      });
    }

    // Fetch price data from EOD API
    const priceUrl = `https://eodhd.com/api/eod/${tickerStr}.US?from=${dateStr}&to=${dateStr}&api_token=${EOD_API_KEY}&fmt=json`;
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      throw new Error(`EOD API price request failed: ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    
    if (!priceData || priceData.length === 0) {
      return res.status(404).json({ 
        error: 'No data found',
        message: `No price data available for ${tickerStr} on ${dateStr}`,
        ticker: tickerStr,
        date: dateStr
      });
    }

    // Get the price data for the requested date
    const dayData = priceData[0];

    // Fetch fundamentals data for shares outstanding
    // Note: This requires a separate API call with EOD
    let sharesOutstanding = 0;
    let marketCap = 0;

    try {
      const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${tickerStr}.US?api_token=${EOD_API_KEY}&fmt=json`;
      const fundamentalsResponse = await fetch(fundamentalsUrl);
      
      if (fundamentalsResponse.ok) {
        const fundamentalsData = await fundamentalsResponse.json();
        
        // Extract shares outstanding from fundamentals data
        if (fundamentalsData?.Highlights?.SharesOutstanding) {
          sharesOutstanding = fundamentalsData.Highlights.SharesOutstanding;
          marketCap = dayData.adjusted_close * sharesOutstanding;
        } else if (fundamentalsData?.Highlights?.MarketCapitalization) {
          // If shares outstanding not available, use market cap directly
          marketCap = fundamentalsData.Highlights.MarketCapitalization;
          sharesOutstanding = marketCap / dayData.adjusted_close;
        }
      }
    } catch (fundError) {
      console.error('Error fetching fundamentals:', fundError);
      // Continue with price data even if fundamentals fail
    }

    // If we still don't have market cap data, try to calculate from volume
    if (marketCap === 0 && dayData.volume > 0) {
      // This is a rough estimate - not accurate but better than nothing
      sharesOutstanding = dayData.volume * 100; // Very rough estimate
      marketCap = dayData.adjusted_close * sharesOutstanding;
    }

    const result = {
      ticker: `${tickerStr}.US`,
      date: dayData.date,
      price: dayData.close,
      adjustedPrice: dayData.adjusted_close,
      open: dayData.open,
      high: dayData.high,
      low: dayData.low,
      volume: dayData.volume,
      sharesOutstanding: Math.floor(sharesOutstanding),
      marketCap: parseFloat(marketCap.toFixed(0)),
      marketCapBillions: parseFloat((marketCap / 1000000000).toFixed(2)),
      formattedMarketCap: marketCap > 0 ? `$${marketCap.toLocaleString()}` : 'N/A'
    };

    // Cache the result
    await cache.set(tickerStr, dateStr, result);
    
    // Log cache stats
    const stats = cache.getStats();
    console.log(`Cache stats - Hits: ${stats.hits}, Misses: ${stats.misses}, Total: ${stats.totalKeys}`);

    res.status(200).json(result);

  } catch (error) {
    console.error('Market cap error:', error);
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Unable to connect to market data provider',
        ticker: req.query.ticker,
        date: req.query.date
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch market cap', 
      message: error instanceof Error ? error.message : 'Unknown error',
      ticker: req.query.ticker,
      date: req.query.date
    });
  }
}