// api/_types.ts
// Centralized type definitions for the application

// New ticker-based cache structure
export interface TickerYearData {
  price?: number;
  market_cap?: number;
  shares_outstanding?: number;
}

export interface TickerCacheData {
  [year: string]: TickerYearData;
}

// EODHD API Response Types
export interface EODHDPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export interface ValidTickerLists {
  active: Set<string>;
  delisted: Set<string>;
}

// Cache operation results
export interface FillCacheResults {
  success: string[];
  errors: Array<{ticker: string, error: string}>;
  warnings: Array<{ticker: string, year: string, issue: string}>;
}

export interface GetDataResults {
  data: Record<string, TickerCacheData>;
  missing: string[];
}

// Strategy calculation types
export interface StrategyResult {
  totalReturn: number;
  annualizedReturn: number;
  finalValue: number;
  yearlyValues: Record<number, number>;
  yearlyHoldings: Record<number, Record<string, { 
    weight: number; 
    shares: number; 
    value: number; 
    price: number; 
    marketCap?: number; 
    sharesOutstanding?: number; 
  }>>;
  portfolioComposition: Record<string, { 
    initialWeight: number; 
    finalWeight: number; 
    available: boolean; 
  }>;
}

// Cache management types
export interface CachedAnalysis {
  key: string;
  tickers: string[];
  startYear: number;
  endYear: number;
  initialInvestment: number;
  tickerCount: number;
  cachedAt?: string;
  expiresAt?: string;
  isPermanent: boolean;
  size?: number;
  customName?: string;
}

// API Error Response
export interface ApiError {
  error: string;
  message: string;
  details?: any;
}