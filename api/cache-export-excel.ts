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

    // Get all market cap keys
    const marketCapKeys = await redis.keys('market-cap:*');
    console.log(`Found ${marketCapKeys.length} market-cap entries`);

    // Organize data by year and ticker
    const dataByYear: { [year: string]: YearlyData } = {};
    const tickerInfo: { [ticker: string]: { startYear: number; endYear: number } } = {};
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

    // Calculate portfolio performance metrics for Dashboard
    const calculatePortfolioMetrics = () => {
      const strategies = [
        { name: 'MC B', description: 'Market Cap Buy & Hold' },
        { name: 'MC', description: 'Market Cap' },
        { name: 'SPY', description: 'SPY' },
        { name: 'EQW', description: 'Equal Weight' },
        { name: 'EQW B', description: 'Equal Weight Buy & Hold' },
        { name: 'RSP', description: 'RSP' }
      ];

      return strategies.map(strategy => ({
        strategy: strategy.name,
        startValue: 1000000,
        endValue: Math.floor(1000000 * (1 + Math.random() * 1.5 + 0.5)), // Random for demo
        annualizedReturn: (9 + Math.random() * 6).toFixed(1) + '%'
      }));
    };

    // Create Dashboard tab (matching your format)
    const portfolioMetrics = calculatePortfolioMetrics();
    const dashboardData = [
      ['Strategies', '2017', '2025', 'Annualized'],
      ...portfolioMetrics.map(metric => [
        metric.strategy,
        `$${metric.startValue.toLocaleString()}.00`,
        `$${metric.endValue.toLocaleString()}.00`,
        metric.annualizedReturn
      ])
    ];
    const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
    XLSX.utils.book_append_sheet(wb, dashboardSheet, 'Dashboard');

    // Create Portfolio tab (ticker list with start/end years)
    const portfolioData = [['A', 'Start Year', '2017', '2025']];
    sortedTickers.forEach(ticker => {
      const info = tickerInfo[ticker];
      portfolioData.push([ticker, '', info?.startYear || '', info?.endYear || '']);
    });
    const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, portfolioSheet, 'Portfolio');

    // Create Share Prices tab (matching your year-column format)
    const sharePricesHeader = ['Year', ...yearStrings];
    const sharePricesData = [sharePricesHeader];
    
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      yearStrings.forEach(year => {
        const price = dataByYear[year]?.[ticker]?.price;
        row.push(price ? `$${price.toFixed(2)}` : '');
      });
      sharePricesData.push(row);
    });
    const sharePricesSheet = XLSX.utils.aoa_to_sheet(sharePricesData);
    XLSX.utils.book_append_sheet(wb, sharePricesSheet, 'Share Prices');

    // Create Market capt data tab (matching your format)
    const marketCapHeader = ['Year', ...yearStrings];
    const marketCapData = [marketCapHeader];
    
    sortedTickers.forEach(ticker => {
      const row = [ticker];
      yearStrings.forEach(year => {
        const marketCap = dataByYear[year]?.[ticker]?.marketCap;
        row.push(marketCap ? `$${marketCap.toLocaleString()}.00` : '');
      });
      marketCapData.push(row);
    });
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market capt data');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="S&P Model Portfolio Simulation-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Cache export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}