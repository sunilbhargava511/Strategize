// Portfolio Backtesting Types

/**
 * Individual stock with entry/exit dates
 */
export interface Stock {
  ticker: string;
  startDate: string;  // Date when stock joined the index
  endDate: string | null;  // Date when stock left the index (null if still active)
}

/**
 * Price and market cap data for a stock on a specific date
 */
export interface PriceData {
  ticker: string;
  date: string;
  price: number;  // Raw price
  adjustedPrice: number;  // Split/dividend adjusted price
  sharesOutstanding: number;
  marketCap: number;  // Market capitalization in dollars
}

/**
 * Individual holding in a portfolio
 */
export interface PortfolioHolding {
  ticker: string;
  shares: number;  // Number of shares owned
  value: number;   // Current market value
  weight: number;  // Weight as percentage of total portfolio (0-1)
  marketCap?: number;  // Optional market cap for sorting/analysis
}

/**
 * Portfolio snapshot at a specific point in time
 */
export interface PortfolioSnapshot {
  date: string;
  totalValue: number;  // Total portfolio value
  holdings: PortfolioHolding[];  // All stock holdings
  cash: number;  // Cash position
}

/**
 * Results from running a single strategy
 */
export interface StrategyResult {
  strategy: string;  // Strategy name
  startValue: number;  // Initial portfolio value
  endValue: number;   // Final portfolio value
  totalReturn: number;  // Total return as decimal (0.15 = 15%)
  annualizedReturn: number;  // Annualized return as decimal
  yearlySnapshots: PortfolioSnapshot[];  // Portfolio state each year
}

/**
 * Configuration for a backtesting run
 */
export interface BacktestConfig {
  stocks: Stock[];  // Universe of stocks to consider
  startYear: number;  // Start year for backtesting
  endYear: number;    // End year for backtesting
  initialInvestment: number;  // Starting capital
  strategies: string[];  // List of strategy IDs to run
}

/**
 * Start-of-year trading dates lookup
 */
export interface StartOfYearDates {
  [year: string]: string;  // Year -> Date mapping
}

/**
 * SPY benchmark data point
 */
export interface SPYData {
  date: string;
  price: number;  // Raw SPY price
  adjustedPrice: number;  // Split/dividend adjusted price
}

/**
 * Complete backtesting results including all strategies and benchmark
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
    spyOutperformers: string[];  // Strategies that beat SPY
    executionTime: number;  // Milliseconds
  };
}

/**
 * Trade record for tracking transactions
 */
export interface Trade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
  date: string;
}

/**
 * Strategy configuration options
 */
export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters?: {
    [key: string]: any;
  };
}

/**
 * Progress tracking for long-running operations
 */
export interface ProgressUpdate {
  current: number;
  total: number;
  step: string;
  percentage?: number;
}

/**
 * Error tracking for failed operations
 */
export interface BacktestError {
  ticker?: string;
  date?: string;
  strategy?: string;
  error: string;
  timestamp: string;
}

/**
 * Market data fetcher function type
 */
export type PriceDataFetcher = (ticker: string, date: string) => Promise<PriceData | null>;

/**
 * SPY data fetcher function type
 */
export type SPYDataFetcher = (startYear: number, endYear: number) => Promise<SPYData[]>;

/**
 * Strategy runner function type
 */
export type StrategyRunner = (
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  priceDataFetcher: PriceDataFetcher
) => Promise<StrategyResult>;

/**
 * Rebalancing statistics
 */
export interface RebalancingStats {
  totalRebalances: number;
  averageStocksPerRebalance: number;
  maxStocksInPortfolio: number;
  minStocksInPortfolio: number;
}

/**
 * Concentration statistics for market cap weighted portfolios
 */
export interface ConcentrationStats {
  averageTop5Concentration: number;
  averageTop10Concentration: number;
  maxSingleStockWeight: number;
  averageNumberOfStocks: number;
}

/**
 * Portfolio performance metrics
 */
export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
}

/**
 * Risk metrics
 */
export interface RiskMetrics {
  beta: number;
  alpha: number;
  trackingError: number;
  informationRatio: number;
  downsideDeviation: number;
  sortinoRatio: number;
}

/**
 * File export configuration
 */
export interface ExportConfig {
  format: 'xlsx' | 'csv' | 'json';
  includeHoldings: boolean;
  includeTrades: boolean;
  includeMetrics: boolean;
  filename?: string;
}

/**
 * Strategy validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Data quality metrics
 */
export interface DataQuality {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  missingDataPoints: number;
  dataCompleteness: number;  // Percentage
}

/**
 * Historical constituent change
 */
export interface ConstituentChange {
  date: string;
  action: 'add' | 'remove';
  ticker: string;
  reason?: string;
}

/**
 * Sector allocation (if sector data available)
 */
export interface SectorAllocation {
  sector: string;
  weight: number;
  value: number;
  tickers: string[];
}

/**
 * Dividend data (if dividend tracking enabled)
 */
export interface DividendData {
  ticker: string;
  date: string;
  amount: number;
  shares: number;
  totalDividend: number;
}

/**
 * Currency conversion rates (for international stocks)
 */
export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  date: string;
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Batch processing result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    input: any;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Cache entry for price data
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;  // Time to live in milliseconds
}

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  strategy: string;
  benchmark: string;
  outperformance: number;  // Decimal (0.05 = 5% outperformance)
  correlation: number;
  beta: number;
  trackingError: number;
}

/**
 * Portfolio attribution analysis
 */
export interface Attribution {
  stock: string;
  contribution: number;  // Contribution to total return
  weight: number;
  return: number;
}