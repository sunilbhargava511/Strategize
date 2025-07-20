// api/health.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { cache } from './_upstashCache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const stats = await cache.getStats();
    
    res.status(200).json({ 
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
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}