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
    const { results } = req.body;

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
    
    // Generate year range
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // Tab 1: Overview - Strategy comparison
    const overviewData = [
      ['Strategy', 'Start Value', 'End Value', 'Total Return', 'Annualized Return'],
      ['Market Cap Buy & Hold', `$${initialInvestment.toLocaleString()}`, `$${Math.floor(results.marketCapBuyHold?.finalValue || initialInvestment).toLocaleString()}`, `${(results.marketCapBuyHold?.totalReturn || 0).toFixed(2)}%`, `${(results.marketCapBuyHold?.annualizedReturn || 0).toFixed(2)}%`],
      ['Market Cap Rebalanced', `$${initialInvestment.toLocaleString()}`, `$${Math.floor(results.marketCapRebalanced?.finalValue || initialInvestment).toLocaleString()}`, `${(results.marketCapRebalanced?.totalReturn || 0).toFixed(2)}%`, `${(results.marketCapRebalanced?.annualizedReturn || 0).toFixed(2)}%`],
      ['SPY Benchmark', `$${initialInvestment.toLocaleString()}`, `$${Math.floor(results.spyBenchmark?.finalValue || initialInvestment).toLocaleString()}`, `${(results.spyBenchmark?.totalReturn || 0).toFixed(2)}%`, `${(results.spyBenchmark?.annualizedReturn || 0).toFixed(2)}%`],
      ['Equal Weight Buy & Hold', `$${initialInvestment.toLocaleString()}`, `$${Math.floor(results.equalWeightBuyHold?.finalValue || initialInvestment).toLocaleString()}`, `${(results.equalWeightBuyHold?.totalReturn || 0).toFixed(2)}%`, `${(results.equalWeightBuyHold?.annualizedReturn || 0).toFixed(2)}%`],
      ['Equal Weight Rebalanced', `$${initialInvestment.toLocaleString()}`, `$${Math.floor(results.equalWeightRebalanced?.finalValue || initialInvestment).toLocaleString()}`, `${(results.equalWeightRebalanced?.totalReturn || 0).toFixed(2)}%`, `${(results.equalWeightRebalanced?.annualizedReturn || 0).toFixed(2)}%`],
      [],
      ['Analysis Parameters'],
      ['Start Year', startYear],
      ['End Year', endYear],
      ['Initial Investment', `$${initialInvestment.toLocaleString()}`],
      ['Number of Stocks', tickers.length],
      ['Tickers', tickers.join(', ')]
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

    // Helper function to get all tickers and years from all strategies
    const getAllTickersAndYears = () => {
      const allTickers = new Set<string>();
      const allYears = new Set<number>();
      
      const strategies = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced', 'spyBenchmark'];
      
      strategies.forEach(strategyKey => {
        const data = results[strategyKey];
        if (data?.yearlyHoldings) {
          Object.keys(data.yearlyHoldings).forEach(year => {
            allYears.add(Number(year));
            Object.keys(data.yearlyHoldings[year] || {}).forEach(ticker => {
              allTickers.add(ticker);
            });
          });
        }
      });
      
      return {
        tickers: Array.from(allTickers).sort(),
        years: Array.from(allYears).sort()
      };
    };

    const { tickers: allTickers, years: allYears } = getAllTickersAndYears();

    // Holdings Tab 1: Price Data
    const createPriceSheet = () => {
      const priceData = [['Ticker', ...allYears]];
      
      allTickers.forEach(ticker => {
        const row = [ticker];
        allYears.forEach(year => {
          // Find price data from any strategy for this ticker/year
          let price = null;
          const strategies = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced', 'spyBenchmark'];
          
          for (const strategyKey of strategies) {
            const data = results[strategyKey];
            if (data?.yearlyHoldings?.[year]?.[ticker]?.price) {
              price = data.yearlyHoldings[year][ticker].price;
              break;
            }
          }
          
          row.push(price ? `$${price.toFixed(2)}` : '—');
        });
        priceData.push(row);
      });
      
      return priceData;
    };

    // Holdings Tab 2: Shares Outstanding Data
    const createSharesOutstandingSheet = () => {
      const sharesData = [['Ticker', ...allYears]];
      
      allTickers.forEach(ticker => {
        const row = [ticker];
        allYears.forEach(year => {
          // Find shares outstanding data from any strategy for this ticker/year
          let sharesOutstanding = null;
          const strategies = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced', 'spyBenchmark'];
          
          for (const strategyKey of strategies) {
            const data = results[strategyKey];
            if (data?.yearlyHoldings?.[year]?.[ticker]?.sharesOutstanding) {
              sharesOutstanding = data.yearlyHoldings[year][ticker].sharesOutstanding;
              break;
            }
          }
          
          row.push(sharesOutstanding ? `${(sharesOutstanding / 1000000).toFixed(0)}M` : '—');
        });
        sharesData.push(row);
      });
      
      return sharesData;
    };

    // Holdings Tab 3: Market Cap Data
    const createMarketCapSheet = () => {
      const marketCapData = [['Ticker', ...allYears]];
      
      allTickers.forEach(ticker => {
        const row = [ticker];
        allYears.forEach(year => {
          // Find market cap data from any strategy for this ticker/year
          let marketCap = null;
          const strategies = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced', 'spyBenchmark'];
          
          for (const strategyKey of strategies) {
            const data = results[strategyKey];
            if (data?.yearlyHoldings?.[year]?.[ticker]?.marketCap) {
              marketCap = data.yearlyHoldings[year][ticker].marketCap;
              break;
            }
          }
          
          row.push(marketCap ? `$${(marketCap / 1000000000).toFixed(1)}B` : '—');
        });
        marketCapData.push(row);
      });
      
      return marketCapData;
    };

    // Create holdings sheets
    const priceSheet = XLSX.utils.aoa_to_sheet(createPriceSheet());
    XLSX.utils.book_append_sheet(wb, priceSheet, 'Prices');

    const sharesOutstandingSheet = XLSX.utils.aoa_to_sheet(createSharesOutstandingSheet());
    XLSX.utils.book_append_sheet(wb, sharesOutstandingSheet, 'Shares Outstanding');

    const marketCapSheet = XLSX.utils.aoa_to_sheet(createMarketCapSheet());
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');

    // Strategy Sheets - Just position values by year
    const createStrategyValueSheet = (strategyKey: string) => {
      const data = results[strategyKey];
      if (!data?.yearlyHoldings) {
        return [['No data available for this strategy']];
      }

      const strategyYears = Object.keys(data.yearlyHoldings).map(Number).sort();
      const valueData = [['Ticker', ...strategyYears]];
      
      // Get all tickers for this strategy
      const strategyTickers = new Set<string>();
      strategyYears.forEach(year => {
        Object.keys(data.yearlyHoldings[year] || {}).forEach(ticker => {
          strategyTickers.add(ticker);
        });
      });
      
      Array.from(strategyTickers).sort().forEach(ticker => {
        const row = [ticker];
        strategyYears.forEach(year => {
          const holding = data.yearlyHoldings[year]?.[ticker];
          row.push(holding ? `$${Math.round(holding.value).toLocaleString()}` : '$0');
        });
        valueData.push(row);
      });
      
      return valueData;
    };

    // Create strategy sheets
    const strategies = [
      { key: 'equalWeightBuyHold', name: 'EQW Buy Hold' },
      { key: 'marketCapBuyHold', name: 'MC Buy Hold' },
      { key: 'equalWeightRebalanced', name: 'EQW Rebalanced' },
      { key: 'marketCapRebalanced', name: 'MC Rebalanced' },
      { key: 'spyBenchmark', name: 'SPY Benchmark' }
    ];

    strategies.forEach(strategy => {
      const strategyData = createStrategyValueSheet(strategy.key);
      const strategySheet = XLSX.utils.aoa_to_sheet(strategyData);
      XLSX.utils.book_append_sheet(wb, strategySheet, strategy.name);
    });

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"Portfolio Analysis Results-${new Date().toISOString().split('T')[0]}.xlsx\"`);
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