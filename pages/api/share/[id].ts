// pages/api/share/[id].ts
// API endpoint to fetch shared analysis results

import type { NextApiRequest, NextApiResponse } from 'next';
import { cache } from '../../../api/_upstashCache';
import { logger } from '../../../api/_logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid share ID' });
  }

  try {
    // Get shared analysis from cache
    const cacheKey = `shared_analysis:${id}`;
    const sharedData = await cache.get(cacheKey);

    if (!sharedData) {
      logger.warn(`Shared analysis not found: ${id}`);
      return res.status(404).json({ message: 'Shared analysis not found' });
    }

    logger.info(`Served shared analysis: ${id}`);
    
    return res.status(200).json(sharedData);
    
  } catch (error) {
    logger.error('Error fetching shared analysis:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}