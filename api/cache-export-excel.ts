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
    startYear?: number;
    endYear?: number;
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

    // Get all ticker data keys  
    const tickerDataKeys = await redis.keys('ticker-data:*');
    console.log(`Found ${tickerDataKeys.length} ticker-data entries`);

    // Organize data by year and ticker
    const dataByYear: { [year: string]: YearlyData } = {};
    const tickerInfo: { [ticker: string]: { startYear: number; endYear: number } } = {};
    const allTickers = new Set<string>();

    // Fetch and organize data
    for (const key of tickerDataKeys) {
      try {
        const value = await redis.get(key) as any;
        if (value) {
          // Parse key to extract ticker and date
          const parts = key.split(':');
          if (parts.length >= 3) {
            const ticker = parts[1];
            const date = parts[2];
            const year = parseInt(date.substring(0, 4));
            
            allTickers.add(ticker);
            
            // Track year range for each ticker
            if (!tickerInfo[ticker]) {
              tickerInfo[ticker] = { startYear: year, endYear: year };
            } else {
              tickerInfo[ticker].startYear = Math.min(tickerInfo[ticker].startYear, year);
              tickerInfo[ticker].endYear = Math.max(tickerInfo[ticker].endYear, year);
            }
            
            if (!dataByYear[year]) {
              dataByYear[year] = {};
            }
            
            if (!dataByYear[year][ticker]) {
              dataByYear[year][ticker] = {};
            }
            
            // Store the data
            dataByYear[year][ticker].price = value.adjusted_close || value.price || 0;
            
            // Use actual market cap and shares outstanding from the cached data
            if (value.market_cap) {
              dataByYear[year][ticker].marketCap = value.market_cap;
            } else if (value.shares_outstanding && dataByYear[year][ticker].price) {
              // Calculate market cap from shares and price
              dataByYear[year][ticker].marketCap = dataByYear[year][ticker].price * value.shares_outstanding;
            }
            
            if (value.shares_outstanding) {
              dataByYear[year][ticker].sharesOutstanding = value.shares_outstanding;
            } else if (value.market_cap && dataByYear[year][ticker].price) {
              // Calculate shares from market cap and price
              dataByYear[year][ticker].sharesOutstanding = Math.floor(value.market_cap / dataByYear[year][ticker].price);
            }
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
    const years = Object.keys(dataByYear).map(y => parseInt(y)).sort();
    const yearStrings = years.map(y => y.toString());

    // Create Summary tab with metadata about the export
    const summaryData = [
      ['Cache Export Summary'],
      [''],
      ['Export Date:', new Date().toLocaleString()],
      ['Total Tickers:', sortedTickers.length.toString()],
      ['Total Cache Entries:', tickerDataKeys.length.toString()],
      ['Year Range:', years.length > 0 ? `${Math.min(...years)} - ${Math.max(...years)}` : 'N/A'],
      [''],
      ['Note:', 'This export contains only cached market data from EODHD API calls.'],
      ['', 'Empty cells indicate no data was cached for that ticker/year combination.']
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Create Prices tab (split-adjusted prices)
    const pricesHeader = ['Ticker', ...yearStrings];
    const pricesData = [pricesHeader];
    
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      yearStrings.forEach(year => {
        const price = dataByYear[year]?.[ticker]?.price;
        row.push(price ? `$${price.toFixed(2)}` : '');
      });
      pricesData.push(row);
    });
    const pricesSheet = XLSX.utils.aoa_to_sheet(pricesData);
    XLSX.utils.book_append_sheet(wb, pricesSheet, 'Prices');

    // Create Market Cap tab
    const marketCapHeader = ['Ticker', ...yearStrings];
    const marketCapData = [marketCapHeader];
    
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      yearStrings.forEach(year => {
        const marketCap = dataByYear[year]?.[ticker]?.marketCap;
        row.push(marketCap ? `$${Math.round(marketCap).toLocaleString()}` : '');
      });
      marketCapData.push(row);
    });
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');
    
    // Create Shares Outstanding tab
    const sharesHeader = ['Ticker', ...yearStrings];
    const sharesData = [sharesHeader];
    
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      yearStrings.forEach(year => {
        const shares = dataByYear[year]?.[ticker]?.sharesOutstanding;
        row.push(shares ? shares.toLocaleString() : '');
      });
      sharesData.push(row);
    });
    const sharesSheet = XLSX.utils.aoa_to_sheet(sharesData);
    XLSX.utils.book_append_sheet(wb, sharesSheet, 'Shares Outstanding');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Cache-Export-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Cache export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}