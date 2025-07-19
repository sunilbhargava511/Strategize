// api/health.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const cache = require('./_upstashCache');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const stats = cache.getStats();
  
  res.json({ 
    status: 'ok',
    cache: stats,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    endpoints: [
      '/api/health',
      '/api/backtest',
      '/api/market-cap'
    ]
  });
}
