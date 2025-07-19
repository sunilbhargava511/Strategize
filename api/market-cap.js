// api/market-cap.js
const axios = require('axios');
const cache = require('../cache/upstashCache');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    const sharesOutstanding = fundResponse.data?.SharesStats?.SharesOutstanding || 
                            fundResponse.data?.outstandingShares?.raw || 
                            0;
    
    const marketCap = adjustedPrice * sharesOutstanding;

    // Cache the result
    await cache.set(ticker, targetDate, {
      price: adjustedPrice,
      sharesOutstanding,
      marketCap
    });

    res.json({
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
    console.error('Error fetching market cap:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch market cap data',
      message: error.message 
    });
  }
};
