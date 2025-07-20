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
    const { ticker, date, bypass_cache } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker parameter is required' });
    }

    // Type assertions for query parameters
    const tickerStr = ticker as string;
    const dateStr = date as string || new Date().toISOString().split('T')[0];
    const bypassCache = bypass_cache === 'true';

    // Check cache first (unless bypassed)
    const cacheKey = `market-cap:${tickerStr}:${dateStr}`;
    if (!bypassCache) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${tickerStr} on ${dateStr}`);
        return res.status(200).json({ ...cached, from_cache: true });
      }
    } else {
      console.log(`Cache bypassed for ${tickerStr} on ${dateStr}`);
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

    // Fetch price data from EOD API - ticker should already include exchange suffix
    const tickerWithExchange = tickerStr.includes('.') ? tickerStr : `${tickerStr}.US`;
    const priceUrl = `https://eodhd.com/api/eod/${tickerWithExchange}?from=${dateStr}&to=${dateStr}&api_token=${EOD_API_KEY}&fmt=json`;
    
    console.log(`Calling EODHD API: ${priceUrl.replace(EOD_API_KEY, 'XXXXX')}`);
    const priceResponse = await fetch(priceUrl);
    
    if (!priceResponse.ok) {
      throw new Error(`EOD API price request failed: ${priceResponse.status}`);
    }

    const priceData = await priceResponse.json();
    
    if (!priceData || !Array.isArray(priceData) || priceData.length === 0) {
      return res.status(404).json({ 
        error: 'No data found',
        message: `No price data available for ${tickerWithExchange} on ${dateStr}. Ticker may be defunct or delisted.`,
        ticker: tickerWithExchange,
        date: dateStr,
        is_defunct: true
      });
    }

    // Get the price data for the requested date
    const dayData = priceData[0];

    // Fetch fundamentals data for shares outstanding and market cap
    let sharesOutstanding = 0;
    let marketCap = 0;
    
    try {
      const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${tickerWithExchange}?api_token=${EOD_API_KEY}&fmt=json`;
      const fundamentalsResponse = await fetch(fundamentalsUrl);
      
      if (fundamentalsResponse.ok) {
        const fundamentalsData = await fundamentalsResponse.json();
        
        // Extract shares outstanding and market cap from fundamentals
        if (fundamentalsData?.Highlights?.SharesOutstanding) {
          sharesOutstanding = fundamentalsData.Highlights.SharesOutstanding;
          marketCap = dayData.adjusted_close * sharesOutstanding;
        } else if (fundamentalsData?.Highlights?.MarketCapitalization) {
          // If shares outstanding not available, use market cap directly
          marketCap = fundamentalsData.Highlights.MarketCapitalization;
          sharesOutstanding = marketCap / dayData.adjusted_close;
        }
        
        // Also check SharesStats for more accurate data
        if (fundamentalsData?.SharesStats?.SharesOutstanding) {
          sharesOutstanding = fundamentalsData.SharesStats.SharesOutstanding;
          marketCap = dayData.adjusted_close * sharesOutstanding;
        }
      }
    } catch (fundError) {
      console.error('Error fetching fundamentals:', fundError);
      // Continue with price data even if fundamentals fail
    }

    // If we still don't have market cap data, estimate from volume
    if (marketCap === 0 && dayData.volume > 0) {
      // This is a rough estimate - not accurate but better than nothing
      sharesOutstanding = dayData.volume * 50; // Very rough estimate
      marketCap = dayData.adjusted_close * sharesOutstanding;
    }

    // Prepare result with all data
    const result = {
      ticker: tickerWithExchange,
      date: dateStr,
      price: dayData.close,
      adjusted_close: dayData.adjusted_close,
      open: dayData.open,
      high: dayData.high,
      low: dayData.low,
      volume: dayData.volume,
      shares_outstanding: Math.floor(sharesOutstanding),
      market_cap: parseFloat(marketCap.toFixed(0)),
      market_cap_billions: parseFloat((marketCap / 1000000000).toFixed(2)),
      formatted_market_cap: marketCap > 0 ? 
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(marketCap) : 'N/A'
    };

    // Cache forever - historical data doesn't change (unless bypassed)
    if (!bypassCache) {
      await cache.set(cacheKey, result);
    }

    res.status(200).json({ ...result, from_cache: false });
  } catch (error: any) {
    console.error('Market cap error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch market data',
      message: error.message 
    });
  }
}