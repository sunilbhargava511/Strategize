// pages/api/cache/fill-progress.ts
// Polling endpoint for cache fill progress

import type { NextApiRequest, NextApiResponse } from 'next';
import { fillCacheWithProgress } from '../../../api/data/dataProcessing';
import { logger } from '../../../api/_logger';
import type { FillCacheProgress } from '../../../api/data/dataProcessing';

// Store progress in memory (in production, use Redis or similar)
const progressStore = new Map<string, {
  progress: FillCacheProgress | null;
  results: any;
  error: string | null;
  completed: boolean;
}>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Start cache fill operation
    const { tickers } = req.body;
    
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({ message: 'Invalid tickers array' });
    }

    // Generate unique session ID
    const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress store
    progressStore.set(sessionId, {
      progress: {
        processed: 0,
        total: tickers.length,
        percentage: 0,
        successful: 0,
        failed: 0
      },
      results: null,
      error: null,
      completed: false
    });

    // Return session ID immediately
    res.status(200).json({ sessionId });

    // Start async cache fill operation (don't await - run in background)
    (async () => {
      try {
        logger.info(`Starting cache fill for session ${sessionId} with ${tickers.length} tickers: ${tickers.join(', ')}`);
        
        const results = await fillCacheWithProgress(tickers, (progress: FillCacheProgress) => {
          const session = progressStore.get(sessionId);
          if (session) {
            session.progress = progress;
            progressStore.set(sessionId, session);
            logger.debug(`Session ${sessionId}: Progress ${progress.percentage.toFixed(1)}% - ${progress.processed}/${progress.total}`);
          }
        });
        
        const session = progressStore.get(sessionId);
        if (session) {
          session.results = results;
          session.completed = true;
          progressStore.set(sessionId, session);
          logger.success(`Session ${sessionId}: Cache fill completed successfully`);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            progressStore.delete(sessionId);
            logger.debug(`Session ${sessionId}: Cleaned up from memory`);
          }, 5 * 60 * 1000);
        }
      } catch (error) {
        logger.error(`Session ${sessionId}: Cache fill error:`, error);
        const session = progressStore.get(sessionId);
        if (session) {
          session.error = error instanceof Error ? error.message : String(error);
          session.completed = true;
          progressStore.set(sessionId, session);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            progressStore.delete(sessionId);
            logger.debug(`Session ${sessionId}: Cleaned up from memory after error`);
          }, 5 * 60 * 1000);
        }
      }
    })();
    
  } else if (req.method === 'GET') {
    // Get progress for session
    const { sessionId } = req.query;
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'Invalid session ID' });
    }

    const session = progressStore.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    return res.status(200).json({
      progress: session.progress,
      results: session.results,
      error: session.error,
      completed: session.completed
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}