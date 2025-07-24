// api/fill-cache.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  TickerYearData,
  TickerCacheData,
  getTickerFromCache,
  fillCache,
  validateCacheCoverage
} from './_cacheUtils';
import { fillCacheWithProgress } from './data/dataProcessing';
import { createBatchJob, getBatchProgress } from './_batchProcessing';

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
    const { tickers, action, useBatch = false } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid tickers array',
        message: 'Please provide an array of ticker symbols'
      });
    }

    // Check if EODHD API token is available for fill operations
    if (action === 'fill' && !process.env.EODHD_API_TOKEN) {
      return res.status(500).json({
        error: 'EODHD API token not configured',
        message: 'EODHD_API_TOKEN environment variable is required for fill operations'
      });
    }

    if (action === 'validate') {
      // Check which tickers are already cached using the shared function
      console.log(`🔍 VALIDATE CACHE: Checking ${tickers.length} tickers`);
      
      const { missing, eliminated } = await validateCacheCoverage(tickers);
      const eliminatedTickers = eliminated.map(e => e.ticker);
      const cached = tickers.filter((ticker: string) => 
        !missing.includes(ticker) && !eliminatedTickers.includes(ticker)
      );
      
      console.log(`✅ VALIDATE COMPLETE: ${cached.length} cached, ${missing.length} missing, ${eliminated.length} eliminated`);
      
      return res.status(200).json({
        success: true,
        cached,
        missing,
        eliminated,
        summary: {
          total: tickers.length,
          cached: cached.length,
          missing: missing.length,
          eliminated: eliminated.length
        },
        message: missing.length > 0 ? 
          `${missing.length} tickers need to be cached` : 
          'All tickers are already cached'
      });
    }

    if (action === 'fill') {
      console.log(`🔄 FILL CACHE: Starting to fill cache for ${tickers.length} tickers`);
      
      // Check if we should use batch processing for large ticker lists
      const shouldUseBatch = useBatch || tickers.length > 50;
      
      if (shouldUseBatch) {
        console.log(`📦 Using batch processing for ${tickers.length} tickers`);
        
        try {
          // Create batch job
          const batchJob = await createBatchJob(tickers);
          const progress = await getBatchProgress(batchJob.jobId);
          
          return res.status(202).json({
            success: true,
            batchMode: true,
            jobId: batchJob.jobId,
            message: `Batch job created for ${tickers.length} tickers`,
            batchInfo: {
              totalTickers: batchJob.totalTickers,
              totalBatches: batchJob.totalBatches,
              batchSize: batchJob.batchSize,
              tickersToProcess: batchJob.tickersToProcess.length,
              alreadyCached: batchJob.totalTickers - batchJob.tickersToProcess.length
            },
            progress,
            nextSteps: {
              checkStatus: `/api/fill-cache-batch-status?jobId=${batchJob.jobId}`,
              startProcessing: `/api/fill-cache-batch-continue`,
              autoStart: 'Job will start automatically in a few seconds'
            }
          });
        } catch (error: any) {
          console.error('Batch job creation failed:', error);
          return res.status(500).json({
            success: false,
            error: 'Batch job creation failed',
            message: error.message,
            fallback: 'Will attempt regular processing instead'
          });
        }
      }
      
      // Regular processing for smaller ticker lists
      try {
        const results = await fillCacheWithProgress(tickers, (progress) => {
          // For now, just log progress - we'll implement streaming later
          console.log(`📊 PROGRESS: ${progress.processed}/${progress.total} tickers (${progress.percentage.toFixed(1)}%)`);
        });
        
        console.log(`✅ FILL CACHE COMPLETE: ${results.success.length} success, ${results.errors.length} errors, ${results.warnings.length} warnings`);
        
        const statusCode = results.errors.length > 0 ? 
          (results.success.length > 0 ? 207 : 400) : // 207 Multi-Status for partial success, 400 for complete failure
          200; // 200 for complete success
        
        return res.status(statusCode).json({
          success: results.errors.length === 0,
          batchMode: false,
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
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Fill cache operation failed',
      message: error.message || 'Unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}