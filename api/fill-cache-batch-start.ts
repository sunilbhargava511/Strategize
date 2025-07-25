// api/fill-cache-batch-start.ts
// Initiates batch processing for large fill-cache operations

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  createBatchJob, 
  getBatchProgress,
  BATCH_CONSTANTS 
} from './_batchProcessing';
import { getValidUSTickers } from './external/eodhApi';
import { logger } from './_logger';

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

  const startTime = Date.now();

  try {
    const { 
      tickers, 
      batchSize = BATCH_CONSTANTS.MICRO_BATCH_SIZE,
      startImmediately = true,
      tickerSource = 'custom'
    } = req.body;

    // Validate EODHD API token
    if (!process.env.EODHD_API_TOKEN) {
      return res.status(500).json({
        error: 'EODHD API token not configured',
        message: 'EODHD_API_TOKEN environment variable is required for batch operations'
      });
    }

    let tickersToProcess: string[] = [];

    // Handle different ticker sources
    if (tickerSource === 'sp500') {
      logger.info('🔍 Fetching all S&P 500 tickers for batch processing...');
      try {
        const validTickers = await getValidUSTickers();
        if (!validTickers || !Array.isArray(validTickers)) {
          throw new Error('No valid tickers returned from data source');
        }
        tickersToProcess = validTickers.slice(0, 500); // First 500 should cover most S&P 500
        logger.success(`📊 Retrieved ${tickersToProcess.length} S&P 500 tickers`);
      } catch (error) {
        logger.error('Failed to fetch S&P 500 tickers:', error);
        return res.status(500).json({
          error: 'Failed to fetch S&P 500 tickers',
          message: 'Could not retrieve ticker list from data source'
        });
      }
    } else if (tickerSource === 'all') {
      logger.info('🔍 Fetching all valid US tickers for batch processing...');
      try {
        const validTickers = await getValidUSTickers();
        if (!validTickers || !Array.isArray(validTickers)) {
          throw new Error('No valid tickers returned from data source');
        }
        tickersToProcess = validTickers;
        logger.success(`📊 Retrieved ${tickersToProcess.length} valid US tickers`);
      } catch (error) {
        logger.error('Failed to fetch all US tickers:', error);
        return res.status(500).json({
          error: 'Failed to fetch US tickers',
          message: 'Could not retrieve ticker list from data source'
        });
      }
    } else if (tickerSource === 'custom') {
      // Custom ticker list provided
      if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ 
          error: 'Missing or invalid tickers array',
          message: 'Please provide an array of ticker symbols for custom processing'
        });
      }
      tickersToProcess = tickers;
    } else {
      return res.status(400).json({
        error: 'Invalid ticker source',
        message: 'tickerSource must be one of: custom, sp500, all'
      });
    }

    // Validate batch size
    if (batchSize < 1 || batchSize > 50) {
      return res.status(400).json({
        error: 'Invalid batch size',
        message: 'Batch size must be between 1 and 50'
      });
    }

    // Validate total ticker count
    if (tickersToProcess.length > 10000) {
      return res.status(400).json({
        error: 'Too many tickers',
        message: `Maximum 10,000 tickers allowed. You provided ${tickersToProcess.length}`
      });
    }

    logger.info(`🚀 BATCH JOB INIT: Starting batch job for ${tickersToProcess.length} tickers (batch size: ${batchSize})`);
    logger.info(`📊 BATCH JOB CONFIG: Source=${tickerSource}, Total=${tickersToProcess.length}, BatchSize=${batchSize}`);

    // Create the batch job
    const batchJob = await createBatchJob(tickersToProcess, batchSize);
    
    // Get initial progress
    const progress = await getBatchProgress(batchJob.jobId);
    
    const duration = Date.now() - startTime;
    logger.success(`✅ BATCH JOB CREATED: Job ${batchJob.jobId} initialized in ${duration}ms`);
    logger.info(`📈 BATCH JOB STATS: ${batchJob.totalBatches} batches, ${batchJob.tickersToProcess.length} to process, ${batchJob.totalTickers - batchJob.tickersToProcess.length} already cached`);

    // Prepare response
    const response = {
      success: true,
      jobId: batchJob.jobId,
      message: batchJob.totalBatches === 0 ? 
        'All tickers already cached - no processing needed' :
        `Batch job created with ${batchJob.totalBatches} batches`,
      batchInfo: {
        totalTickers: batchJob.totalTickers,
        tickersToProcess: batchJob.tickersToProcess.length,
        totalBatches: batchJob.totalBatches,
        batchSize: batchJob.batchSize,
        estimatedTimeMinutes: Math.ceil((batchJob.totalBatches * 2.5) / 60) // 2.5 minutes average per batch
      },
      progress,
      status: batchJob.status,
      tickerSource,
      creationTime: duration,
      nextSteps: batchJob.totalBatches === 0 ? 
        'Job complete - all tickers already cached' :
        startImmediately ? 
          'First batch will start automatically' : 
          'Call /api/fill-cache-batch-continue to start processing'
    };

    // Auto-start first batch if requested and there are batches to process
    if (startImmediately && batchJob.totalBatches > 0) {
      logger.info(`🔄 AUTO-START: Scheduling orchestrator for job ${batchJob.jobId} in 1 second...`);
      logger.info(`🎯 AUTO-START TARGET: Will process up to 10 batches at a time from ${batchJob.totalBatches} total batches`);
      
      // Start orchestrator with a small delay
      setTimeout(async () => {
        try {
          const orchestratorUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/fill-cache-batch-orchestrator`;
          logger.info(`🔗 AUTO-START TRIGGER: Calling orchestrator at ${orchestratorUrl} for job ${batchJob.jobId}`);
          
          const orchestratorResponse = await fetch(orchestratorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              jobId: batchJob.jobId, 
              maxBatches: 10 // Process up to 10 batches per orchestration
            })
          });
          
          if (!orchestratorResponse.ok) {
            logger.error(`❌ AUTO-START FAILED: Job ${batchJob.jobId} - HTTP ${orchestratorResponse.status}`);
            logger.error(`🚨 BATCH JOB STALLED: Failed to auto-start orchestrator for job ${batchJob.jobId}`);
          } else {
            logger.success(`✅ AUTO-START SUCCESS: Job ${batchJob.jobId} - Orchestrator triggered successfully`);
            logger.info(`🏃‍♂️ BATCH PROCESSING: Job ${batchJob.jobId} is now running with reliable orchestration`);
          }
        } catch (error: any) {
          logger.error(`💥 AUTO-START ERROR: Job ${batchJob.jobId} - ${error.message || 'Unknown error'}`);
          logger.error(`🚨 BATCH JOB STALLED: Exception in auto-start for job ${batchJob.jobId}`);
        }
      }, 1000); // 1 second delay

      response.message += ' - orchestrator starting automatically';
      logger.info(`📋 AUTO-START QUEUED: Job ${batchJob.jobId} will begin processing with orchestrator`);
    } else if (batchJob.totalBatches === 0) {
      logger.success(`🎉 NO PROCESSING NEEDED: All tickers already cached for job ${batchJob.jobId}`);
    } else {
      logger.info(`⏸️  MANUAL START: Job ${batchJob.jobId} requires manual trigger via /api/fill-cache-batch-continue`);
    }

    return res.status(201).json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Fill cache batch start error (${duration}ms):`, error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to start batch job',
      message: error.message || 'Unknown error occurred',
      duration,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}