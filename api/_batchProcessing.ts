// api/_batchProcessing.ts
// Batch processing utilities for large fill-cache operations

import { cache } from './_upstashCache';
import { logger } from './_logger';
import { validateCacheCoverage } from './cache/cacheOperations';

// Batch job interfaces
export interface BatchJob {
  jobId: string;
  totalTickers: number;
  tickersToProcess: string[];
  processed: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  batchSize: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startTime: string;
  processingStartTime?: string;
  lastUpdate: string;
  failedTickers: Array<{
    ticker: string;
    error: string;
    batchNumber: number;
  }>;
  successfulTickers: string[];
  estimatedTimeRemaining?: number;
  currentTickerBeingProcessed?: string;
}

export interface BatchProgress {
  jobId: string;
  processed: number;
  total: number;
  percentage: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
  status: BatchJob['status'];
  estimatedTimeRemaining?: number;
  currentTicker?: string;
  elapsedTime: number;
}

// Constants for batch processing
export const BATCH_CONSTANTS = {
  MICRO_BATCH_SIZE: 5,           // 5 tickers per batch (2-3 minutes)
  TIMEOUT_SAFETY_MARGIN: 60000,  // 60 seconds safety margin (240s effective timeout)
  MAX_CONCURRENT_BATCHES: 1,     // Process one batch at a time
  PROGRESS_UPDATE_INTERVAL: 1000, // Update progress every second
  JOB_EXPIRY_HOURS: 24,          // Jobs expire after 24 hours
  REDIS_KEY_PREFIX: 'batch_job',
  CONTINUATION_DELAY: 2000,      // 2 second delay between batches
} as const;

// Generate unique job ID
export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${BATCH_CONSTANTS.REDIS_KEY_PREFIX}_${timestamp}_${random}`;
}

// Create new batch job
export async function createBatchJob(
  allTickers: string[],
  batchSize: number = BATCH_CONSTANTS.MICRO_BATCH_SIZE
): Promise<BatchJob> {
  const jobId = generateJobId();
  logger.info(`🚀 Creating batch job ${jobId} for ${allTickers.length} tickers`);

  // Validate which tickers need processing
  const { missing, eliminated } = await validateCacheCoverage(allTickers);
  const tickersToProcess = missing; // Only process missing tickers
  
  logger.info(`📊 Batch job analysis: ${allTickers.length} total, ${tickersToProcess.length} need processing, ${eliminated.length} previously failed`);

  const totalBatches = Math.ceil(tickersToProcess.length / batchSize);
  
  const batchJob: BatchJob = {
    jobId,
    totalTickers: allTickers.length,
    tickersToProcess,
    processed: allTickers.length - tickersToProcess.length, // Start with already cached count
    successful: allTickers.length - tickersToProcess.length - eliminated.length,
    failed: eliminated.length,
    currentBatch: 0,
    totalBatches,
    batchSize,
    status: 'pending',
    startTime: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    failedTickers: eliminated.map((e, index) => ({
      ticker: e.ticker,
      error: e.reason,
      batchNumber: -1 // Pre-existing failures
    })),
    successfulTickers: allTickers.filter(t => 
      !tickersToProcess.includes(t) && !eliminated.find(e => e.ticker === t)
    )
  };

  // Store job in Redis with expiration
  const expirySeconds = BATCH_CONSTANTS.JOB_EXPIRY_HOURS * 3600;
  await cache.set(`${BATCH_CONSTANTS.REDIS_KEY_PREFIX}:${jobId}`, batchJob, expirySeconds);
  
  logger.success(`✅ Created batch job ${jobId}: ${totalBatches} batches of ${batchSize} tickers each`);
  return batchJob;
}

// Get batch job from Redis
export async function getBatchJob(jobId: string): Promise<BatchJob | null> {
  try {
    const job = await cache.get(`${BATCH_CONSTANTS.REDIS_KEY_PREFIX}:${jobId}`) as BatchJob;
    return job;
  } catch (error) {
    logger.error(`Failed to get batch job ${jobId}:`, error);
    return null;
  }
}

// Update batch job in Redis
export async function updateBatchJob(job: BatchJob): Promise<boolean> {
  try {
    job.lastUpdate = new Date().toISOString();
    const expirySeconds = BATCH_CONSTANTS.JOB_EXPIRY_HOURS * 3600;
    await cache.set(`${BATCH_CONSTANTS.REDIS_KEY_PREFIX}:${job.jobId}`, job, expirySeconds);
    return true;
  } catch (error) {
    logger.error(`Failed to update batch job ${job.jobId}:`, error);
    return false;
  }
}

// Get current batch tickers to process
export function getCurrentBatchTickers(job: BatchJob): string[] {
  const startIndex = job.currentBatch * job.batchSize;
  const endIndex = Math.min(startIndex + job.batchSize, job.tickersToProcess.length);
  return job.tickersToProcess.slice(startIndex, endIndex);
}

// Update job progress after batch completion
export async function updateBatchProgress(
  jobId: string,
  batchResults: {
    successful: string[];
    failed: Array<{ ticker: string; error: string; }>;
  }
): Promise<BatchJob | null> {
  const job = await getBatchJob(jobId);
  if (!job) {
    logger.error(`Batch job ${jobId} not found for progress update`);
    return null;
  }

  // Update counters
  job.successful += batchResults.successful.length;
  job.failed += batchResults.failed.length;
  job.processed += batchResults.successful.length + batchResults.failed.length;
  job.currentBatch += 1;

  // Update ticker lists
  job.successfulTickers.push(...batchResults.successful);
  job.failedTickers.push(...batchResults.failed.map(f => ({
    ticker: f.ticker,
    error: f.error,
    batchNumber: job.currentBatch
  })));

  // Update status
  if (job.currentBatch >= job.totalBatches) {
    job.status = 'completed';
    logger.success(`🎉 Batch job ${jobId} completed! ${job.successful} successful, ${job.failed} failed`);
  } else {
    job.status = 'running';
    // Set processing start time if this is the first time going to 'running' status
    if (!job.processingStartTime) {
      job.processingStartTime = new Date().toISOString();
      logger.success(`🟢 PROCESSING STARTED: Job ${jobId} began processing at ${job.processingStartTime}`);
    }
  }

  // Calculate estimated time remaining
  if (job.currentBatch > 0 && job.status === 'running') {
    const elapsed = Date.now() - new Date(job.startTime).getTime();
    const avgTimePerBatch = elapsed / job.currentBatch;
    const remainingBatches = job.totalBatches - job.currentBatch;
    job.estimatedTimeRemaining = Math.round((avgTimePerBatch * remainingBatches) / 1000); // seconds
  }

  await updateBatchJob(job);
  return job;
}

// Get progress summary for frontend
export async function getBatchProgress(jobId: string): Promise<BatchProgress | null> {
  const job = await getBatchJob(jobId);
  if (!job) return null;

  const elapsed = Date.now() - new Date(job.startTime).getTime();
  
  return {
    jobId: job.jobId,
    processed: job.processed,
    total: job.totalTickers,
    percentage: (job.processed / job.totalTickers) * 100,
    successful: job.successful,
    failed: job.failed,
    currentBatch: job.currentBatch,
    totalBatches: job.totalBatches,
    status: job.status,
    estimatedTimeRemaining: job.estimatedTimeRemaining,
    currentTicker: job.currentTickerBeingProcessed,
    elapsedTime: Math.round(elapsed / 1000)
  };
}

// Mark job as failed
export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const job = await getBatchJob(jobId);
  if (job) {
    job.status = 'failed';
    job.lastUpdate = new Date().toISOString();
    await updateBatchJob(job);
    logger.error(`❌ Marked batch job ${jobId} as failed: ${error}`);
  }
}

// Clean up old batch jobs
export async function cleanupOldJobs(): Promise<number> {
  try {
    // This would require scanning for old job keys
    // For now, we rely on Redis expiration
    logger.info('Old batch jobs cleaned up via Redis expiration');
    return 0;
  } catch (error) {
    logger.error('Failed to cleanup old batch jobs:', error);
    return 0;
  }
}

// List active batch jobs (for debugging/admin)
export async function listActiveBatchJobs(): Promise<string[]> {
  try {
    // In a production environment, we'd scan for batch job keys
    // For now, return empty array as jobs are cleaned up automatically
    return [];
  } catch (error) {
    logger.error('Failed to list active batch jobs:', error);
    return [];
  }
}