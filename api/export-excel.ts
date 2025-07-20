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
    console.log('Results received for Excel export:', {
      equalWeightBuyHold: results.equalWeightBuyHold?.finalValue,
      marketCapBuyHold: results.marketCapBuyHold?.finalValue,
      equalWeightRebalanced: results.equalWeightRebalanced?.finalValue,
      marketCapRebalanced: results.marketCapRebalanced?.finalValue,
      spyBenchmark: results.spyBenchmark?.finalValue
    });
    
    // Create a simple Excel export based on the results
    console.log('Creating Excel export from results data');
    
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

    // Tab 2: Analysis Summary - Key metrics in tabular format
    const summaryData = [
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
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Tab 3: Portfolio - Ticker list
    const portfolioData = [
      ['Portfolio Composition'],
      ['Ticker Symbol'],
      ...tickers.map((ticker: string) => [ticker])
    ];
    const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, portfolioSheet, 'Portfolio');

    // Helper function to create detailed strategy sheets
    const createStrategySheet = (strategyKey: string, strategyName: string) => {
      const data = results[strategyKey];
      if (!data) {
        return [['No data available for this strategy']];
      }

      const gain = data.finalValue - initialInvestment;
      const duration = endYear - startYear;

      return [
        [strategyName],
        [],
        ['Key Metrics'],
        ['Total Return', `${data.totalReturn.toFixed(2)}%`],
        ['Annualized Return', `${data.annualizedReturn.toFixed(2)}%`],
        ['Final Value', `$${Math.floor(data.finalValue).toLocaleString()}`],
        [],
        ['Investment Details'],
        ['Initial Investment', `$${initialInvestment.toLocaleString()}`],
        ['Investment Period', `${startYear} - ${endYear}`],
        ['Duration', `${duration} years`],
        ['Total Gain/Loss', `$${Math.floor(gain).toLocaleString()}`],
        ['Portfolio Tickers', tickers.join(', ')],
        [],
        ['Performance Analysis'],
        ['Investment Growth', `${((data.finalValue / initialInvestment) * 100).toFixed(1)}% of original value`],
        ['Average Annual Growth', `${data.annualizedReturn.toFixed(2)}% per year`],
        [],
        ['Note'],
        ['All calculations based on real market data from EODHD API'],
        ['Data includes stock splits and dividend adjustments']
      ];
    };

    // Individual Strategy Detail Sheets
    const eqwBuyHoldData = createStrategySheet('equalWeightBuyHold', 'Equal Weight Buy & Hold Strategy');
    const eqwBuyHoldSheet = XLSX.utils.aoa_to_sheet(eqwBuyHoldData);
    XLSX.utils.book_append_sheet(wb, eqwBuyHoldSheet, 'EQW Buy & Hold');

    const mcBuyHoldData = createStrategySheet('marketCapBuyHold', 'Market Cap Buy & Hold Strategy');
    const mcBuyHoldSheet = XLSX.utils.aoa_to_sheet(mcBuyHoldData);
    XLSX.utils.book_append_sheet(wb, mcBuyHoldSheet, 'MC Buy & Hold');

    const eqwRebalData = createStrategySheet('equalWeightRebalanced', 'Equal Weight Rebalanced Strategy');
    const eqwRebalSheet = XLSX.utils.aoa_to_sheet(eqwRebalData);
    XLSX.utils.book_append_sheet(wb, eqwRebalSheet, 'EQW Rebalanced');

    const mcRebalData = createStrategySheet('marketCapRebalanced', 'Market Cap Rebalanced Strategy');
    const mcRebalSheet = XLSX.utils.aoa_to_sheet(mcRebalData);
    XLSX.utils.book_append_sheet(wb, mcRebalSheet, 'MC Rebalanced');

    const spyData = createStrategySheet('spyBenchmark', 'SPY Benchmark');
    const spySheet = XLSX.utils.aoa_to_sheet(spyData);
    XLSX.utils.book_append_sheet(wb, spySheet, 'SPY Benchmark');

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