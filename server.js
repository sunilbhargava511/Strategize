// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const csv = require('csv-parser');
const { createReadStream } = require('fs');

// Import cache
const cache = require('./cache/upstashCache');

// Import your strategy implementations
const { runEqualWeightBuyHold } = require('./src/lib/strategies/equalWeightBuyHold');
const { runMarketCapBuyHold } = require('./src/lib/strategies/marketCapBuyHold');
const { runEqualWeightRebalanced } = require('./src/lib/strategies/equalWeightRebalanced');
const { runMarketCapRebalanced } = require('./src/lib/strategies/marketCapRebalanced');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Helper function to read CSV
async function readCSV(filename) {
  const results = [];
  return new Promise((resolve, reject) => {
    createReadStream(filename)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  const stats = cache.getStats();
  res.json({ 
    status: 'ok',
    cache: stats,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
});

// Market cap endpoint
app.get('/api/market-cap', async (req, res) => {
  const { ticker, date } = req.query;
  
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker parameter is required' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    // Check cache first
    const cached = await cache.get(ticker, targetDate);
    if (cached) {
      return res.json({
        ticker,
        date: targetDate,
        price: cached.price,
        shares_outstanding: cached.sharesOutstanding,
        market_cap: cached.marketCap,
        market_cap_billions: (cached.marketCap / 1_000_000_000).toFixed(2),
        formatted_market_cap: `$${cached.marketCap.toLocaleString()}`,
        source: 'cache'
      });
    }

    // Fetch from EOD API
    console.log(`Fetching fresh data for ${ticker} on ${targetDate}`);
    const axios = require('axios');
    const apiKey = process.env.EOD_API_KEY;
    
    const url = `https://eodhistoricaldata.com/api/eod/${ticker}.US`;
    const response = await axios.get(url, {
      params: {
        api_token: apiKey,
        from: targetDate,
        to: targetDate,
        fmt: 'json'
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ 
        error: `No price data found for ${ticker} on ${targetDate}` 
      });
    }

    const priceData = response.data[0];
    const adjustedPrice = priceData.adjusted_close || priceData.close;

    // Get fundamentals
    const fundamentalsUrl = `https://eodhistoricaldata.com/api/fundamentals/${ticker}.US`;
    const fundResponse = await axios.get(fundamentalsUrl, {
      params: { api_token: apiKey }
    });

    const sharesOutstanding = fundResponse.data?.SharesStats?.SharesOutstanding || 0;
    const marketCap = Math.round(adjustedPrice * sharesOutstanding);

    // Cache the result
    await cache.set(ticker, targetDate, {
      price: adjustedPrice,
      marketCap,
      sharesOutstanding
    });

    return res.json({
      ticker,
      date: targetDate,
      price: adjustedPrice,
      shares_outstanding: sharesOutstanding,
      market_cap: marketCap,
      market_cap_billions: (marketCap / 1_000_000_000).toFixed(2),
      formatted_market_cap: `$${marketCap.toLocaleString()}`,
      source: 'api'
    });

  } catch (error) {
    console.error('Market cap error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch market cap data',
      details: error.message 
    });
  }
});

// Backtesting endpoint
app.post('/api/backtest', async (req, res) => {
  try {
    const config = req.body;
    console.log('🚀 Starting backtest with Upstash cache...');
    
    // Load S&P 500 data if not provided
    if (!config.stocks || config.stocks.length === 0) {
      config.stocks = await readCSV('./sp500_ticker_start_end.csv');
    }
    
    // Preload cache for better performance
    const tickers = config.stocks.map(s => s.ticker);
    await cache.preloadBacktestData(tickers, config.startYear, config.endYear);
    
    const stats = cache.getStats();
    console.log(`📊 Cache stats: ${stats.entriesInMemory} entries in memory`);
    
    // Create cached price fetcher
    const cachedPriceDataFetcher = async (ticker, date) => {
      // Try memory first
      let data = cache.getFromMemory(ticker, date);
      
      // If not in memory, try Redis
      if (!data) {
        data = await cache.get(ticker, date);
      }
      
      // If still no data, fetch from API
      if (!data) {
        console.log(`Cache miss: ${ticker} on ${date}, fetching...`);
        
        try {
          const axios = require('axios');
          const apiKey = process.env.EOD_API_KEY;
          
          const response = await axios.get(
            `https://eodhistoricaldata.com/api/eod/${ticker}.US`,
            {
              params: {
                api_token: apiKey,
                from: date,
                to: date,
                fmt: 'json'
              }
            }
          );
          
          if (response.data && response.data.length > 0) {
            const priceData = response.data[0];
            const price = priceData.adjusted_close || priceData.close;
            
            // Simple cache entry
            const cacheEntry = {
              price,
              marketCap: 0,
              sharesOutstanding: 0
            };
            
            // Cache for next time
            await cache.set(ticker, date, cacheEntry);
            
            data = cacheEntry;
          }
        } catch (error) {
          console.error(`Failed to fetch ${ticker} on ${date}:`, error.message);
          return null;
        }
      }
      
      return data ? {
        ticker,
        date,
        adjustedPrice: data.price,
        marketCap: data.marketCap,
        sharesOutstanding: data.sharesOutstanding
      } : null;
    };
    
    // Run strategies
    const results = {
      strategies: [],
      summary: {},
      config: {
        startYear: config.startYear,
        endYear: config.endYear,
        initialInvestment: config.initialInvestment
      }
    };
    
    // Run each selected strategy
    if (config.strategies.includes('equalWeightBuyHold')) {
      const result = await runEqualWeightBuyHold(
        config.stocks,
        config.startYear,
        config.endYear,
        config.initialInvestment,
        cachedPriceDataFetcher
      );
      results.strategies.push(result);
    }
    
    // Add other strategies as needed...
    
    // Clear memory cache
    cache.clearMemory();
    
    return res.json({
      success: true,
      results,
      cacheStats: {
        ...stats,
        message: 'Used Upstash Redis with batch operations'
      }
    });
    
  } catch (error) {
    console.error('Backtest error:', error);
    return res.status(500).json({ 
      error: 'Backtest failed',
      message: error.message 
    });
  }
});

// SPY data endpoint
app.get('/api/spy-data', async (req, res) => {
  try {
    const { startYear, endYear } = req.query;
    
    // For now, return mock data - implement your SPY logic here
    res.json({
      ticker: 'SPY',
      startYear,
      endYear,
      data: [],
      message: 'SPY data endpoint - implement your logic here'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache stats endpoint
app.get('/api/cache/stats', async (req, res) => {
  const stats = cache.getStats();
  res.json(stats);
});

// Clear cache endpoint (use with caution!)
app.post('/api/cache/clear', async (req, res) => {
  const { type } = req.body;
  
  if (type === 'memory') {
    cache.clearMemory();
    res.json({ message: 'Memory cache cleared' });
  } else if (type === 'redis') {
    const count = await cache.clearRedis();
    res.json({ message: `Cleared ${count} entries from Redis` });
  } else {
    res.status(400).json({ error: 'Specify type: memory or redis' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send(`
    <h1>Stock Backtesting API</h1>
    <p>Cache: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis' : 'In-memory'}</p>
    <p>Environment: ${process.env.VERCEL ? 'Vercel' : 'Local'}</p>
    <h2>Endpoints:</h2>
    <ul>
      <li>GET /api/health - Health check</li>
      <li>GET /api/market-cap?ticker=AAPL&date=2024-01-15 - Get market cap data</li>
      <li>POST /api/backtest - Run backtest</li>
      <li>GET /api/cache/stats - Cache statistics</li>
    </ul>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// IMPORTANT: Export for Vercel
if (process.env.VERCEL) {
  // Running on Vercel - export the Express app
  module.exports = app;
} else {
  // Local development - start the server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📦 Cache: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis' : 'In-memory'}`);
  });
}