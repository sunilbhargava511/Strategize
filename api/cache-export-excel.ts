import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { logger } from './_logger';
import { getCacheStats } from './_cacheStats';
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
    logger.info('Starting Excel cache export using stats tracking...');
    
    // Get cache stats instead of using KEYS
    const stats = await getCacheStats();
    const tickerDataKeys = Array.from(stats.tickers).map(ticker => `ticker-data:${ticker}`);
    
    logger.info(`Found ${tickerDataKeys.length} ticker entries from stats`);

    // Organize data by year and ticker
    const dataByYear: { [year: string]: YearlyData } = {};
    const tickerInfo: { [ticker: string]: { startYear: number; endYear: number } } = {};
    const allTickers = new Set<string>();

    // Fetch and organize data from new ticker-based structure
    for (const key of tickerDataKeys) {
      try {
        const tickerData = await cache.get(key);
        if (tickerData && typeof tickerData === 'object') {
          // Extract ticker from key
          const ticker = key.replace('ticker-data:', '');
          allTickers.add(ticker);
          
          // Process each year of data for this ticker
          for (const [yearStr, yearData] of Object.entries(tickerData as Record<string, any>)) {
            const year = parseInt(yearStr);
            
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
            
            // Store the data from new ticker-based structure
            dataByYear[year][ticker].price = yearData.price || 0;
            dataByYear[year][ticker].marketCap = yearData.market_cap || 0;
            dataByYear[year][ticker].sharesOutstanding = yearData.shares_outstanding || 0;
          }
        }
      } catch (err) {
        logger.error(`Error fetching ${key}:`, err);
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