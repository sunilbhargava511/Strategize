// api/health.js
const cache = require('../cache/upstashCache');

module.exports = async (req, res) => {
  const stats = cache.getStats();
  
  res.json({ 
    status: 'ok',
    cache: stats,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    endpoints: [
      '/api/health',
      '/api/backtest',
      '/api/market-cap',
      '/api/cache/stats'
    ]
  });
};
