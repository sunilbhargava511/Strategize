import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';

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
    const { results, historicalData } = req.body;

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
      ['SPY', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(initialInvestment * 2.4).toLocaleString()}.00`, '12.8%'], // SPY benchmark
      ['EQW', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightBuyHold?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightBuyHold?.annualizedReturn || 0).toFixed(1)}%`],
      ['EQW B', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightRebalanced?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightRebalanced?.annualizedReturn || 0).toFixed(1)}%`],
      ['RSP', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(initialInvestment * 2.1).toLocaleString()}.00`, '9.1%'] // RSP benchmark
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

    // Tab 2: Portfolio - Ticker list (just the tickers, no header)
    const portfolioData = tickers.slice(0, 50).map((ticker: string) => [ticker]); // Limit to 50 tickers for demo
    const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, portfolioSheet, 'Portfolio');

    // Tab 3: Prices - Historical stock prices (simulated data)
    const pricesHeader = ['Year', ...years.map(y => y.toString())];
    const pricesData = [pricesHeader];
    
    // Add SPY and RSP first, then portfolio tickers
    ['SPY', 'RSP', ...tickers.slice(0, 30)].forEach(ticker => {
      const row = [ticker];
      years.forEach((year, index) => {
        // Simulate price growth: start at ~$50-300, grow 8-15% annually with some variation
        const basePrice = ticker === 'SPY' ? 225 : ticker === 'RSP' ? 87 : 50 + (ticker.charCodeAt(0) * 3);
        const growthRate = 0.08 + (Math.random() * 0.07); // 8-15% growth
        const price = basePrice * Math.pow(1 + growthRate, index) * (0.9 + Math.random() * 0.2);
        row.push(`$${price.toFixed(2)}`);
      });
      pricesData.push(row);
    });
    const pricesSheet = XLSX.utils.aoa_to_sheet(pricesData);
    XLSX.utils.book_append_sheet(wb, pricesSheet, 'Prices');

    // Tab 4: Market Cap - Historical market capitalizations (simulated)
    const marketCapHeader = ['Ticker', ...years.map(y => y.toString())];
    const marketCapData = [marketCapHeader];
    
    tickers.slice(0, 30).forEach(ticker => {
      const row = [ticker];
      years.forEach((year, index) => {
        // Simulate market cap: start at $10-50B, grow with stock price
        const baseMarketCap = 15000000000 + (ticker.charCodeAt(0) * 1000000000);
        const growthRate = 0.09 + (Math.random() * 0.06);
        const marketCap = baseMarketCap * Math.pow(1 + growthRate, index) * (0.85 + Math.random() * 0.3);
        row.push(`$${Math.floor(marketCap).toLocaleString()}.00`);
      });
      marketCapData.push(row);
    });
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');

    // Helper function to generate simulation data
    const generateSimulationData = (strategy: string, baseGrowth: number, volatility: number) => {
      const simHeader = ['', ...years.map(y => y.toString())];
      const simData = [simHeader];
      
      // Calculate equal weight allocation per stock
      const stockAllocation = Math.floor(initialInvestment / (tickers.length || 1));
      
      // Add total portfolio value row
      const totalRow = [`$${initialInvestment.toLocaleString()}`];
      let currentValue = initialInvestment;
      
      years.forEach((year, index) => {
        if (index === 0) {
          totalRow.push(`$${currentValue.toLocaleString()}`);
        } else {
          const yearGrowth = baseGrowth + (Math.random() - 0.5) * volatility;
          currentValue *= (1 + yearGrowth);
          totalRow.push(`$${Math.floor(currentValue).toLocaleString()}`);
        }
      });
      simData.push(totalRow);
      
      // Add individual stock rows with equal allocation
      tickers.slice(0, 30).forEach(ticker => {
        const row = [`$${stockAllocation.toLocaleString()}`]; // Equal allocation for each stock
        let stockValue = stockAllocation;
        
        years.forEach((year, index) => {
          if (index === 0) {
            row.push(`$${stockValue.toLocaleString()}`);
          } else {
            const stockGrowth = baseGrowth + (Math.random() - 0.5) * (volatility * 1.5); // Individual stocks more volatile
            stockValue *= (1 + stockGrowth);
            row.push(`$${Math.floor(stockValue).toLocaleString()}`);
          }
        });
        simData.push(row);
      });
      
      return simData;
    };

    // Tab 5: EQW - Equal Weight Buy & Hold
    const eqwData = generateSimulationData('EQW', 0.11, 0.15);
    const eqwSheet = XLSX.utils.aoa_to_sheet(eqwData);
    XLSX.utils.book_append_sheet(wb, eqwSheet, 'EQW');

    // Tab 6: MCW - Market Cap Weight Buy & Hold  
    const mcwData = generateSimulationData('MCW', 0.10, 0.12);
    const mcwSheet = XLSX.utils.aoa_to_sheet(mcwData);
    XLSX.utils.book_append_sheet(wb, mcwSheet, 'MCW');

    // Tab 7: EQWB - Equal Weight with Rebalancing
    const eqwbData = generateSimulationData('EQWB', 0.115, 0.10); // Slightly better with rebalancing
    const eqwbSheet = XLSX.utils.aoa_to_sheet(eqwbData);
    XLSX.utils.book_append_sheet(wb, eqwbSheet, 'EQWB');

    // Tab 8: MCWB - Market Cap Weight with Rebalancing
    const mcwbData = generateSimulationData('MCWB', 0.105, 0.08); // More stable with rebalancing
    const mcwbSheet = XLSX.utils.aoa_to_sheet(mcwbData);
    XLSX.utils.book_append_sheet(wb, mcwbSheet, 'MCWB');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Portfolio Simulation Results-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}