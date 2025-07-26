import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { getCacheStats, saveCacheStats } from './_cacheStats';
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

  try {
    logger.info('🔄 Migrating existing backtest data to include summaries...');
    
    const stats = await getCacheStats();
    const backtestKeys = Array.from(stats.backtestKeys).filter(key => !key.includes(':summary'));
    
    logger.info(`Found ${backtestKeys.length} backtest keys to check for summaries`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const key of backtestKeys) {
      try {
        const summaryKey = `${key}:summary`;
        
        // Check if summary already exists
        const existingSummary = await cache.get(summaryKey);
        if (existingSummary) {
          skipped++;
          continue;
        }
        
        // Get the full backtest data
        const fullData = await cache.get(key);
        if (!fullData) {
          logger.warn(`No data found for key: ${key}`);
          errors++;
          continue;
        }
        
        // Create lightweight summary from full data
        const keyParts = key.split(':');
        if (keyParts.length !== 5) {
          logger.warn(`Invalid key format: ${key}`);
          errors++;
          continue;
        }
        
        const tickers = keyParts[1].split(',');
        const startYear = parseInt(keyParts[2]);
        const endYear = parseInt(keyParts[3]);
        const initialInvestment = parseInt(keyParts[4]);
        
        const lightweightSummary = {
          key: key,
          tickers: tickers,
          startYear,
          endYear,
          initialInvestment,
          tickerCount: tickers.length,
          cachedAt: fullData.parameters?.analysisDate || new Date().toISOString(),
          isPermanent: endYear < new Date().getFullYear(),
          customName: fullData.customName || undefined,
          strategyPerformance: fullData.strategyPerformance,
          analysisDate: fullData.parameters?.analysisDate
        };
        
        // Save the summary
        await cache.set(summaryKey, lightweightSummary);
        
        // Add summary key to stats
        if (!stats.backtestKeys.has(summaryKey)) {
          stats.backtestKeys.add(summaryKey);
        }
        
        created++;
        
        if (created % 10 === 0) {
          logger.info(`Created ${created} summaries so far...`);
        }
        
      } catch (error) {
        logger.error(`Error processing key ${key}:`, error);
        errors++;
      }
    }
    
    // Update and save stats
    await saveCacheStats(stats);
    
    logger.info(`✅ Migration complete: ${created} summaries created, ${skipped} skipped, ${errors} errors`);
    
    return res.status(200).json({
      success: true,
      message: 'Summary migration completed successfully',
      results: {
        created,
        skipped,
        errors,
        totalProcessed: backtestKeys.length
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to migrate summaries:', error);
    return res.status(500).json({
      error: 'Failed to migrate summaries',
      message: error.message
    });
  }
}