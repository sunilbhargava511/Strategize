// src/scripts/warmCache.ts

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { getHistoricalDataCache } from '../lib/cache/historicalDataCache';
import { Stock, PriceData } from '../types/backtesting';
import { getYearsInRange } from '../lib/utils/dateUtils';

/**
 * Script to pre-populate the cache with all historical S&P 500 data
 * Run with: npm run warm-cache
 */

async function loadSP500Stocks(): Promise<Stock[]> {
  const csvPath = path.join(process.cwd(), 'data', 'sp500-tickers.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error('S&P 500 ticker file not found at ' + csvPath);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  return parsed.data.map((row: any) => ({
    ticker: row.ticker,
    startDate: row.start_date,
    endDate: row.end_date || null
  }));
}

async function fetchPriceData(ticker: string, date: string): Promise<PriceData | null> {
  const apiToken = process.env.EODHD_API_TOKEN;
  if (!apiToken) {
    throw new Error('EODHD_API_TOKEN not set in environment');
  }

  const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
  const apiUrl = `https://eodhd.com/api/eod/${formattedTicker}?api_token=${apiToken}&fmt=json&from=${date}&to=${date}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch ${ticker} on ${date}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return null;
    }

    const priceData = Array.isArray(data) ? data[0] : data;
    
    // Get default shares outstanding
    const sharesOutstanding = getDefaultSharesOutstanding(formattedTicker);
    const adjustedPrice = parseFloat(priceData.adjusted_close || priceData.close);
    
    return {
      ticker: formattedTicker,
      date: priceData.date || date,
      price: parseFloat(priceData.close),
      adjustedPrice: adjustedPrice,
      sharesOutstanding: sharesOutstanding,
      marketCap: adjustedPrice * sharesOutstanding
    };
  } catch (error) {
    console.error(`Error fetching ${ticker} on ${date}:`, error);
    return null;
  }
}

function getDefaultSharesOutstanding(ticker: string): number {
  // This should match the defaults in your market-cap route
  const defaults: { [key: string]: number } = {
    'AAPL.US': 15441000000,
    'MSFT.US': 7430000000,
    'GOOGL.US': 12700000000,
    'AMZN.US': 10700000000,
    'TSLA.US': 3160000000,
    // Add more as needed
  };
  
  return defaults[ticker] || 1000000000; // 1B shares as fallback
}

async function main() {
  console.log('🚀 Starting cache warming process...');
  
  // Load environment variables
  const dotenv = await import('dotenv');
  dotenv.config();

  try {
    // Load S&P 500 stocks
    const stocks = await loadSP500Stocks();
    console.log(`📊 Loaded ${stocks.length} S&P 500 stocks`);

    // Define years to cache (1996-2025)
    const years = getYearsInRange(1996, 2025);
    console.log(`📅 Caching data for years: ${years[0]} - ${years[years.length - 1]}`);

    // Get cache instance
    const cache = getHistoricalDataCache();

    // Show initial stats
    const initialStats = cache.getStats();
    console.log('📈 Initial cache stats:', initialStats);

    // Progress tracking
    let lastProgress = 0;
    const progressCallback = (current: number, total: number) => {
      const progress = Math.floor((current / total) * 100);
      if (progress > lastProgress && progress % 10 === 0) {
        console.log(`⏳ Progress: ${progress}% (${current}/${total})`);
        lastProgress = progress;
      }
    };

    // Warm the cache
    await cache.prewarmCache(stocks, years, fetchPriceData, progressCallback);

    // Show final stats
    const finalStats = cache.getStats();
    console.log('\n📊 Final cache stats:', finalStats);
    console.log('✅ Cache warming complete!');

  } catch (error) {
    console.error('❌ Error warming cache:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}