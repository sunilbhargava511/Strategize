import * as XLSX from 'xlsx';
import { StrategyResult, PortfolioSnapshot, SPYData } from '../../types/backtesting';
import { formatCurrency, formatPercentage } from './portfolioUtils';

/**
 * Excel export utilities for backtesting results
 */

export interface ExcelExportData {
  strategies: StrategyResult[];
  spyData: SPYData[];
  startYear: number;
  endYear: number;
  initialInvestment: number;
}

/**
 * Generate Excel workbook with all backtesting results
 */
export function generateBacktestExcel(data: ExcelExportData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // 1. Summary Sheet
  addSummarySheet(workbook, data);

  // 2. Year-by-Year Performance Sheet
  addPerformanceSheet(workbook, data);

  // 3. Individual strategy sheets
  data.strategies.forEach(strategy => {
    addStrategySheet(workbook, strategy);
  });

  // 4. SPY Benchmark Sheet
  addSPYSheet(workbook, data.spyData, data.startYear, data.endYear);

  // 5. Holdings Detail Sheets
  data.strategies.forEach(strategy => {
    addHoldingsDetailSheet(workbook, strategy);
  });

  return workbook;
}

/**
 * Add summary sheet with key metrics
 */
function addSummarySheet(workbook: XLSX.WorkBook, data: ExcelExportData): void {
  const summary = [];
  
  // Header
  summary.push(['Portfolio Backtesting Results Summary']);
  summary.push([]);
  summary.push(['Investment Period', `${data.startYear} - ${data.endYear}`]);
  summary.push(['Initial Investment', formatCurrency(data.initialInvestment)]);
  summary.push([]);
  
  // Strategy comparison table
  summary.push(['Strategy', 'Final Value', 'Total Return', 'Annualized Return']);
  
  data.strategies.forEach(strategy => {
    summary.push([
      strategy.strategy,
      formatCurrency(strategy.endValue),
      formatPercentage(strategy.totalReturn),
      formatPercentage(strategy.annualizedReturn)
    ]);
  });

  // SPY comparison
  const spyStart = data.spyData.find(d => d.date.startsWith(data.startYear.toString()));
  const spyEnd = data.spyData[data.spyData.length - 1];
  
  if (spyStart && spyEnd) {
    const spyShares = data.initialInvestment / spyStart.adjustedPrice;
    const spyFinalValue = spyShares * spyEnd.adjustedPrice;
    const spyTotalReturn = (spyFinalValue - data.initialInvestment) / data.initialInvestment;
    const years = data.endYear - data.startYear;
    const spyAnnualizedReturn = Math.pow(spyFinalValue / data.initialInvestment, 1 / years) - 1;
    
    summary.push([
      'SPY Benchmark',
      formatCurrency(spyFinalValue),
      formatPercentage(spyTotalReturn),
      formatPercentage(spyAnnualizedReturn)
    ]);
  }

  summary.push([]);
  summary.push(['Best Performing Strategy']);
  const bestStrategy = data.strategies.reduce((best, current) => 
    current.endValue > best.endValue ? current : best
  );
  summary.push(['Strategy', bestStrategy.strategy]);
  summary.push(['Final Value', formatCurrency(bestStrategy.endValue)]);
  summary.push(['Outperformed Initial by', formatPercentage(bestStrategy.totalReturn)]);

  const worksheet = XLSX.utils.aoa_to_sheet(summary);
  
  // Styling
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!worksheet[address]) continue;
    worksheet[address].s = {
      font: { bold: true, sz: 14 },
      fill: { fgColor: { rgb: "366092" } }
    };
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary');
}

/**
 * Add year-by-year performance comparison sheet
 */
function addPerformanceSheet(workbook: XLSX.WorkBook, data: ExcelExportData): void {
  const performance = [];
  
  // Headers
  const headers = ['Year'];
  data.strategies.forEach(strategy => {
    headers.push(`${strategy.strategy} Value`);
  });
  headers.push('SPY Value');
  performance.push(headers);

  // Get all years
  const years = Array.from(new Set(
    data.strategies.flatMap(s => s.yearlySnapshots.map(snap => 
      new Date(snap.date).getFullYear()
    ))
  )).sort();

  // Add data for each year
  years.forEach(year => {
    const row = [year.toString()];
    
    data.strategies.forEach(strategy => {
      const snapshot = strategy.yearlySnapshots.find(snap => 
        new Date(snap.date).getFullYear() === year
      );
      row.push(snapshot ? snapshot.totalValue : 0);
    });

    // Add SPY value for this year
    const spyData = data.spyData.find(d => d.date.startsWith(year.toString()));
    const spyStart = data.spyData.find(d => d.date.startsWith(data.startYear.toString()));
    if (spyData && spyStart) {
      const spyShares = data.initialInvestment / spyStart.adjustedPrice;
      const spyValue = spyShares * spyData.adjustedPrice;
      row.push(spyValue);
    } else {
      row.push(0);
    }
    
    performance.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(performance);
  
  // Format as table
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Year-by-Year Performance');
}

/**
 * Add individual strategy detail sheet
 */
function addStrategySheet(workbook: XLSX.WorkBook, strategy: StrategyResult): void {
  const data = [];
  
  // Strategy overview
  data.push([`${strategy.strategy} - Detailed Results`]);
  data.push([]);
  data.push(['Start Value', formatCurrency(strategy.startValue)]);
  data.push(['End Value', formatCurrency(strategy.endValue)]);
  data.push(['Total Return', formatPercentage(strategy.totalReturn)]);
  data.push(['Annualized Return', formatPercentage(strategy.annualizedReturn)]);
  data.push([]);
  
  // Yearly snapshots
  data.push(['Date', 'Total Value', 'Cash', 'Number of Holdings', 'Largest Holding', 'Largest Weight']);
  
  strategy.yearlySnapshots.forEach(snapshot => {
    const largestHolding = snapshot.holdings.reduce((largest, holding) => 
      holding.value > largest.value ? holding : largest, snapshot.holdings[0] || { ticker: 'N/A', value: 0, weight: 0 }
    );
    
    data.push([
      snapshot.date,
      snapshot.totalValue,
      snapshot.cash,
      snapshot.holdings.length,
      largestHolding.ticker,
      formatPercentage(largestHolding.weight)
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // Shorten sheet name to avoid Excel limits
  const sheetName = strategy.strategy.substring(0, 30);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Add SPY benchmark data sheet
 */
function addSPYSheet(workbook: XLSX.WorkBook, spyData: SPYData[], startYear: number, endYear: number): void {
  const data = [];
  
  data.push(['SPY Benchmark Data']);
  data.push([]);
  data.push(['Date', 'Price', 'Adjusted Price']);
  
  // Filter SPY data for the relevant time period
  const relevantData = spyData.filter(d => {
    const year = new Date(d.date).getFullYear();
    return year >= startYear && year <= endYear;
  });
  
  relevantData.forEach(spy => {
    data.push([spy.date, spy.price, spy.adjustedPrice]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SPY Benchmark');
}

/**
 * Add holdings detail sheet for each strategy
 */
function addHoldingsDetailSheet(workbook: XLSX.WorkBook, strategy: StrategyResult): void {
  const data = [];
  
  data.push([`${strategy.strategy} - Holdings Detail`]);
  data.push([]);
  
  strategy.yearlySnapshots.forEach(snapshot => {
    data.push([`Holdings as of ${snapshot.date}`]);
    data.push(['Ticker', 'Shares', 'Value', 'Weight']);
    
    // Sort holdings by value (descending)
    const sortedHoldings = [...snapshot.holdings].sort((a, b) => b.value - a.value);
    
    sortedHoldings.forEach(holding => {
      data.push([
        holding.ticker,
        holding.shares,
        holding.value,
        formatPercentage(holding.weight)
      ]);
    });
    
    data.push(['Total Value', '', snapshot.totalValue, '100.00%']);
    data.push(['Cash', '', snapshot.cash, formatPercentage(snapshot.cash / snapshot.totalValue)]);
    data.push([]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  const sheetName = `${strategy.strategy.substring(0, 25)} Holdings`;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

/**
 * Export workbook to buffer for API response
 */
export function exportToBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate filename for export
 */
export function generateFilename(startYear: number, endYear: number): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `portfolio_backtest_${startYear}_${endYear}_${timestamp}.xlsx`;
}

/**
 * Create a simple CSV export for quick analysis
 */
export function exportToCSV(strategies: StrategyResult[]): string {
  const csvRows = [];
  
  // Header
  csvRows.push(['Strategy', 'Start Value', 'End Value', 'Total Return', 'Annualized Return'].join(','));
  
  // Data rows
  strategies.forEach(strategy => {
    csvRows.push([
      strategy.strategy,
      strategy.startValue,
      strategy.endValue,
      strategy.totalReturn,
      strategy.annualizedReturn
    ].join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * Validate Excel export data
 */
export function validateExportData(data: ExcelExportData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.strategies || data.strategies.length === 0) {
    errors.push('No strategy results provided');
  }
  
  if (!data.spyData || data.spyData.length === 0) {
    errors.push('No SPY benchmark data provided');
  }
  
  if (data.startYear >= data.endYear) {
    errors.push('Start year must be before end year');
  }
  
  if (data.initialInvestment <= 0) {
    errors.push('Initial investment must be positive');
  }
  
  data.strategies?.forEach((strategy, index) => {
    if (!strategy.yearlySnapshots || strategy.yearlySnapshots.length === 0) {
      errors.push(`Strategy ${index + 1} has no yearly snapshots`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}