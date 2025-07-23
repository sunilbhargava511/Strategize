import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cache } from './_upstashCache';
import { logger } from './_logger';
import { getCacheStats } from './_cacheStats';

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

  const { format = 'json' } = req.query;

  try {
    logger.info('Starting cache export using stats tracking...');
    
    // Get cache stats instead of using KEYS
    const stats = await getCacheStats();
    
    // Collect all keys from stats
    const allKeys: string[] = [
      ...Array.from(stats.tickers).map(ticker => `ticker-data:${ticker}`),
      ...Array.from(stats.backtestKeys),
      ...Array.from(stats.shareKeys)
    ];
    
    logger.info(`Found ${allKeys.length} cache keys from stats (${stats.tickerCount} tickers, ${stats.backtestCount} backtests, ${stats.shareCount} shares)`);
    
    if (format === 'csv') {
      // CSV export for ticker data
      const tickerKeys = Array.from(stats.tickers).map(ticker => `ticker-data:${ticker}`);
      const tickerData: any[] = [];
      
      for (const key of tickerKeys.slice(0, 1000)) { // Limit to avoid timeout
        try {
          const value = await cache.get(key);
          if (value) {
            const ticker = key.replace('ticker-data:', '');
            // Flatten the yearly data for CSV export
            for (const [year, yearData] of Object.entries(value as any)) {
              tickerData.push({
                key,
                ticker,
                year,
                data: yearData
              });
            }
          }
        } catch (err) {
          logger.error(`Error fetching ${key}:`, err);
        }
      }

      // Create CSV content
      let csv = 'Ticker,Year,Price,Market Cap,Shares Outstanding\n';
      
      tickerData.forEach(item => {
        const data = item.data;
        csv += `${item.ticker},${item.year},${data.price || ''},${data.market_cap || ''},${data.shares_outstanding || ''}\n`;
      });

      // Add summary section
      csv += '\n\nCache Summary\n';
      csv += `Total Ticker Data Entries,${stats.tickerCount}\n`;
      csv += `Total Data Points,${tickerData.length}\n`;
      csv += `Total Backtest Entries,${stats.backtestCount}\n`;
      csv += `Total Share Entries,${stats.shareCount}\n`;
      csv += `Export Date,${new Date().toISOString()}\n`;
      
      if (stats.tickerCount > 1000) {
        csv += `\nNote: Export limited to first 1000 ticker entries. Total ticker entries: ${stats.tickerCount}\n`;
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="cache-export.csv"');
      
      return res.status(200).send(csv);
    } else {
      // JSON export
      if (allKeys.length === 0) {
        return res.status(200).json({
          success: true,
          data: {},
          count: 0,
          exportedAt: new Date().toISOString(),
          stats: {
            tickerCount: stats.tickerCount,
            backtestCount: stats.backtestCount,
            shareCount: stats.shareCount
          }
        });
      }
      
      // Get all values in batches to avoid memory issues
      const batchSize = 100;
      const exportData: Record<string, any> = {};
      
      for (let i = 0; i < allKeys.length; i += batchSize) {
        const batch = allKeys.slice(i, i + batchSize);
        const values = await cache.mget(batch);
        
        batch.forEach((key, index) => {
          if (values[index] !== null) {
            exportData[key] = values[index];
          }
        });
        
        logger.info(`Exported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allKeys.length / batchSize)}`);
      }
      
      const exportCount = Object.keys(exportData).length;
      logger.info(`Cache export completed: ${exportCount} entries`);
      
      // Return the export data
      return res.status(200).json({
        success: true,
        data: exportData,
        count: exportCount,
        exportedAt: new Date().toISOString(),
        version: '2.0',
        stats: {
          tickerCount: stats.tickerCount,
          backtestCount: stats.backtestCount,
          shareCount: stats.shareCount,
          totalKeys: allKeys.length,
          exportedKeys: exportCount
        }
      });
    }
    
  } catch (error: any) {
    logger.error('Cache export failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Export failed', 
      message: error.message 
    });
  }
}