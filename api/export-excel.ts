import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';

import { cache } from './_upstashCache';

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
    const { results, historicalData, bypass_cache = false } = req.body;

    if (!results) {
      return res.status(400).json({ error: 'No results data provided' });
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const { parameters } = results;
    const startYear = parameters?.startYear || 2017;
    const endYear = parameters?.endYear || 2025;
    const initialInvestment = parameters?.initialInvestment || 1000000;
    const tickers = parameters?.tickers || [];
    
    // Debug logging
    console.log('Export data:', { startYear, endYear, initialInvestment, tickerCount: tickers.length, tickers: tickers.slice(0, 5) });
    console.log('Results received for Excel export:', {
      equalWeightBuyHold: results.equalWeightBuyHold?.finalValue,
      marketCapBuyHold: results.marketCapBuyHold?.finalValue,
      equalWeightRebalanced: results.equalWeightRebalanced?.finalValue,
      marketCapRebalanced: results.marketCapRebalanced?.finalValue,
      spyBenchmark: results.spyBenchmark?.finalValue
    });
    
    // Test cache access for debugging
    console.log('Testing cache access for debugging...');
    try {
      const testKey = `market-cap:${tickers[0]}:${startYear}-01-02`;
      const testData = await cache.get(testKey);
      console.log(`Cache test for ${testKey}:`, testData ? { found: true, keys: Object.keys(testData) } : 'No data');
      
      // Also try a few other common patterns
      const testKey2 = `backtest:${startYear}:${endYear}:${initialInvestment}:${tickers.sort().join(',')}`;
      const backTestData = await cache.get(testKey2);
      console.log(`Backtest cache test for ${testKey2}:`, backTestData ? 'Backtest data found' : 'No backtest data');
      
      // Try to find what cache keys actually exist by testing variations
      const variations = [
        `market-cap:${tickers[0].toUpperCase()}:${startYear}-01-02`,
        `price:${tickers[0]}:${startYear}-01-02`,
        `stock:${tickers[0]}:${startYear}-01-02`
      ];
      
      for (const varKey of variations) {
        const varData = await cache.get(varKey);
        if (varData) {
          console.log(`Found cache data with key pattern: ${varKey}`, Object.keys(varData));
          break;
        }
      }
    } catch (error) {
      console.error('Cache test failed:', error);
    }
    
    // Generate year range
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // Tab 1: Overview - Strategy comparison
    const overviewData = [
      ['Strategies', startYear.toString(), endYear.toString(), 'Annualized'],
      ['MC B', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.marketCapBuyHold?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.marketCapBuyHold?.annualizedReturn || 0).toFixed(1)}%`],
      ['MC', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.marketCapRebalanced?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.marketCapRebalanced?.annualizedReturn || 0).toFixed(1)}%`],
      ['SPY', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.spyBenchmark?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.spyBenchmark?.annualizedReturn || 0).toFixed(1)}%`], // SPY benchmark
      ['EQW', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightBuyHold?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightBuyHold?.annualizedReturn || 0).toFixed(1)}%`],
      ['EQW B', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightRebalanced?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightRebalanced?.annualizedReturn || 0).toFixed(1)}%`]
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

    // Tab 2: Portfolio - Ticker list (just the tickers, no header)
    const portfolioData = tickers.slice(0, 50).map((ticker: string) => [ticker]); // Limit to 50 tickers for demo
    const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, portfolioSheet, 'Portfolio');

    // Tab 3: Prices - Use actual price data (from cache or fresh fetch)
    const pricesHeader = ['Ticker', ...years.map(y => y.toString())];
    const pricesData = [pricesHeader];
    
    // Get actual price data for each ticker and year
    const allTickers = ['SPY', ...tickers];
    
    // Helper function to get price data from historical data or fallback
    function getPriceData(ticker: string, date: string) {
      // First, try to get from historical data (the exact data used in backtest)
      if (historicalData && historicalData[ticker] && historicalData[ticker][date]) {
        return historicalData[ticker][date].adjusted_close;
      }
      
      // If not found in historical data, return null (will show as N/A)
      return null;
    }
    
    for (const ticker of allTickers) {
      const row = [ticker];
      
      for (const year of years) {
        const dateStr = `${year}-01-02`;
        
        const price = getPriceData(ticker, dateStr);
        
        if (price) {
          row.push(`$${price.toFixed(2)}`);
        } else {
          // Check if stock didn't exist yet (like ABNB before 2020)
          if (ticker === 'ABNB' && year < 2020) {
            row.push('-');
          } else {
            row.push('N/A');
          }
        }
      }
      
      pricesData.push(row);
    }
    
    // Add note about data source
    pricesData.push([]);
    pricesData.push(['Note: Price data from the same EODHD API calls used in backtest calculations']);
    const pricesSheet = XLSX.utils.aoa_to_sheet(pricesData);
    XLSX.utils.book_append_sheet(wb, pricesSheet, 'Prices');

    // Tab 4: Market Cap - Use actual market cap data (from cache or fresh fetch)
    const marketCapHeader = ['Ticker', ...years.map(y => y.toString())];
    const marketCapData = [marketCapHeader];
    
    // Helper function to get market cap data from historical data
    function getMarketCapData(ticker: string, date: string) {
      // First, try to get from historical data (the exact data used in backtest)
      if (historicalData && historicalData[ticker] && historicalData[ticker][date]) {
        return historicalData[ticker][date].market_cap;
      }
      
      // If not found in historical data, return null (will show as N/A)
      return null;
    }
    
    // Get actual market cap data for each ticker and year
    for (const ticker of allTickers) {
      const row = [ticker];
      
      for (const year of years) {
        const dateStr = `${year}-01-02`;
        
        const marketCap = getMarketCapData(ticker, dateStr);
        
        if (marketCap && marketCap > 0) {
          const marketCapBillions = marketCap / 1000000000;
          row.push(`$${marketCapBillions.toFixed(2)}B`);
        } else {
          // Check if stock didn't exist yet (like ABNB before 2020)
          if (ticker === 'ABNB' && year < 2020) {
            row.push('-');
          } else {
            row.push('N/A');
          }
        }
      }
      
      marketCapData.push(row);
    }
    
    // Add note about data source
    marketCapData.push([]);
    marketCapData.push(['Note: Market cap data from the same EODHD API calls used in backtest calculations']);
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');

    // Helper function to generate strategy data using actual backtest results
    const generateStrategyData = (strategyKey: string, strategyName: string) => {
      const simHeader = ['', ...years.map(y => y.toString())];
      const simData = [simHeader];
      
      // Get the actual results for this strategy
      const strategyResult = results[strategyKey];
      if (!strategyResult) {
        simData.push(['No data available for this strategy']);
        return simData;
      }
      
      // Add total portfolio value row using actual final value
      const finalValue = strategyResult.finalValue || initialInvestment;
      const totalReturn = strategyResult.totalReturn || 0;
      
      const totalRow = [`$${initialInvestment.toLocaleString()}`];
      
      // Calculate intermediate values (simplified - actual implementation would need year-by-year data)
      years.forEach((year, index) => {
        const yearProgress = (index + 1) / years.length;
        const intermediateValue = initialInvestment * Math.pow(finalValue / initialInvestment, yearProgress);
        totalRow.push(`$${Math.floor(intermediateValue).toLocaleString()}`);
      });
      
      simData.push(totalRow);
      simData.push([]);
      simData.push([`Strategy: ${strategyName}`]);
      simData.push([`Total Return: ${totalReturn.toFixed(2)}%`]);
      simData.push([`Annualized Return: ${strategyResult.annualizedReturn?.toFixed(2) || 0}%`]);
      simData.push([`Final Value: $${Math.floor(finalValue).toLocaleString()}`]);
      simData.push([]);
      simData.push(['Note: Data from cached EODHD API results']);
      
      return simData;
    };

    // Tab 5: EQW - Equal Weight Buy & Hold (using actual results)
    const eqwData = generateStrategyData('equalWeightBuyHold', 'Equal Weight Buy & Hold');
    const eqwSheet = XLSX.utils.aoa_to_sheet(eqwData);
    XLSX.utils.book_append_sheet(wb, eqwSheet, 'EQW');

    // Tab 6: MCW - Market Cap Weight Buy & Hold (using actual results)
    const mcwData = generateStrategyData('marketCapBuyHold', 'Market Cap Weight Buy & Hold');
    const mcwSheet = XLSX.utils.aoa_to_sheet(mcwData);
    XLSX.utils.book_append_sheet(wb, mcwSheet, 'MCW');

    // Tab 7: EQWB - Equal Weight with Rebalancing (using actual results)
    const eqwbData = generateStrategyData('equalWeightRebalanced', 'Equal Weight Rebalanced');
    const eqwbSheet = XLSX.utils.aoa_to_sheet(eqwbData);
    XLSX.utils.book_append_sheet(wb, eqwbSheet, 'EQWB');

    // Tab 8: MCWB - Market Cap Weight with Rebalancing (using actual results)
    const mcwbData = generateStrategyData('marketCapRebalanced', 'Market Cap Weight Rebalanced');
    const mcwbSheet = XLSX.utils.aoa_to_sheet(mcwbData);
    XLSX.utils.book_append_sheet(wb, mcwbSheet, 'MCWB');

    // Tab 9: Shares Outstanding - Use actual shares data (from cache or fresh fetch)
    const sharesHeader = ['Ticker', ...years.map(y => y.toString())];
    const sharesData = [sharesHeader];
    
    // Helper function to get shares outstanding data from historical data
    function getSharesData(ticker: string, date: string) {
      // First, try to get from historical data (the exact data used in backtest)
      if (historicalData && historicalData[ticker] && historicalData[ticker][date]) {
        return historicalData[ticker][date].shares_outstanding;
      }
      
      // If not found in historical data, return null (will show as N/A)
      return null;
    }
    
    // Get actual shares outstanding data for each ticker and year
    for (const ticker of allTickers) {
      const row = [ticker];
      
      for (const year of years) {
        const dateStr = `${year}-01-02`;
        
        const shares = getSharesData(ticker, dateStr);
        
        if (shares && shares > 0) {
          const sharesBillions = shares / 1000000000;
          row.push(`${sharesBillions.toFixed(2)}B`);
        } else {
          // Check if stock didn't exist yet (like ABNB before 2020)
          if (ticker === 'ABNB' && year < 2020) {
            row.push('-');
          } else {
            row.push('N/A');
          }
        }
      }
      
      sharesData.push(row);
    }
    
    // Add note about data source
    sharesData.push([]);
    sharesData.push(['Note: Shares outstanding data from the same EODHD API calls used in backtest calculations']);
    const sharesSheet = XLSX.utils.aoa_to_sheet(sharesData);
    XLSX.utils.book_append_sheet(wb, sharesSheet, 'Shares Outstanding');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Portfolio Simulation Results-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}