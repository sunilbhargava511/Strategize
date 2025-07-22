import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

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
    // Check if Redis is configured
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return res.status(500).json({ 
        error: 'Cache not configured',
        message: 'Redis environment variables not set'
      });
    }

    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    // Get all keys (with pattern matching for safety)
    const tickerDataKeys = await redis.keys('ticker-data:*');
    const backtestKeys = await redis.keys('backtest:*');
    
    console.log(`Found ${tickerDataKeys.length} ticker-data entries and ${backtestKeys.length} backtest entries`);

    // Fetch all ticker data
    const tickerData: any[] = [];
    for (const key of tickerDataKeys.slice(0, 1000)) { // Limit to 1000 to avoid timeout
      try {
        const value = await redis.get(key);
        if (value) {
          // Parse key to extract ticker
          const parts = key.split(':');
          if (parts.length >= 2) {
            const ticker = parts[1];
            // Flatten the yearly data for CSV export
            for (const [year, yearData] of Object.entries(value as any)) {
              tickerData.push({
                key,
                ticker,
                year,
                data: yearData
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching ${key}:`, err);
      }
    }

    // Create CSV content for new ticker-based structure
    let csv = 'Ticker,Year,Price,Market Cap,Shares Outstanding\n';
    
    tickerData.forEach(item => {
      const data = item.data;
      csv += `${item.ticker},${item.year},${data.price || ''},${data.market_cap || ''},${data.shares_outstanding || ''}\n`;
    });

    // Add summary section
    csv += '\n\nCache Summary\n';
    csv += `Total Ticker Data Entries,${tickerDataKeys.length}\n`;
    csv += `Total Data Points,${tickerData.length}\n`;
    csv += `Total Backtest Entries,${backtestKeys.length}\n`;
    csv += `Export Date,${new Date().toISOString()}\n`;
    
    if (tickerDataKeys.length > 1000) {
      csv += `\nNote: Export limited to first 1000 ticker entries. Total ticker entries: ${tickerDataKeys.length}\n`;
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cache-export.csv"');
    
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error('Cache export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}