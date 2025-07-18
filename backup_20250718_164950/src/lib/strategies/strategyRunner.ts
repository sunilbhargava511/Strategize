import { BacktestConfig, StrategyResult, PriceData, SPYData, Stock } from '../../types/backtesting';
import { runEqualWeightBuyHold } from './equalWeightBuyHold';
import { runMarketCapBuyHold } from './marketCapBuyHold';
import { runEqualWeightRebalanced } from './equalWeightRebalanced';
import { runMarketCapRebalanced } from './marketCapRebalanced';
import { calculateTotalReturn, calculateAnnualizedReturn } from '../utils/portfolioUtils';
import { getStartOfYearDate, getYearsBetweenDates } from '../utils/dateUtils';

/**
 * Main strategy runner for portfolio backtesting
 * Orchestrates all four strategies and benchmarks against SPY
 */

export interface BacktestResults {
  strategies: StrategyResult[];
  spyBenchmark: {
    startValue: number;
    endValue: number;
    totalReturn: number;
    annualizedReturn: number;
    data: SPYData[];
  };
  summary: {
    bestStrategy: string;
    worstStrategy: string;
    spyOutperformers: string[];
    executionTime: number;
  };
}

/**
 * Run all backtesting strategies
 */
export async function runAllStrategies(
  config: BacktestConfig,
  priceDataFetcher: (ticker: string, date: string) => Promise<PriceData | null>,
  spyDataFetcher: (startYear: number, endYear: number) => Promise<SPYData[]>
): Promise<BacktestResults> {
  console.log('🚀 Starting comprehensive portfolio backtest...');
  console.log(`📅 Period: ${config.startYear} - ${config.endYear}`);
  console.log(`💰 Initial Investment: $${config.initialInvestment.toLocaleString()}`);
  console.log(`📊 Total Stocks: ${config.stocks.length}`);
  
  const startTime = Date.now();
  const results: StrategyResult[] = [];

  // Get SPY benchmark data
  console.log('\n📈 Fetching SPY benchmark data...');
  const spyData = await spyDataFetcher(config.startYear, config.endYear);
  
  // Calculate SPY benchmark performance
  const spyBenchmark = calculateSPYBenchmark(spyData, config.startYear, config.endYear, config.initialInvestment);
  console.log(`📊 SPY Benchmark Return: ${(spyBenchmark.totalReturn * 100).toFixed(2)}%`);

  // Define which strategies to run
  const strategiesToRun = [
    { name: 'Equal Weight Buy & Hold', enabled: config.strategies.includes('equalWeightBuyHold') },
    { name: 'Market Cap Weighted Buy & Hold', enabled: config.strategies.includes('marketCapBuyHold') },
    { name: 'Equal Weight Rebalanced Annually', enabled: config.strategies.includes('equalWeightRebalanced') },
    { name: 'Market Cap Weighted Rebalanced Annually', enabled: config.strategies.includes('marketCapRebalanced') }
  ];

  const enabledStrategies = strategiesToRun.filter(s => s.enabled);
  console.log(`\n🎯 Running ${enabledStrategies.length} strategies...`);

  // Run Equal Weight Buy & Hold
  if (config.strategies.includes('equalWeightBuyHold')) {
    console.log('\n🔄 Running Strategy 1/4: Equal Weight Buy & Hold');
    try {
      const result = await runEqualWeightBuyHold(
        config.stocks,
        config.startYear,
        config.endYear,
        config.initialInvestment,
        priceDataFetcher
      );
      results.push(result);
      console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Equal Weight Buy & Hold failed:', error);
    }
  }

  // Run Market Cap Weighted Buy & Hold
  if (config.strategies.includes('marketCapBuyHold')) {
    console.log('\n🔄 Running Strategy 2/4: Market Cap Weighted Buy & Hold');
    try {
      const result = await runMarketCapBuyHold(
        config.stocks,
        config.startYear,
        config.endYear,
        config.initialInvestment,
        priceDataFetcher
      );
      results.push(result);
      console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Market Cap Weighted Buy & Hold failed:', error);
    }
  }

  // Run Equal Weight Rebalanced
  if (config.strategies.includes('equalWeightRebalanced')) {
    console.log('\n🔄 Running Strategy 3/4: Equal Weight Rebalanced Annually');
    try {
      const result = await runEqualWeightRebalanced(
        config.stocks,
        config.startYear,
        config.endYear,
        config.initialInvestment,
        priceDataFetcher
      );
      results.push(result);
      console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Equal Weight Rebalanced failed:', error);
    }
  }

  // Run Market Cap Weighted Rebalanced
  if (config.strategies.includes('marketCapRebalanced')) {
    console.log('\n🔄 Running Strategy 4/4: Market Cap Weighted Rebalanced Annually');
    try {
      const result = await runMarketCapRebalanced(
        config.stocks,
        config.startYear,
        config.endYear,
        config.initialInvestment,
        priceDataFetcher
      );
      results.push(result);
      console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
    } catch (error) {
      console.error('❌ Market Cap Weighted Rebalanced failed:', error);
    }
  }

  // Calculate summary statistics
  const executionTime = Date.now() - startTime;
  const summary = calculateSummary(results, spyBenchmark, executionTime);

  console.log('\n🎉 Backtest Complete!');
  console.log('='.repeat(50));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  // Display results table
  console.log('\nStrategy Performance:');
  console.log('Strategy'.padEnd(35) + 'Total Return'.padEnd(15) + 'Annual Return'.padEnd(15) + 'Final Value');
  console.log('-'.repeat(80));
  
  results.forEach(result => {
    const totalRet = `${(result.totalReturn * 100).toFixed(2)}%`;
    const annualRet = `${(result.annualizedReturn * 100).toFixed(2)}%`;
    const finalVal = `$${result.endValue.toLocaleString()}`;
    
    console.log(
      result.strategy.padEnd(35) + 
      totalRet.padEnd(15) + 
      annualRet.padEnd(15) + 
      finalVal
    );
  });
  
  // SPY Benchmark
  const spyTotalRet = `${(spyBenchmark.totalReturn * 100).toFixed(2)}%`;
  const spyAnnualRet = `${(spyBenchmark.annualizedReturn * 100).toFixed(2)}%`;
  const spyFinalVal = `$${spyBenchmark.endValue.toLocaleString()}`;
  
  console.log('-'.repeat(80));
  console.log(
    'SPY Benchmark'.padEnd(35) + 
    spyTotalRet.padEnd(15) + 
    spyAnnualRet.padEnd(15) + 
    spyFinalVal
  );

  console.log(`\n🏆 Best Strategy: ${summary.bestStrategy}`);
  console.log(`📉 Worst Strategy: ${summary.worstStrategy}`);
  console.log(`🎯 Strategies beating SPY: ${summary.spyOutperformers.length > 0 ? summary.spyOutperformers.join(', ') : 'None'}`);
  console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(1)} seconds`);

  return {
    strategies: results,
    spyBenchmark,
    summary
  };
}

/**
 * Calculate SPY benchmark performance
 */
function calculateSPYBenchmark(
  spyData: SPYData[], 
  startYear: number, 
  endYear: number, 
  initialInvestment: number
): {
  startValue: number;
  endValue: number;
  totalReturn: number;
  annualizedReturn: number;
  data: SPYData[];
} {
  if (spyData.length === 0) {
    throw new Error('No SPY data available for benchmark');
  }

  // Find start and end data points
  const startDate = getStartOfYearDate(startYear);
  const endDate = getStartOfYearDate(endYear);
  
  const startPoint = spyData.find(d => d.date >= startDate) || spyData[0];
  const endPoint = spyData[spyData.length - 1];

  // Calculate SPY returns
  const sharesOwned = initialInvestment / startPoint.adjustedPrice;
  const endValue = sharesOwned * endPoint.adjustedPrice;
  const totalReturn = calculateTotalReturn(initialInvestment, endValue);
  
  const years = getYearsBetweenDates(startPoint.date, endPoint.date);
  const annualizedReturn = calculateAnnualizedReturn(initialInvestment, endValue, years);

  return {
    startValue: initialInvestment,
    endValue,
    totalReturn,
    annualizedReturn,
    data: spyData
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  results: StrategyResult[], 
  spyBenchmark: any, 
  executionTime: number
): {
  bestStrategy: string;
  worstStrategy: string;
  spyOutperformers: string[];
  executionTime: number;
} {
  if (results.length === 0) {
    return {
      bestStrategy: 'None',
      worstStrategy: 'None',
      spyOutperformers: [],
      executionTime
    };
  }

  // Find best and worst strategies
  const bestStrategy = results.reduce((best, current) => 
    current.endValue > best.endValue ? current : best
  );
  
  const worstStrategy = results.reduce((worst, current) => 
    current.endValue < worst.endValue ? current : worst
  );

  // Find strategies that beat SPY
  const spyOutperformers = results
    .filter(result => result.endValue > spyBenchmark.endValue)
    .map(result => result.strategy);

  return {
    bestStrategy: bestStrategy.strategy,
    worstStrategy: worstStrategy.strategy,
    spyOutperformers,
    executionTime
  };
}

/**
 * Validate backtest configuration
 */
export function validateBacktestConfig(config: BacktestConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.stocks || config.stocks.length === 0) {
    errors.push('No stocks provided in configuration');
  }

  if (config.startYear >= config.endYear) {
    errors.push('Start year must be before end year');
  }

  if (config.startYear < 1996 || config.endYear > 2025) {
    errors.push('Years must be between 1996 and 2025');
  }

  if (config.initialInvestment <= 0) {
    errors.push('Initial investment must be positive');
  }

  if (!config.strategies || config.strategies.length === 0) {
    errors.push('No strategies selected');
  }

  const validStrategies = [
    'equalWeightBuyHold',
    'marketCapBuyHold', 
    'equalWeightRebalanced',
    'marketCapRebalanced'
  ];

  const invalidStrategies = config.strategies.filter(s => !validStrategies.includes(s));
  if (invalidStrategies.length > 0) {
    errors.push(`Invalid strategies: ${invalidStrategies.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get list of available strategies
 */
export function getAvailableStrategies(): Array<{ id: string; name: string; description: string }> {
  return [
    {
      id: 'equalWeightBuyHold',
      name: 'Equal Weight Buy & Hold',
      description: 'Start with equal weights, add new stocks proportionally, no rebalancing'
    },
    {
      id: 'marketCapBuyHold',
      name: 'Market Cap Weighted Buy & Hold', 
      description: 'Start with market cap weights, add new stocks by market cap, no rebalancing'
    },
    {
      id: 'equalWeightRebalanced',
      name: 'Equal Weight Rebalanced Annually',
      description: 'Rebalance to equal weights across all stocks each year'
    },
    {
      id: 'marketCapRebalanced',
      name: 'Market Cap Weighted Rebalanced Annually',
      description: 'Rebalance to market cap weights across all stocks each year'
    }
  ];
}

/**
 * Create backtest configuration from user inputs
 */
export function createBacktestConfig(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number = 1000000,
  strategies: string[] = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced']
): BacktestConfig {
  return {
    stocks,
    startYear,
    endYear,
    initialInvestment,
    strategies
  };
}

/**
 * Format results for display
 */
export function formatResults(results: BacktestResults): string {
  let output = 'Portfolio Backtesting Results\n';
  output += '='.repeat(50) + '\n\n';
  
  results.strategies.forEach(strategy => {
    output += `${strategy.strategy}:\n`;
    output += `  Final Value: $${strategy.endValue.toLocaleString()}\n`;
    output += `  Total Return: ${(strategy.totalReturn * 100).toFixed(2)}%\n`;
    output += `  Annualized Return: ${(strategy.annualizedReturn * 100).toFixed(2)}%\n\n`;
  });
  
  output += `SPY Benchmark:\n`;
  output += `  Final Value: $${results.spyBenchmark.endValue.toLocaleString()}\n`;
  output += `  Total Return: ${(results.spyBenchmark.totalReturn * 100).toFixed(2)}%\n`;
  output += `  Annualized Return: ${(results.spyBenchmark.annualizedReturn * 100).toFixed(2)}%\n\n`;
  
  output += `Best Strategy: ${results.summary.bestStrategy}\n`;
  output += `Strategies beating SPY: ${results.summary.spyOutperformers.join(', ')}\n`;
  
  return output;
}