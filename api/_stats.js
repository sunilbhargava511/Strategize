// api/cache/stats.js
const cache = require('./upstashCache');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const stats = cache.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
};
