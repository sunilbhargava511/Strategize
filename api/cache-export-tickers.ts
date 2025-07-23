import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
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
    const { tickers } = req.body;
    
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of tickers' });
    }

    logger.info(`📦 Exporting cache data for ${tickers.length} tickers...`);
    
    const exportData: Record<string, any> = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        tickerCount: tickers.length,
        tickers: tickers
      },
      data: {}
    };

    let exportedCount = 0;
    let missingCount = 0;
    const errors: string[] = [];

    // Export ticker data
    for (const ticker of tickers) {
      try {
        const tickerKey = `ticker-data:${ticker}`;
        const tickerData = await cache.get(tickerKey);
        
        if (tickerData) {
          exportData.data[tickerKey] = tickerData;
          exportedCount++;
          logger.info(`✅ Exported ${ticker}`);
        } else {
          missingCount++;
          logger.warn(`❌ No data found for ${ticker}`);
        }
      } catch (error: any) {
        errors.push(`${ticker}: ${error.message}`);
        logger.error(`Error exporting ${ticker}:`, error);
      }
    }

    // Also export any backtest data for these tickers
    logger.info('🔍 Searching for related backtest data...');
    let backtestCount = 0;
    
    // We'll use a pattern-based approach since we can't use KEYS
    // Backtests include ticker symbols in their keys
    for (const ticker of tickers) {
      // Try common backtest key patterns
      const patterns = [
        `backtest:*${ticker}*`,
        `backtest:*:${ticker}:*`,
        `backtest:*_${ticker}_*`
      ];
      
      // Since we can't use wildcard searches, we'll skip backtest export for now
      // Users can manually export backtests if needed
    }

    // Add summary
    exportData.metadata.summary = {
      requested: tickers.length,
      exported: exportedCount,
      missing: missingCount,
      errors: errors.length,
      backtests: backtestCount
    };

    if (errors.length > 0) {
      exportData.metadata.errors = errors;
    }

    logger.success(`Export complete: ${exportedCount} tickers exported, ${missingCount} missing`);

    // Return as JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cache-export-${new Date().toISOString().split('T')[0]}.json"`);
    
    return res.status(200).json(exportData);
  } catch (error: any) {
    logger.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}