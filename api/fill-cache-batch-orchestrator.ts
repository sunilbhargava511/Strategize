// api/fill-cache-batch-orchestrator.ts
// Reliable batch orchestrator that processes all batches in a single function execution

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getBatchJob, 
  updateBatchProgress, 
  getCurrentBatchTickers,
  markJobFailed,
  BATCH_CONSTANTS 
} from './_batchProcessing';
import { fillCacheWithProgress } from './data/dataProcessing';
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
    const { jobId, maxBatches = 10 } = req.body; // Process up to 10 batches per invocation

    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId',
        message: 'jobId is required to orchestrate batch processing'
      });
    }

    logger.info(`🎯 ORCHESTRATOR START: Processing up to ${maxBatches} batches for job ${jobId}`);

    // Get the batch job
    let job = await getBatchJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Batch job not found',
        message: `No batch job found with ID: ${jobId}`
      });
    }

    // Check if job is already completed
    if (job.status === 'completed') {
      logger.info(`✅ Job ${jobId} already completed`);
      return res.status(200).json({
        success: true,
        completed: true,
        message: 'Batch job already completed',
        jobId,
        summary: {
          totalTickers: job.totalTickers,
          successful: job.successful,
          failed: job.failed,
          processed: job.processed
        }
      });
    }

    // Check if job failed
    if (job.status === 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Batch job failed',
        message: 'Cannot continue a failed batch job',
        jobId
      });
    }

    let batchesProcessed = 0;
    const maxExecutionTime = 240000; // 4 minutes max (leaving 1 minute buffer for 5 min timeout)
    const orchStartTime = Date.now();

    // Process multiple batches in a loop
    while (
      batchesProcessed < maxBatches && 
      job.currentBatch < job.totalBatches &&
      (Date.now() - orchStartTime) < maxExecutionTime
    ) {
      
      // Get current batch tickers
      const batchTickers = getCurrentBatchTickers(job);
      if (batchTickers.length === 0) {
        logger.warn(`⚠️ No tickers in current batch ${job.currentBatch} for job ${jobId}`);
        break;
      }

      const batchStartTime = Date.now();
      logger.info(`🚀 BATCH ${job.currentBatch + 1}/${job.totalBatches}: Processing [${batchTickers.join(', ')}]`);

      // Update job status
      job.status = 'running';
      job.currentTickerBeingProcessed = batchTickers[0];
      await getBatchJob(jobId); // This will update the job

      try {
        // Process the current batch
        const results = await fillCacheWithProgress(batchTickers, (progress) => {
          logger.info(`📊 Progress: ${progress.processed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
        });

        const batchDuration = Date.now() - batchStartTime;
        logger.info(`✅ BATCH ${job.currentBatch + 1} COMPLETE: ${results.success.length} successful, ${results.errors.length} failed in ${(batchDuration/1000).toFixed(1)}s`);

        // Update batch progress
        const updatedJob = await updateBatchProgress(jobId, {
          successful: results.success,
          failed: results.errors.map(e => ({ ticker: e.ticker, error: e.error }))
        });

        if (!updatedJob) {
          throw new Error('Failed to update batch progress');
        }

        job = updatedJob;
        batchesProcessed++;

        // Log overall progress
        const overallProgress = (job.processed / job.totalTickers * 100).toFixed(1);
        logger.info(`📊 OVERALL: ${job.processed}/${job.totalTickers} tickers (${overallProgress}%) - ${job.successful} successful, ${job.failed} failed`);

        // Small delay between batches
        if (job.currentBatch < job.totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (batchError: any) {
        logger.error(`❌ Error processing batch ${job.currentBatch + 1}:`, batchError);
        await markJobFailed(jobId, batchError.message);
        
        return res.status(500).json({
          success: false,
          error: 'Batch processing failed',
          message: batchError.message,
          jobId,
          batchesProcessed
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const isComplete = job.status === 'completed' || job.currentBatch >= job.totalBatches;

    // If not complete and still have time, schedule next orchestration
    let nextOrchestration = null;
    if (!isComplete && (Date.now() - orchStartTime) < maxExecutionTime) {
      nextOrchestration = {
        scheduledFor: new Date(Date.now() + 5000).toISOString(), // 5 seconds from now
        message: 'Next orchestration will automatically start'
      };

      // Schedule next orchestration
      setTimeout(async () => {
        try {
          const continueUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/fill-cache-batch-orchestrator`;
          logger.info(`🔄 ORCHESTRATOR CONTINUE: Scheduling next orchestration for job ${jobId}`);
          
          const response = await fetch(continueUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, maxBatches })
          });
          
          if (!response.ok) {
            logger.error(`❌ ORCHESTRATOR FAILED: Job ${jobId} - HTTP ${response.status}`);
          } else {
            logger.success(`✅ ORCHESTRATOR SCHEDULED: Job ${jobId}`);
          }
        } catch (error: any) {
          logger.error(`💥 ORCHESTRATOR ERROR: Job ${jobId} - ${error.message}`);
        }
      }, 5000);
    }

    return res.status(200).json({
      success: true,
      completed: isComplete,
      jobId,
      batchesProcessed,
      totalBatches: job.totalBatches,
      currentBatch: job.currentBatch,
      progress: {
        processed: job.processed,
        total: job.totalTickers,
        percentage: (job.processed / job.totalTickers) * 100,
        successful: job.successful,
        failed: job.failed
      },
      duration: totalDuration,
      message: isComplete ? 
        `Job completed! Processed all ${job.totalTickers} tickers` : 
        `Processed ${batchesProcessed} batches. ${job.totalBatches - job.currentBatch} batches remaining.`,
      nextOrchestration
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Orchestrator error (${duration}ms):`, error);
    
    return res.status(500).json({
      success: false,
      error: 'Orchestration failed',
      message: error.message || 'Unknown error occurred',
      duration
    });
  }
}