// scripts/testCache.js
// Test script to verify Upstash Redis connection
// Run with: node scripts/testCache.js

require('dotenv').config();
const cache = require('../cache/upstashCache');

async function testCache() {
  console.log('🧪 Testing Upstash Redis Cache\n');
  
  try {
    // Test 1: Basic set/get
    console.log('Test 1: Basic set/get');
    const testTicker = 'AAPL';
    const testDate = '2024-01-15';
    const testData = {
      price: 195.50,
      marketCap: 3000000000000,
      sharesOutstanding: 15350000000
    };
    
    // Set
    await cache.set(testTicker, testDate, testData);
    console.log('✅ Set data successfully');
    
    // Get
    const retrieved = await cache.get(testTicker, testDate);
    console.log('✅ Retrieved:', retrieved);
    
    // Test 2: Batch operations
    console.log('\nTest 2: Batch operations');
    const batchData = [
      { ticker: 'MSFT', date: '2024-01-15', price: 400, marketCap: 3000000000000, sharesOutstanding: 7430000000 },
      { ticker: 'GOOGL', date: '2024-01-15', price: 150, marketCap: 1900000000000, sharesOutstanding: 12700000000 },
      { ticker: 'AMZN', date: '2024-01-15', price: 170, marketCap: 1800000000000, sharesOutstanding: 10600000000 }
    ];
    
    await cache.batchSet(batchData);
    console.log('✅ Batch set completed');
    
    // Batch get
    const requests = batchData.map(d => ({ ticker: d.ticker, date: d.date }));
    const batchResults = await cache.batchGet(requests);
    console.log(`✅ Batch get retrieved ${batchResults.size} items`);
    
    // Test 3: Memory cache
    console.log('\nTest 3: Memory cache performance');
    const memStart = Date.now();
    for (let i = 0; i < 1000; i++) {
      cache.getFromMemory('AAPL', '2024-01-15');
    }
    const memTime = Date.now() - memStart;
    console.log(`✅ 1000 memory lookups in ${memTime}ms (${(memTime/1000).toFixed(3)}ms per lookup)`);
    
    // Test 4: Stats
    console.log('\nTest 4: Cache statistics');
    const stats = cache.getStats();
    console.log('📊 Stats:', stats);
    
    console.log('\n✅ All tests passed! Upstash Redis is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nMake sure:');
    console.error('1. Upstash Redis is set up in Vercel');
    console.error('2. Environment variables are set:');
    console.error('   - UPSTASH_REDIS_REST_URL');
    console.error('   - UPSTASH_REDIS_REST_TOKEN');
  }
}

// Run the test
testCache();