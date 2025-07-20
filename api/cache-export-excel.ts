import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import * as XLSX from 'xlsx';

interface PriceData {
  ticker: string;
  date: string;
  price: number;
  adjusted_close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface YearlyData {
  [ticker: string]: {
    price?: number;
    marketCap?: number;
    sharesOutstanding?: number;
  };
}

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

    // Get all market cap keys
    const marketCapKeys = await redis.keys('market-cap:*');
    console.log(`Found ${marketCapKeys.length} market-cap entries`);

    // Organize data by year
    const dataByYear: { [year: string]: YearlyData } = {};
    const allTickers = new Set<string>();

    // Fetch and organize data
    for (const key of marketCapKeys) {
      try {
        const value = await redis.get(key) as any;
        if (value) {
          // Parse key to extract ticker and date
          const parts = key.split(':');
          if (parts.length >= 3) {
            const ticker = parts[1];
            const date = parts[2];
            const year = date.substring(0, 4);
            
            allTickers.add(ticker);
            
            if (!dataByYear[year]) {
              dataByYear[year] = {};
            }
            
            if (!dataByYear[year][ticker]) {
              dataByYear[year][ticker] = {};
            }
            
            // Store the data
            dataByYear[year][ticker].price = value.adjusted_close || value.price || 0;
            
            // Calculate market cap if we have volume as a proxy
            // Note: Real market cap calculation would need shares outstanding
            // For now, we'll use a simplified approach
            const estimatedShares = value.volume ? value.volume * 100 : 1000000000;
            dataByYear[year][ticker].marketCap = dataByYear[year][ticker].price * estimatedShares;
            dataByYear[year][ticker].sharesOutstanding = estimatedShares;
          }
        }
      } catch (err) {
        console.error(`Error fetching ${key}:`, err);
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Sort tickers for consistent ordering
    const sortedTickers = Array.from(allTickers).sort();
    const years = Object.keys(dataByYear).sort();

    // Create Price tab
    const priceData = [['Ticker', ...years]];
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      years.forEach(year => {
        const value = dataByYear[year]?.[ticker]?.price || '';
        row.push(value);
      });
      priceData.push(row);
    });
    const priceSheet = XLSX.utils.aoa_to_sheet(priceData);
    XLSX.utils.book_append_sheet(wb, priceSheet, 'Prices');

    // Create Market Cap tab
    const marketCapData = [['Ticker', ...years]];
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      years.forEach(year => {
        const value = dataByYear[year]?.[ticker]?.marketCap || '';
        row.push(value);
      });
      marketCapData.push(row);
    });
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');

    // Create Shares Outstanding tab
    const sharesData = [['Ticker', ...years]];
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      years.forEach(year => {
        const value = dataByYear[year]?.[ticker]?.sharesOutstanding || '';
        row.push(value);
      });
      sharesData.push(row);
    });
    const sharesSheet = XLSX.utils.aoa_to_sheet(sharesData);
    XLSX.utils.book_append_sheet(wb, sharesSheet, 'Shares Outstanding');

    // Add summary sheet
    const summaryData = [
      ['Cache Export Summary'],
      ['Export Date', new Date().toISOString()],
      ['Total Tickers', sortedTickers.length],
      ['Years Covered', years.join(', ')],
      ['Total Data Points', marketCapKeys.length],
      [''],
      ['Note: Market cap and shares outstanding are estimated from volume data.'],
      ['For accurate data, real shares outstanding information would be needed.']
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cache-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Cache export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}