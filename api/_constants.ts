// api/_constants.ts
// Centralized constants for the application

// API Timeouts (in milliseconds)
export const TIMEOUTS = {
  EODHD_API: 15000,         // 15 seconds for EODHD API calls
  EODHD_EXCHANGE: 30000,    // 30 seconds for exchange symbol list
  ABORTCONTROLLER: 15000,   // Generic abort controller timeout
} as const;

// Cache Durations (in seconds)
export const CACHE_DURATION = {
  TICKER_LISTS: 86400,      // 24 hours for ticker lists
  MOCK_DATA: 3600,          // 1 hour for mock data
  PERMANENT: undefined,     // No expiration for historical data
} as const;

// Cache Key Patterns
export const CACHE_KEYS = {
  TICKER_DATA: 'ticker-data',
  BACKTEST: 'backtest',
  VALID_TICKERS: 'valid-us-tickers-complete-list',
  SHARES_OUTSTANDING: 'shares-outstanding',
  ADJUSTED_PRICE: 'adjusted-price',
  MARKET_CAP: 'market-cap',
  MARKET_CAP_API: 'market-cap-api',
} as const;

// Date Constants
export const DATES = {
  MIN_YEAR: 2000,           // Start from year 2000
  NEW_YEAR_HOLIDAY: '-01-02', // Use Jan 2 to avoid holiday
} as const;

// API Configuration
export const API_CONFIG = {
  BATCH_LIMIT: 1000,        // Limit for batch operations
  MAX_RETRIES: 5,           // Maximum retry attempts
} as const;