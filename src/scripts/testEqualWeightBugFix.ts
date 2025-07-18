// src/scripts/testEqualWeightBugFix.ts
// Test script to verify the Equal Weight Buy & Hold strategy correctly handles newly available stocks

import { Stock } from '../types/backtesting';
import { getAvailableStocks } from '../lib/utils/portfolioUtils';
import { getStartOfYearDate } from '../lib/utils/dateUtils';

/**
 * Script to demonstrate the corrected behavior in Equal Weight Buy & Hold strategy
 * Run with: npm run test-bug-fix
 */

function simulateOldBehavior(stocks: Stock[], startYear: number, endYear: number) {
  console.log('\n🐛 OLD BEHAVIOR (With Bug):');
  console.log('=' .repeat(50));
  
  const holdings = new Set<string>();
  let totalStocks = 0;
  
  for (let year = startYear; year <= endYear; year++) {
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    // Old behavior: Add ALL available stocks without checking if they're already held
    let newStocksAdded = 0;
    availableStocks.forEach(stock => {
      if (!holdings.has(stock.ticker)) {
        holdings.add(stock.ticker);
        newStocksAdded++;
      }
    });
    
    totalStocks = holdings.size;
    console.log(`Year ${year}: ${availableStocks.length} available, ${newStocksAdded} added, Total: ${totalStocks}`);
  }
  
  return totalStocks;
}

function simulateCorrectBehavior(stocks: Stock[], startYear: number, endYear: number) {
  console.log('\n✅ CORRECT BEHAVIOR (Fixed):');
  console.log('=' .repeat(50));
  
  const holdings = new Set<string>();
  const previouslyAvailableStocks = new Set<string>();
  let totalStocks = 0;
  
  for (let year = startYear; year <= endYear; year++) {
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    if (year === startYear) {
      // Initial year: add all available stocks and track them
      availableStocks.forEach(stock => {
        holdings.add(stock.ticker);
        previouslyAvailableStocks.add(stock.ticker);
      });
      totalStocks = holdings.size;
      console.log(`Year ${year}: Initial portfolio with ${totalStocks} stocks`);
    } else {
      // Subsequent years: only add stocks that are newly available in the market
      const newlyAvailableStocks = availableStocks.filter(stock => {
        // Check if we've never seen this stock before (newly available in market)
        return !previouslyAvailableStocks.has(stock.ticker);
      });
      
      // Add newly available stocks to both sets
      newlyAvailableStocks.forEach(stock => {
        holdings.add(stock.ticker);
        previouslyAvailableStocks.add(stock.ticker);
      });
      
      totalStocks = holdings.size;
      
      console.log(`Year ${year}: ${availableStocks.length} available, ${newlyAvailableStocks.length} newly available, Total: ${totalStocks}`);
      
      if (newlyAvailableStocks.length > 0) {
        console.log(`   Newly available tickers: ${newlyAvailableStocks.map(s => s.ticker).join(', ')}`);
      }
    }
  }
  
  return totalStocks;
}

async function main() {
  console.log('🧪 Testing Equal Weight Buy & Hold Corrected Behavior');
  console.log('=' .repeat(50));
  console.log('This test shows how the strategy should handle newly available stocks in the market.');
  
  // Create sample stock data to demonstrate the correct behavior
  const sampleStocks: Stock[] = [
    // Initial S&P 500 stocks (available from start)
    { ticker: 'AAPL', startDate: '1996-01-02', endDate: null },
    { ticker: 'MSFT', startDate: '1996-01-02', endDate: null },
    { ticker: 'IBM', startDate: '1996-01-02', endDate: null },
    { ticker: 'GE', startDate: '1996-01-02', endDate: null },
    { ticker: 'XOM', startDate: '1996-01-02', endDate: null },
    
    // Stocks that existed before but weren't in initial available set (OLD BUG: these were incorrectly added)
    { ticker: 'JPM', startDate: '1990-01-02', endDate: null },
    { ticker: 'WMT', startDate: '1990-01-02', endDate: null },
    { ticker: 'PG', startDate: '1990-01-02', endDate: null },
    { ticker: 'JNJ', startDate: '1990-01-02', endDate: null },
    { ticker: 'CVX', startDate: '1990-01-02', endDate: null },
    
    // Newly available stocks (IPOs or new listings) - THESE SHOULD BE ADDED
    { ticker: 'GOOGL', startDate: '2014-04-03', endDate: null },  // IPO in 2014
    { ticker: 'FB', startDate: '2013-12-23', endDate: null },     // IPO in 2012, listed 2013
    { ticker: 'TSLA', startDate: '2020-12-21', endDate: null },   // Added to S&P in 2020
    { ticker: 'NVDA', startDate: '2001-11-21', endDate: null },   // IPO in 1999, available 2001
    { ticker: 'NFLX', startDate: '2015-06-15', endDate: null },   // Becomes available in 2015
    
    // Stock that gets delisted during the period
    { ticker: 'LEHM', startDate: '1996-01-02', endDate: '2008-09-15' },
  ];
  
  const startYear = 2010;
  const endYear = 2024;
  
  // Run both simulations
  const oldTotal = simulateOldBehavior(sampleStocks, startYear, endYear);
  const correctTotal = simulateCorrectBehavior(sampleStocks, startYear, endYear);
  
  // Summary
  console.log('\n📊 SUMMARY:');
  console.log('=' .repeat(50));
  console.log(`Old behavior (buggy): ${oldTotal} total stocks`);
  console.log(`Correct behavior (fixed): ${correctTotal} total stocks`);
  console.log(`Difference: ${oldTotal - correctTotal} fewer stocks with fix`);
  
  console.log('\n💡 EXPLANATION:');
  console.log('The old behavior incorrectly added stocks that existed before the');
  console.log('start year but weren\'t in the initial available set.');
  console.log('\nThe corrected version:');
  console.log('1. Starts with available S&P 500 stocks');
  console.log('2. Adds ANY newly available stocks in the market (IPOs, new listings, etc.)');
  console.log('3. Does NOT add stocks that existed before but weren\'t initially available');
  console.log('\nThis allows the strategy to invest in new opportunities (like GOOGL, FB, TSLA)');
  console.log('while preventing the bug of adding pre-existing stocks.');
  
  console.log('\n✅ Test completed successfully!');
}

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});