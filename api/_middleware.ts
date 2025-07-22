// api/_middleware.ts
// Optional middleware for request validation

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const validateRequestSize = (req: VercelRequest, res: VercelResponse) => {
  // Vercel has a 4.5MB request size limit for serverless functions
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 4 * 1024 * 1024) { // 4MB limit
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request size exceeds 4MB limit'
    });
  }
  return null; // Continue processing
};

export const validateTickerCount = (tickers: string[], maxCount: number = 200) => {
  if (tickers.length > maxCount) {
    throw new Error(`Too many tickers: ${tickers.length}. Maximum allowed: ${maxCount}`);
  }
};