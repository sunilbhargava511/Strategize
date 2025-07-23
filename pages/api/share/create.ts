// pages/api/share/create.ts
// API endpoint to create shareable analysis links

import type { NextApiRequest, NextApiResponse } from 'next';
import { cache } from '../../../api/_upstashCache';
import { logger } from '../../../api/_logger';
import { nanoid } from 'nanoid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { results, simulationName } = req.body;

  if (!results) {
    return res.status(400).json({ message: 'Analysis results are required' });
  }

  try {
    // Generate unique share ID (URL-safe, 10 characters)
    const shareId = nanoid(10);
    
    // Prepare data to share (exclude sensitive information)
    const shareData = {
      results,
      simulationName: simulationName || 'Portfolio Analysis',
      createdAt: new Date().toISOString(),
      shareId
    };

    // Store in cache with 7-day expiration (604800 seconds)
    const cacheKey = `shared_analysis:${shareId}`;
    await cache.set(cacheKey, shareData, 604800);
    
    // Update cache stats
    const { addShareToStats } = await import('../../../api/_cacheStats');
    await addShareToStats(cacheKey);

    const baseUrl = req.headers.host?.includes('localhost') ? 'http://' + req.headers.host : 'https://' + req.headers.host;
    const shareUrl = `${baseUrl}/share/${shareId}`;
    
    logger.info(`Created shared analysis: ${shareId} - "${simulationName}"`);
    logger.info(`Share URL: ${shareUrl}`);
    
    return res.status(200).json({
      success: true,
      shareId,
      shareUrl,
      expiresIn: '7 days'
    });
    
  } catch (error) {
    logger.error('Error creating shared analysis:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to create shareable link' 
    });
  }
}