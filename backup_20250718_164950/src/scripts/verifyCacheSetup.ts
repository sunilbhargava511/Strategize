// src/scripts/verifyCacheSetup.ts

import fs from 'fs';
import path from 'path';
import { getHistoricalDataCache } from '../lib/cache/historicalDataCache';
import { Stock } from '../types/backtesting';

/**
 * Script to verify the cache system is set up correctly
 * Run with: npx ts-node src/scripts/verifyCacheSetup.ts
 */

interface VerificationResult {
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

async function checkFileExists(filePath: string, description: string): Promise<VerificationResult> {
  const exists = fs.existsSync(filePath);
  return {
    check: `${description} exists`,
    status: exists ? 'pass' : 'fail',
    message: exists ? `Found at ${filePath}` : `Missing: ${filePath}`
  };
}

async function checkCacheDirectory(): Promise<VerificationResult> {
  const cacheDir = path.join(process.cwd(), 'cache');
  const exists = fs.existsSync(cacheDir);
  const isDirectory = exists && fs.statSync(cacheDir).isDirectory();
  
  return {
    check: 'Cache directory exists',
    status: isDirectory ? 'pass' : 'fail',
    message: isDirectory ? `Cache directory found at ${cacheDir}` : 'Cache directory not found'
  };
}

async function checkCacheFiles(): Promise<VerificationResult> {
  const cacheDir = path.join(process.cwd(), 'cache');
  const dataFile = path.join(cacheDir, 'historical_stock_data.json');
  const metadataFile = path.join(cacheDir, 'cache_metadata.json');
  
  const dataExists = fs.existsSync(dataFile);
  const metadataExists = fs.existsSync(metadataFile);
  
  if (dataExists && metadataExists) {
    try {
      const dataSize = fs.statSync(dataFile).size;
      const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
      return {
        check: 'Cache files exist',
        status: 'pass',
        message: `Data file: ${dataSizeMB} MB, Metadata file: present`
      };
    } catch (error) {
      return {
        check: 'Cache files exist',
        status: 'warning',
        message: 'Files exist but could not read stats'
      };
    }
  }
  
  return {
    check: 'Cache files exist',
    status: 'warning',
    message: 'Cache files not found (will be created on first use)'
  };
}

async function checkCacheInstance(): Promise<VerificationResult> {
  try {
    const cache = getHistoricalDataCache();
    const stats = cache.getStats();
    
    return {
      check: 'Cache instance works',
      status: 'pass',
      message: `Cache loaded with ${stats.totalRecords} records, ${stats.uniqueTickers} tickers`
    };
  } catch (error) {
    return {
      check: 'Cache instance works',
      status: 'fail',
      message: `Error loading cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function checkEnvironmentVariables(): Promise<VerificationResult> {
  const hasApiToken = !!process.env.EODHD_API_TOKEN;
  const tokenLength = process.env.EODHD_API_TOKEN?.length || 0;
  
  if (!hasApiToken) {
    return {
      check: 'EODHD API token configured',
      status: 'fail',
      message: 'EODHD_API_TOKEN not found in environment'
    };
  }
  
  if (tokenLength < 10) {
    return {
      check: 'EODHD API token configured',
      status: 'warning',
      message: 'EODHD_API_TOKEN seems too short'
    };
  }
  
  return {
    check: 'EODHD API token configured',
    status: 'pass',
    message: `API token configured (${tokenLength} characters)`
  };
}

async function checkSP500Data(): Promise<VerificationResult> {
  const csvPath = path.join(process.cwd(), 'data', 'sp500-tickers.csv');
  
  if (!fs.existsSync(csvPath)) {
    return {
      check: 'S&P 500 data file exists',
      status: 'fail',
      message: `Missing: ${csvPath}`
    };
  }
  
  try {
    const Papa = require('papaparse');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    
    const stocks: Stock[] = parsed.data;
    return {
      check: 'S&P 500 data file exists',
      status: 'pass',
      message: `Found ${stocks.length} stocks in S&P 500 data`
    };
  } catch (error) {
    return {
      check: 'S&P 500 data file exists',
      status: 'warning',
      message: 'File exists but could not parse'
    };
  }
}

async function testCacheFunctionality(): Promise<VerificationResult> {
  try {
    const cache = getHistoricalDataCache();
    
    // Test set and get
    const testData = {
      ticker: 'TEST.US',
      date: '2024-01-01',
      price: 100,
      adjustedPrice: 100,
      sharesOutstanding: 1000000,
      marketCap: 100000000,
      lastUpdated: new Date().toISOString(),
      isDelisted: false
    };
    
    cache.set(testData);
    const retrieved = cache.get('TEST.US', '2024-01-01');
    
    if (retrieved && retrieved.price === 100) {
      return {
        check: 'Cache set/get functionality',
        status: 'pass',
        message: 'Cache operations working correctly'
      };
    }
    
    return {
      check: 'Cache set/get functionality',
      status: 'fail',
      message: 'Cache operations not working as expected'
    };
  } catch (error) {
    return {
      check: 'Cache set/get functionality',
      status: 'fail',
      message: `Error testing cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function main() {
  console.log('🔍 Cache System Verification');
  console.log('=' .repeat(50) + '\n');
  
  // Load environment variables
  const dotenv = await import('dotenv');
  dotenv.config();
  
  const checks: VerificationResult[] = [];
  
  // Run all checks
  checks.push(await checkFileExists(
    path.join(process.cwd(), 'src/lib/cache/historicalDataCache.ts'),
    'Cache manager file'
  ));
  
  checks.push(await checkFileExists(
    path.join(process.cwd(), 'src/scripts/warmCache.ts'),
    'Cache warming script'
  ));
  
  checks.push(await checkFileExists(
    path.join(process.cwd(), 'src/scripts/cacheStats.ts'),
    'Cache stats script'
  ));
  
  checks.push(await checkCacheDirectory());
  checks.push(await checkCacheFiles());
  checks.push(await checkEnvironmentVariables());
  checks.push(await checkSP500Data());
  checks.push(await checkCacheInstance());
  checks.push(await testCacheFunctionality());
  
  // Display results
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  checks.forEach(result => {
    const emoji = result.status === 'pass' ? '✅' : 
                  result.status === 'fail' ? '❌' : '⚠️';
    
    console.log(`${emoji} ${result.check}`);
    console.log(`   ${result.message}\n`);
    
    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  });
  
  // Summary
  console.log('=' .repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ⚠️  Warnings: ${warningCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n🎉 Cache system is properly configured!');
    
    if (warningCount > 0) {
      console.log('   Note: Some warnings were found but the system should work.');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Run "npm run warm-cache" to populate the cache');
    console.log('   2. Monitor progress - this may take several hours');
    console.log('   3. Check cache stats with "npm run cache-stats"');
  } else {
    console.log('\n❌ Some checks failed. Please fix the issues above and run again.');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}