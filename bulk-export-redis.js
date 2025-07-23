// bulk-export-redis.js
// Fetch all 573 tickers from current Redis and export what exists

const tickersList = require('./tickers-list.json');

async function bulkExportFromRedis() {
  try {
    console.log('📦 Starting bulk export from Redis...');
    console.log(`📊 Will attempt to fetch ${tickersList.count} tickers`);
    
    // Use the cache management API to export data
    const exportResponse = await fetch('https://portfolio-backtesting-gqsmppra7-sunils-projects-7b08a1e8.vercel.app/api/cache/export');
    
    if (!exportResponse.ok) {
      throw new Error(`Export API failed: ${exportResponse.status}`);
    }
    
    const exportData = await exportResponse.json();
    
    if (!exportData.success) {
      throw new Error('Export API returned unsuccessful response');
    }
    
    console.log(`✅ Successfully exported cache data`);
    console.log(`   Total entries: ${exportData.count}`);
    
    // Count ticker-data entries
    const tickerDataEntries = Object.keys(exportData.data).filter(key => key.startsWith('ticker-data:'));
    const backtestEntries = Object.keys(exportData.data).filter(key => key.startsWith('backtest:'));
    
    console.log(`📊 Export breakdown:`);
    console.log(`   Ticker data: ${tickerDataEntries.length}`);
    console.log(`   Backtest results: ${backtestEntries.length}`);
    console.log(`   Other entries: ${exportData.count - tickerDataEntries.length - backtestEntries.length}`);
    
    // Extract ticker symbols that we actually have data for
    const actualTickers = tickerDataEntries.map(key => key.replace('ticker-data:', '')).sort();
    
    console.log(`\n📈 Found data for ${actualTickers.length} tickers`);
    console.log(`📋 First 20 tickers with data:`);
    actualTickers.slice(0, 20).forEach((ticker, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}: ${ticker}`);
    });
    
    if (actualTickers.length > 20) {
      console.log(`   ... and ${actualTickers.length - 20} more`);
    }
    
    // Check which tickers from our target list are missing
    const targetTickers = new Set(tickersList.tickers);
    const foundTickers = new Set(actualTickers);
    const missingTickers = tickersList.tickers.filter(ticker => !foundTickers.has(ticker));
    
    console.log(`\n❌ Missing tickers: ${missingTickers.length}`);
    if (missingTickers.length > 0 && missingTickers.length <= 20) {
      console.log(`   Missing: ${missingTickers.join(', ')}`);
    } else if (missingTickers.length > 20) {
      console.log(`   First 10 missing: ${missingTickers.slice(0, 10).join(', ')}`);
      console.log(`   ... and ${missingTickers.length - 10} more missing`);
    }
    
    // Save the export with metadata
    const fs = require('fs');
    const exportWithStats = {
      ...exportData,
      exportMetadata: {
        totalTargetTickers: tickersList.count,
        actualTickersFound: actualTickers.length,
        missingTickers: missingTickers,
        tickersList: actualTickers,
        exportedAt: new Date().toISOString(),
        readyForStatsTracking: true
      }
    };
    
    const filename = `redis-bulk-export-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(exportWithStats, null, 2));
    
    console.log(`\n💾 Export saved to: ${filename}`);
    console.log(`🎉 Ready for Redis cleanup and re-import with stats tracking!`);
    
    return {
      totalExported: exportData.count,
      tickersFound: actualTickers.length,
      missingCount: missingTickers.length,
      filename: filename
    };
    
  } catch (error) {
    console.error('❌ Bulk export failed:', error);
    throw error;
  }
}

// Run the export
bulkExportFromRedis()
  .then(result => {
    console.log('\n✅ Bulk export completed successfully!');
  })
  .catch(error => {
    console.error('\n💥 Bulk export failed:', error.message);
  });