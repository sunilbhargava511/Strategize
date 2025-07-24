// api/fill-cache-batch-continue.ts
// Continues batch processing for large fill-cache operations

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
    const { jobId, autoContinue = true } = req.body;

    if (!jobId) {
      return res.status(400).json({ 
        error: 'Missing jobId',
        message: 'jobId is required to continue batch processing'
      });
    }

    // Get the batch job
    const job = await getBatchJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Batch job not found',
        message: `No batch job found with ID: ${jobId}`
      });
    }

    // Check if job is already completed
    if (job.status === 'completed') {
      logger.info(`✅ Batch job ${jobId} already completed`);
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

    // Check if all batches are processed
    if (job.currentBatch >= job.totalBatches) {
      logger.info(`🎉 All batches completed for job ${jobId}`);
      job.status = 'completed';
      await updateBatchProgress(jobId, { successful: [], failed: [] });
      
      return res.status(200).json({
        success: true,
        completed: true,
        message: 'All batches completed',
        jobId,
        summary: {
          totalTickers: job.totalTickers,
          successful: job.successful,
          failed: job.failed,
          processed: job.processed
        }
      });
    }

    // Get current batch tickers to process
    const batchTickers = getCurrentBatchTickers(job);
    if (batchTickers.length === 0) {
      logger.warn(`⚠️ No tickers in current batch ${job.currentBatch} for job ${jobId}`);
      return res.status(400).json({
        success: false,
        error: 'No tickers to process',
        message: 'Current batch has no tickers to process'
      });
    }

    logger.info(`🔄 Processing batch ${job.currentBatch + 1}/${job.totalBatches} for job ${jobId}: [${batchTickers.join(', ')}]`);

    // Update job status to running
    job.status = 'running';
    job.currentTickerBeingProcessed = batchTickers[0];
    await getBatchJob(jobId); // This will update the job

    // Set timeout protection
    const timeoutId = setTimeout(() => {
      logger.error(`⏰ Batch processing timeout for job ${jobId}, batch ${job.currentBatch + 1}`);
    }, BATCH_CONSTANTS.TIMEOUT_SAFETY_MARGIN);

    try {
      // Process the current batch
      const results = await fillCacheWithProgress(batchTickers, (progress) => {
        logger.info(`📊 Batch ${job.currentBatch + 1}/${job.totalBatches} progress: ${progress.processed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
      });

      clearTimeout(timeoutId);

      // Update batch progress
      const updatedJob = await updateBatchProgress(jobId, {
        successful: results.success,
        failed: results.errors.map(e => ({ ticker: e.ticker, error: e.error }))
      });

      if (!updatedJob) {
        throw new Error('Failed to update batch progress');
      }

      const batchDuration = Date.now() - startTime;
      logger.success(`✅ Completed batch ${updatedJob.currentBatch}/${updatedJob.totalBatches} for job ${jobId} in ${(batchDuration / 1000).toFixed(1)}s`);

      // Prepare response
      const response = {
        success: true,
        completed: updatedJob.status === 'completed',
        jobId,
        batchNumber: updatedJob.currentBatch,
        totalBatches: updatedJob.totalBatches,
        batchResults: {
          successful: results.success.length,
          failed: results.errors.length,
          tickers: batchTickers
        },
        progress: {
          processed: updatedJob.processed,
          total: updatedJob.totalTickers,
          percentage: (updatedJob.processed / updatedJob.totalTickers) * 100,
          successful: updatedJob.successful,
          failed: updatedJob.failed
        },
        estimatedTimeRemaining: updatedJob.estimatedTimeRemaining,
        nextBatchAvailable: updatedJob.currentBatch < updatedJob.totalBatches,
        duration: batchDuration
      };

      // Auto-continue to next batch if requested and not completed
      if (autoContinue && updatedJob.status === 'running' && updatedJob.currentBatch < updatedJob.totalBatches) {
        logger.info(`🔄 Auto-continuing to next batch for job ${jobId}...`);
        
        // Add small delay to prevent overwhelming the system
        setTimeout(async () => {
          try {
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers.host;
            const continueUrl = `${protocol}://${host}/api/fill-cache-batch-continue`;
            
            const continueResponse = await fetch(continueUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId, autoContinue: true })
            });
            
            if (!continueResponse.ok) {
              logger.error(`Failed to auto-continue batch job ${jobId}: ${continueResponse.status}`);
            } else {
              logger.info(`🚀 Successfully triggered next batch for job ${jobId}`);
            }
          } catch (error) {
            logger.error(`Error auto-continuing batch job ${jobId}:`, error);
          }
        }, BATCH_CONSTANTS.CONTINUATION_DELAY);

        response.message = updatedJob.status === 'completed' ? 
          'Batch completed - all done!' : 
          'Batch completed - continuing to next batch automatically';
      } else {
        response.message = updatedJob.status === 'completed' ? 
          'All batches completed!' : 
          'Batch completed - call continue API for next batch';
      }

      return res.status(200).json(response);

    } catch (processError: any) {
      clearTimeout(timeoutId);
      logger.error(`❌ Error processing batch ${job.currentBatch + 1} for job ${jobId}:`, processError);
      
      await markJobFailed(jobId, processError.message);
      
      return res.status(500).json({
        success: false,
        error: 'Batch processing failed',
        message: processError.message,
        jobId,
        batchNumber: job.currentBatch + 1,
        totalBatches: job.totalBatches
      });
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Fill cache batch continue error (${duration}ms):`, error);
    
    return res.status(500).json({
      success: false,
      error: 'Batch continuation failed',
      message: error.message || 'Unknown error occurred',
      duration,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}