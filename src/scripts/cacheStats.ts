// src/scripts/cacheStats.ts

import { getHistoricalDataCache } from '../lib/cache/historicalDataCache';

/**
 * Script to display cache statistics
 * Run with: npm run cache-stats
 */

async function main() {
  console.log('📊 Historical Data Cache Statistics');
  console.log('=' .repeat(50));
  
  try {
    const cache = getHistoricalDataCache();
    const stats = cache.getStats();
    
    console.log(`\n📦 Total Records: ${stats.totalRecords.toLocaleString()}`);
    console.log(`🏷️  Unique Tickers: ${stats.uniqueTickers}`);
    console.log(`📅 Date Range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
    console.log(`❌ Delisted Stocks: ${stats.delistedCount}`);
    
    // Calculate cache size estimate
    const estimatedSizeKB = (stats.totalRecords * 0.5); // Rough estimate: 0.5KB per record
    const estimatedSizeMB = (estimatedSizeKB / 1024).toFixed(2);
    console.log(`💾 Estimated Cache Size: ${estimatedSizeMB} MB`);
    
    // Calculate cache efficiency
    const cacheEfficiency = stats.totalRecords > 0 
      ? ((1 - (stats.delistedCount / stats.totalRecords)) * 100).toFixed(1)
      : 0;
    console.log(`✅ Cache Efficiency: ${cacheEfficiency}% (non-delisted entries)`);
    
    // Show sample tickers if available
    if (stats.uniqueTickers > 0) {
      console.log('\n📋 Sample Tickers in Cache:');
      // This would need to be enhanced in the actual cache implementation
      // to return sample tickers
    }
    
  } catch (error) {
    console.error('❌ Error getting cache statistics:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}