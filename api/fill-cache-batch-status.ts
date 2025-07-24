// api/fill-cache-batch-status.ts
// Provides status and progress information for batch processing jobs

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getBatchJob, 
  getBatchProgress,
  listActiveBatchJobs 
} from './_batchProcessing';
import { logger } from './_logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { jobId, detailed = 'false' } = req.query;

    // Handle specific job status request
    if (jobId && typeof jobId === 'string') {
      logger.info(`📊 Getting status for batch job: ${jobId}`);

      const job = await getBatchJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Batch job not found',
          message: `No batch job found with ID: ${jobId}`
        });
      }

      const progress = await getBatchProgress(jobId);
      if (!progress) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get progress',
          message: 'Could not retrieve progress information'
        });
      }

      const isDetailed = detailed === 'true';
      const duration = Date.now() - startTime;

      const response = {
        success: true,
        jobId,
        status: job.status,
        progress: {
          processed: progress.processed,
          total: progress.total,
          percentage: Math.round(progress.percentage * 100) / 100,
          successful: progress.successful,
          failed: progress.failed,
          elapsedTime: progress.elapsedTime,
          estimatedTimeRemaining: progress.estimatedTimeRemaining
        },
        batches: {
          current: progress.currentBatch,
          total: progress.totalBatches,
          completed: progress.currentBatch,
          remaining: Math.max(0, progress.totalBatches - progress.currentBatch)
        },
        timing: {
          startTime: job.startTime,
          lastUpdate: job.lastUpdate,
          elapsedSeconds: progress.elapsedTime,
          estimatedRemainingSeconds: progress.estimatedTimeRemaining
        },
        currentTicker: progress.currentTicker,
        queryTime: duration,
        message: '', // Will be set below
        detailed: undefined as any // Will be set conditionally
      };

      // Add detailed information if requested
      if (isDetailed) {
        response.detailed = {
          batchSize: job.batchSize,
          tickersToProcess: job.tickersToProcess.length,
          successfulTickers: job.successfulTickers.slice(0, 50), // First 50 for brevity
          failedTickers: job.failedTickers.slice(0, 20), // First 20 failures
          hasMoreSuccessful: job.successfulTickers.length > 50,
          hasMoreFailed: job.failedTickers.length > 20,
          totalSuccessfulTickers: job.successfulTickers.length,
          totalFailedTickers: job.failedTickers.length
        };
      }

      // Add specific messages based on status
      switch (job.status) {
        case 'pending':
          response.message = 'Batch job created and waiting to start';
          break;
        case 'running':
          const remainingBatches = job.totalBatches - job.currentBatch;
          response.message = `Processing batch ${job.currentBatch + 1} of ${job.totalBatches}. ${remainingBatches} batches remaining.`;
          break;
        case 'completed':
          response.message = `Batch job completed! Processed ${job.successful} tickers successfully, ${job.failed} failed.`;
          break;
        case 'failed':
          response.message = `Batch job failed. Processed ${job.processed} of ${job.totalTickers} tickers before failure.`;
          break;
        case 'paused':
          response.message = `Batch job paused at batch ${job.currentBatch + 1} of ${job.totalBatches}.`;
          break;
        default:
          response.message = 'Unknown job status';
      }

      logger.info(`📊 Retrieved status for job ${jobId}: ${job.status} - ${progress.percentage.toFixed(1)}% complete`);
      return res.status(200).json(response);
    }

    // Handle list all active jobs request (admin/debugging feature)
    logger.info('📋 Listing all active batch jobs');
    
    const activeJobs = await listActiveBatchJobs();
    const duration = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: `Found ${activeJobs.length} active batch jobs`,
      activeJobs: activeJobs.length,
      jobs: activeJobs, // Usually empty due to Redis expiration cleanup
      queryTime: duration,
      note: 'Active jobs are automatically cleaned up via Redis expiration. Use specific jobId to check individual job status.'
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Batch status error (${duration}ms):`, error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get batch status',
      message: error.message || 'Unknown error occurred',
      queryTime: duration,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}