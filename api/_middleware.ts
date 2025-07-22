// api/_middleware.ts
// Request validation middleware for Vercel deployment

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SIZE_LIMITS } from './_constants';
import { logger } from './_logger';

export const validateRequestSize = (req: VercelRequest, res: VercelResponse) => {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > SIZE_LIMITS.MAX_REQUEST_SIZE) {
    logger.warn(`Request too large: ${contentLength} bytes`);
    return res.status(413).json({
      error: 'Request too large',
      message: `Request size exceeds ${SIZE_LIMITS.MAX_REQUEST_SIZE / 1024 / 1024}MB limit`
    });
  }
  return null; // Continue processing
};

export const validateTickerCount = (tickers: string[], context: 'backtest' | 'fill-cache' = 'backtest') => {
  const maxCount = context === 'fill-cache' ? SIZE_LIMITS.MAX_FILL_CACHE_BATCH : SIZE_LIMITS.MAX_PORTFOLIO;
  
  if (tickers.length > maxCount) {
    throw new Error(
      `Too many tickers for ${context}: ${tickers.length}. Maximum allowed: ${maxCount}. ` +
      `Consider breaking into smaller batches.`
    );
  }
  
  // Warning for large portfolios
  if (context === 'backtest' && tickers.length > SIZE_LIMITS.LARGE_PORTFOLIO) {
    logger.warn(`Large portfolio analysis: ${tickers.length} tickers may take 5-9 minutes`);
  }
};

export const getPortfolioSizeCategory = (tickerCount: number): string => {
  if (tickerCount <= SIZE_LIMITS.SMALL_PORTFOLIO) return 'small';
  if (tickerCount <= SIZE_LIMITS.MEDIUM_PORTFOLIO) return 'medium';
  if (tickerCount <= SIZE_LIMITS.LARGE_PORTFOLIO) return 'large';
  return 'maximum';
};

export const getEstimatedExecutionTime = (tickerCount: number): string => {
  if (tickerCount <= SIZE_LIMITS.SMALL_PORTFOLIO) return '30-60 seconds';
  if (tickerCount <= SIZE_LIMITS.MEDIUM_PORTFOLIO) return '2-5 minutes';
  if (tickerCount <= SIZE_LIMITS.LARGE_PORTFOLIO) return '5-8 minutes';
  return '8-9.5 minutes';
};