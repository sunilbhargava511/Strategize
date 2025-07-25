// api/fill-cache-batch-orchestrator.ts
// Reliable batch orchestrator that processes all batches in a single function execution

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getBatchJob, 
  updateBatchProgress, 
  getCurrentBatchTickers,
  markJobFailed,
  updateBatchJob,
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
    const { jobId } = req.body; // Process until Vercel timeout

    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId',
        message: 'jobId is required to orchestrate batch processing'
      });
    }

    logger.success(`🎯 ORCHESTRATOR START: Processing batches until timeout for job ${jobId}`);

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

    // Process batches until Vercel times us out at 5 minutes
    while (job.currentBatch < job.totalBatches) {
      
      // Get current batch tickers
      const batchTickers = getCurrentBatchTickers(job);
      if (batchTickers.length === 0) {
        logger.warn(`⚠️ No tickers in current batch ${job.currentBatch} for job ${jobId}`);
        break;
      }

      const batchStartTime = Date.now();
      logger.success(`🚀 BATCH ${job.currentBatch + 1}/${job.totalBatches}: Processing [${batchTickers.join(', ')}]`);

      // Update job status
      job.status = 'running';
      job.currentTickerBeingProcessed = batchTickers[0];
      await getBatchJob(jobId); // This will update the job

      try {
        // Process the current batch
        const results = await fillCacheWithProgress(batchTickers, (progress) => {
          logger.success(`📊 Progress: ${progress.processed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
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

    // If not complete, set job to 'paused' status so it can be manually continued
    let nextOrchestration = null;
    if (!isComplete) {
      // Update job status to 'paused' when orchestrator times out
      job.status = 'paused';
      job.lastUpdate = new Date().toISOString();
      await updateBatchJob(job);
      
      logger.success(`⏸️ ORCHESTRATOR PAUSED: Job ${jobId} paused after processing ${batchesProcessed} batches (${totalDuration}ms)`);
      logger.success(`🔄 MANUAL RESTART NEEDED: Use Continue Processing button to resume job ${jobId}`);
      
      nextOrchestration = {
        scheduledFor: 'Manual restart required',
        message: 'Job paused due to Vercel timeout. Use Continue Processing button to resume.'
      };
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
        `Processed ${batchesProcessed} batches until timeout. ${job.totalBatches - job.currentBatch} batches remaining.`,
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