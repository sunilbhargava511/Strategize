// api/_cacheUtils.ts
// Main exports for cache utilities (compatibility layer)

// Re-export types
export type { TickerYearData, TickerCacheData, GetDataResults, FillCacheResults } from './_types';

// Re-export cache operations
export {
  getTickerFromCache,
  setTickerInCache,
  listCachedTickers,
  validateCacheCoverage,
  getDataFromCache,
  getCachedPrice,
  getCachedMarketCap,
  getCachedSharesOutstanding
} from './cache/cacheOperations';

// Re-export data processing functions
export {
  getAdjustedPriceForYear,
  getMarketCapForYear,
  getSharesOutstandingForYear,
  fillCache
} from './data/dataProcessing';

// Re-export external API functions
export {
  getValidUSTickers,
  isETF
} from './external/eodhApi';