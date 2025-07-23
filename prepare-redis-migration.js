// prepare-redis-migration.js
// Prepare Redis data for migration with stats tracking using existing backup

const fs = require('fs');
const tickersList = require('./tickers-list.json');

function prepareRedisMigration() {
  try {
    console.log('📦 Preparing Redis migration with stats tracking...');
    
    // Read the existing cache backup
    const backupPath = '/Users/sunilbhargava/Downloads/cache-backup-2025-07-23.json';
    console.log(`📂 Reading backup: ${backupPath}`);
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    console.log(`✅ Loaded backup with ${Object.keys(backupData.data).length} entries`);
    
    // Analyze what we have
    const allKeys = Object.keys(backupData.data);
    const tickerDataKeys = allKeys.filter(key => key.startsWith('ticker-data:'));
    const backtestKeys = allKeys.filter(key => key.startsWith('backtest:'));
    const otherKeys = allKeys.filter(key => !key.startsWith('ticker-data:') && !key.startsWith('backtest:'));
    
    console.log(`\n📊 Backup analysis:`);
    console.log(`   Ticker data entries: ${tickerDataKeys.length}`);
    console.log(`   Backtest results: ${backtestKeys.length}`);
    console.log(`   Other entries: ${otherKeys.length}`);
    console.log(`   Total entries: ${allKeys.length}`);
    
    // Extract actual tickers we have data for
    const actualTickers = tickerDataKeys.map(key => key.replace('ticker-data:', '')).sort();
    
    console.log(`\n📈 Tickers with data: ${actualTickers.length}`);
    
    // Compare with our target list of 573 tickers
    const targetTickers = new Set(tickersList.tickers);
    const foundTickers = new Set(actualTickers);
    const missingTickers = tickersList.tickers.filter(ticker => !foundTickers.has(ticker));
    const extraTickers = actualTickers.filter(ticker => !targetTickers.has(ticker));
    
    console.log(`\n🎯 Target vs Actual:`);
    console.log(`   Target tickers: ${tickersList.count}`);
    console.log(`   Found in backup: ${actualTickers.length}`);
    console.log(`   Missing: ${missingTickers.length}`);
    console.log(`   Extra (not in target): ${extraTickers.length}`);
    
    // Count total data points
    let totalDataPoints = 0;
    for (const key of tickerDataKeys) {
      const tickerData = backupData.data[key];
      if (tickerData && typeof tickerData === 'object') {
        totalDataPoints += Object.keys(tickerData).length;
      }
    }
    
    console.log(`\n📊 Data volume:`);
    console.log(`   Total year data points: ${totalDataPoints}`);
    console.log(`   Average years per ticker: ${Math.round(totalDataPoints / actualTickers.length)}`);
    
    // Create the stats object that will be stored in Redis
    const cacheStats = {
      uniqueTickers: actualTickers.length,
      tickersList: actualTickers,
      totalDataPoints: totalDataPoints,
      lastUpdated: new Date().toISOString(),
      failedTickers: {}, // Will be populated from backup if exists
      averageYearsPerTicker: Math.round(totalDataPoints / actualTickers.length),
      cacheStructure: 'redis-with-stats',
      migrationInfo: {
        migratedFrom: 'cache-backup-2025-07-23.json', 
        targetTickersCount: tickersList.count,
        missingTickersCount: missingTickers.length,
        extraTickersCount: extraTickers.length
      }
    };
    
    // Look for failed tickers in the backup
    const failedTickersKey = Object.keys(backupData.data).find(key => key.includes('failed_ticker'));
    if (failedTickersKey) {
      cacheStats.failedTickers = backupData.data[failedTickersKey] || {};
      console.log(`   Found failed tickers data: ${Object.keys(cacheStats.failedTickers).length} failed`);
    }
    
    // Create migration-ready data
    const migrationData = {
      success: true,
      data: {
        ...backupData.data,
        'cache:stats': cacheStats // Add the stats object
      },
      migrationMetadata: {
        originalEntries: allKeys.length,
        tickersFound: actualTickers.length,
        statsObjectAdded: true,
        readyForImport: true,
        createdAt: new Date().toISOString()
      },
      count: allKeys.length + 1 // +1 for the stats object
    };
    
    // Save migration-ready file
    const filename = `redis-migration-ready-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(migrationData, null, 2));
    
    console.log(`\n💾 Migration file created: ${filename}`);
    console.log(`🎉 Ready for Redis cleanup and import!`);
    
    // Show some sample tickers
    console.log(`\n📋 Sample tickers with data:`);
    actualTickers.slice(0, 10).forEach((ticker, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}: ${ticker}`);
    });
    
    if (missingTickers.length > 0) {
      console.log(`\n❌ Some missing tickers (first 10):`);
      missingTickers.slice(0, 10).forEach((ticker, i) => {
        console.log(`   ${(i + 1).toString().padStart(2)}: ${ticker}`);
      });
    }
    
    return {
      filename,
      tickersFound: actualTickers.length,
      totalEntries: migrationData.count,
      missingTickers: missingTickers.length
    };
    
  } catch (error) {
    console.error('❌ Migration preparation failed:', error);
    throw error;
  }
}

// Run the preparation
prepareRedisMigration()
  .then(result => {
    console.log('\n✅ Migration preparation completed!');
  })
  .catch(error => {
    console.error('\n💥 Migration preparation failed:', error.message);
  });