// api/health.js
const cache = require('./_upstashCache');

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
      '/api/_stats'
    ]
  });
};
