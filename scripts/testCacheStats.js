// Test script to check cache stats
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testCacheStats() {
  try {
    console.log('Testing cache stats...\n');
    
    // Import the cache stats module
    const { getCacheStats, loadCacheStats } = await import('../api/_cacheStats.ts');
    
    // Load and display cache stats
    console.log('Loading cache stats from Redis...');
    const stats = await loadCacheStats();
    
    console.log('\nCache Stats:');
    console.log(`- Ticker Count: ${stats.tickerCount}`);
    console.log(`- Backtest Count: ${stats.backtestCount}`);
    console.log(`- Share Count: ${stats.shareCount}`);
    console.log(`- Last Updated: ${stats.lastUpdated}`);
    console.log(`- Version: ${stats.version}`);
    
    if (stats.backtestCount > 0) {
      console.log('\nBacktest Keys (first 5):');
      const keys = Array.from(stats.backtestKeys).slice(0, 5);
      keys.forEach(key => console.log(`  - ${key}`));
    } else {
      console.log('\nNo backtest keys found in cache stats.');
    }
    
  } catch (error) {
    console.error('Error testing cache stats:', error);
  }
}

testCacheStats();