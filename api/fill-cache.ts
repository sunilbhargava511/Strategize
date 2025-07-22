// api/fill-cache.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  TickerYearData,
  TickerCacheData,
  getTickerFromCache,
  fillCache,
  validateCacheCoverage
} from './_cacheUtils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tickers, action } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid tickers array',
        message: 'Please provide an array of ticker symbols'
      });
    }

    if (action === 'validate') {
      // Check which tickers are already cached using the shared function
      console.log(`🔍 VALIDATE CACHE: Checking ${tickers.length} tickers`);
      
      const missing = await validateCacheCoverage(tickers);
      const cached = tickers.filter((ticker: string) => !missing.includes(ticker));
      
      console.log(`✅ VALIDATE COMPLETE: ${cached.length} cached, ${missing.length} missing`);
      
      return res.status(200).json({
        success: true,
        cached,
        missing,
        summary: {
          total: tickers.length,
          cached: cached.length,
          missing: missing.length
        },
        message: missing.length > 0 ? 
          `${missing.length} tickers need to be cached` : 
          'All tickers are already cached'
      });
    }

    if (action === 'fill') {
      console.log(`🔄 FILL CACHE: Starting to fill cache for ${tickers.length} tickers`);
      
      try {
        const results = await fillCache(tickers);
        
        console.log(`✅ FILL CACHE COMPLETE: ${results.success.length} success, ${results.errors.length} errors, ${results.warnings.length} warnings`);
        
        const statusCode = results.errors.length > 0 ? 
          (results.success.length > 0 ? 207 : 400) : // 207 Multi-Status for partial success, 400 for complete failure
          200; // 200 for complete success
        
        return res.status(statusCode).json({
          success: results.errors.length === 0,
          results: {
            successful: results.success,
            errors: results.errors,
            warnings: results.warnings
          },
          summary: {
            total: tickers.length,
            successful: results.success.length,
            failed: results.errors.length,
            warnings: results.warnings.length
          },
          message: results.errors.length === 0 
            ? `Successfully cached ${results.success.length} tickers`
            : `Cached ${results.success.length}/${tickers.length} tickers. ${results.errors.length} failed.`
        });
      } catch (error: any) {
        console.error('Fill cache operation failed:', error);
        return res.status(500).json({
          success: false,
          error: 'Fill cache operation failed',
          message: error.message,
          tickers: tickers.length
        });
      }
    }

    return res.status(400).json({
      error: 'Invalid action',
      message: 'Supported actions: validate, fill'
    });

  } catch (error: any) {
    console.error('Fill cache error:', error);
    return res.status(500).json({
      error: 'Fill cache operation failed',
      message: error.message
    });
  }
}