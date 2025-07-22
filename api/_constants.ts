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

// Size Limits for Vercel Deployment
export const SIZE_LIMITS = {
  // Ticker limits based on performance analysis
  SMALL_PORTFOLIO: 25,      // ~30-60 seconds execution
  MEDIUM_PORTFOLIO: 75,     // ~2-5 minutes execution
  LARGE_PORTFOLIO: 150,     // ~5-8 minutes execution
  MAX_PORTFOLIO: 200,       // ~8-9.5 minutes (safe Vercel limit)
  
  // Request size limits
  MAX_REQUEST_SIZE: 4 * 1024 * 1024,  // 4MB Vercel limit
  MAX_CSV_SIZE: 2 * 1024 * 1024,      // 2MB reasonable CSV size
  
  // Cache operation limits
  MAX_FILL_CACHE_BATCH: 50,           // Tickers per fill-cache request
  FILL_CACHE_BATCH_SIZE: 10,          // Internal batch size for processing tickers
  FILL_CACHE_PROGRESS_INTERVAL: 5,    // Progress update every N batches
  MAX_CACHE_EXPORT: 1000,             // Already implemented
  
  // Data limits
  MAX_YEARS_RANGE: 25,                // 2000-2025
  MIN_YEAR: 2000,                     // Minimum supported year
} as const;