# Portfolio Backtesting Application - Codebase Documentation

## Overview

This is a Next.js-based portfolio backtesting application that analyzes historical stock performance using various investment strategies. The application uses EODHD API for market data and Upstash Redis for caching.

**Total Lines of Code**: ~10,000 lines
- TypeScript (.ts): 5,424 lines (54%)
- TypeScript React (.tsx): 3,850 lines (38%)
- JavaScript (.js): 729 lines (7%)

## Architecture

### Tech Stack
- **Frontend**: Next.js (Pages Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Vercel Serverless Functions)
- **Data Source**: EODHD Historical Data API
- **Cache**: Upstash Redis (Serverless Redis)
- **Deployment**: Vercel

### Key Architectural Decisions
1. **Cache-First Architecture**: All market data must be pre-cached before analysis
2. **Ticker-Based Caching**: One Redis key per ticker containing all years of data
3. **No On-Demand Fetching**: Analysis only works with pre-cached data (no bypass mode)
4. **Serverless Functions**: Each API endpoint is a separate serverless function

## Directory Structure

```
portfolio-backtesting-app/
├── api/                    # API Routes (2,942 lines)
│   ├── cache/             # Cache operations
│   ├── data/              # Data processing
│   ├── external/          # External API integrations
│   ├── _*.ts              # Shared utilities (prefixed with _)
│   ├── backtest.ts        # Main analysis endpoint
│   ├── fill-cache.ts      # Cache population endpoint
│   └── *.ts               # Other API endpoints
├── components/            # React Components (3,182 lines)
│   ├── backtesting/       # Backtesting UI components
│   ├── cache/             # Cache management UI
│   └── ui/                # Shared UI components
├── src/                   # Source code (2,477 lines)
│   └── lib/
│       ├── strategies/    # Investment strategy implementations
│       └── utils/         # Utility functions
├── pages/                 # Next.js pages
├── public/                # Static assets
├── scripts/               # CLI scripts
└── styles/                # Global styles
```

## Core Modules

### API Layer (`/api`)

#### Infrastructure Files
- **`_types.ts`** - Centralized TypeScript type definitions
- **`_constants.ts`** - Configuration constants (timeouts, cache keys, dates)
- **`_logger.ts`** - Environment-aware logging utility
- **`_errorHandler.ts`** - Standardized error handling
- **`_upstashCache.ts`** - Redis cache client configuration
- **`_cacheUtils.ts`** - Re-exports for cache utilities (compatibility layer)

#### Cache Operations (`/api/cache`)
- **`cacheOperations.ts`** - Core ticker-based cache CRUD operations
  - `getTickerFromCache()` - Retrieve ticker data
  - `setTickerInCache()` - Store ticker data
  - `validateCacheCoverage()` - Check cache completeness
  - `getDataFromCache()` - Load multiple tickers for analysis

#### External APIs (`/api/external`)
- **`eodhApi.ts`** - ALL EODHD API integrations (centralized)
  - Price data fetching
  - Exchange symbol lists
  - Fundamentals data
  - Market capitalization

#### Data Processing (`/api/data`)
- **`dataProcessing.ts`** - Data transformation and processing
  - Individual year data fetching (for cache population)
  - `fillCache()` - Populate cache with historical data

#### Main Endpoints
- **`backtest.ts`** (715 lines) - Portfolio analysis endpoint
  - Validates tickers against EODHD exchange lists
  - Runs 5 investment strategies in parallel
  - Returns comprehensive analysis results
  
- **`fill-cache.ts`** - Cache population endpoint
  - Validates tickers
  - Fetches 20+ years of data per ticker
  - Stores in ticker-based cache structure

- **`cache-management.ts`** - Cache administration
  - List cached analyses
  - Clear cache operations
  - View individual cache entries

### Frontend Components (`/components`)

#### Backtesting Components
- **`ConfigurationPanel.tsx`** - Input form for analysis parameters
- **`TickerInput.tsx`** - Ticker selection with CSV upload support
- **`ResultsDisplay.tsx`** (1,124 lines) - Comprehensive results visualization
- **`StrategySelection.tsx`** - Strategy selection UI

#### Cache Management
- **`CacheManagement.tsx`** (1,074 lines) - Full cache management interface
  - View cached data
  - Fill cache for tickers
  - Export cache data
  - Clear operations

### Strategy Implementations (`/src/lib/strategies`)

1. **`equalWeightBuyHold.ts`** - Equal allocation, no rebalancing
2. **`equalWeightRebalanced.ts`** - Equal allocation, annual rebalancing
3. **`marketCapBuyHold.ts`** - Market cap weighted, no rebalancing
4. **`marketCapRebalanced.ts`** - Market cap weighted, annual rebalancing
5. **`strategyRunner.ts`** - Orchestrates strategy execution

### Utilities (`/src/lib/utils`)

- **`portfolioUtils.ts`** - Portfolio calculation helpers
- **`dateUtils.ts`** - Date manipulation utilities
- **`excelExport.ts`** - Excel export functionality

## Data Flow

### 1. Cache Population Flow
```
User Input (Tickers) → fill-cache API → EODHD API calls → 
Process Data → Store in Redis (ticker-data:AAPL format)
```

### 2. Analysis Flow
```
User Input (Parameters) → Validate Tickers → Check Cache → 
Load Data from Cache → Run Strategies → Cache Results → Return
```

### 3. Cache Structure
```
Key Format: ticker-data:AAPL
Value: {
  "2020": { price: 100, market_cap: 2000000000, shares_outstanding: 1000000 },
  "2021": { price: 150, market_cap: 3000000000, shares_outstanding: 1000000 },
  ...
}
```

## Key Features

### Investment Strategies
- **Equal Weight**: Allocates investment equally across all tickers
- **Market Cap Weight**: Allocates based on market capitalization
- **Buy & Hold**: Initial allocation maintained throughout
- **Rebalanced**: Annual rebalancing to target weights

### Data Management
- **Pre-caching Required**: All data must be cached before analysis
- **Ticker Validation**: Validates against EODHD exchange lists
- **Historical Range**: 2000 to current year
- **Permanent Caching**: Historical data never expires

### User Interface
- **Ticker Input**: Manual entry or CSV upload
- **Results Visualization**: Charts, tables, and metrics
- **Cache Management**: Full visibility and control
- **Excel Export**: Detailed analysis export

## API Endpoints

### Public Endpoints
- `POST /api/backtest` - Run portfolio analysis
- `POST /api/fill-cache` - Populate cache with ticker data
- `GET /api/cache-management` - List cached analyses
- `POST /api/export-excel` - Export results to Excel

### Cache Operations
- `POST /api/cache-management` - Cache administration
- `GET /api/cache-export` - Export cache to CSV
- `GET /api/cache-export-excel` - Export cache to Excel

### System
- `GET /api/health` - Health check endpoint

## Environment Variables

Required:
- `EODHD_API_TOKEN` - EODHD API access token
- `KV_REST_API_URL` - Upstash Redis URL
- `KV_REST_API_TOKEN` - Upstash Redis token

Optional:
- `NODE_ENV` - Environment (development/production)

## Performance Considerations

### Caching Strategy
- **Ticker-based keys**: Max 5,000 keys (one per ticker)
- **No individual year keys**: Avoids Redis key limit issues
- **Permanent historical cache**: No expiration for past data

### Optimization
- **Parallel strategy execution**: All 5 strategies run concurrently
- **Batch data loading**: Load all tickers in one operation
- **Efficient cache structure**: Minimizes Redis operations

### Limitations
- **Vercel timeout**: 10-minute limit for Pro plan
- **Redis key limits**: Upstash free tier limitations
- **API rate limits**: EODHD API call restrictions

## Error Handling

### Standardized Errors
- All API errors use `handleApiError()` utility
- Consistent error response format
- Proper HTTP status codes
- Environment-aware error details

### Validation
- Ticker validation against exchange lists
- Date range validation (2000 to current year)
- Cache completeness checking
- API token verification

## Logging

### Logger Utility
- **Production**: Only errors and important operations
- **Development**: Full debug logging
- **Structured format**: Consistent log levels

## Testing Approach

### Manual Testing
- Cache population verification
- Strategy calculation validation
- UI functionality testing
- Error scenario testing

### Key Test Scenarios
1. Cache miss handling
2. Invalid ticker handling
3. API failure scenarios
4. Timeout handling

## Deployment

### Vercel Configuration
- API routes as serverless functions
- Environment variables in Vercel dashboard
- Automatic deployments from Git

### Build Process
```bash
npm run build  # TypeScript compilation + Next.js build
npm run dev    # Local development server
```

## Recent Architectural Changes

### Major Cleanup (Latest)
1. **Removed mock data logic** - System now requires real API token
2. **Eliminated bypass_cache** - Cache-only architecture enforced
3. **Modularized codebase** - Split monolithic files into focused modules
4. **Standardized patterns** - Consistent error handling and logging
5. **Removed dead code** - ~500+ lines of unused code eliminated

### Cache Architecture Redesign
- **Before**: 300,000+ individual keys (price:AAPL:2020 format)
- **After**: Max 5,000 ticker keys (ticker-data:AAPL format)
- **Impact**: Solved Redis scaling issues, improved performance

## Maintenance Guidelines

### Adding New Features
1. Follow established patterns (error handling, logging)
2. Use TypeScript types from `_types.ts`
3. Add constants to `_constants.ts`
4. Ensure cache compatibility

### Modifying API Integration
- All EODHD calls are in `api/external/eodhApi.ts`
- Update types in `_types.ts` if needed
- Test cache population after changes

### Performance Optimization
- Monitor Vercel function execution time
- Check Redis operation counts
- Optimize batch operations
- Consider pagination for large datasets

## Known Limitations

1. **Analysis Date Range**: Limited to 2000-present
2. **Ticker Validation**: Only US exchange tickers
3. **Cache Requirement**: Cannot analyze without pre-cached data
4. **Timeout Constraints**: Large portfolios may hit Vercel limits
5. **ETF Handling**: Limited market cap/shares data for ETFs

## Future Considerations

1. **Database Integration**: For larger scale operations
2. **Background Jobs**: For long-running cache operations
3. **API Abstraction**: Support multiple data providers
4. **Enhanced Caching**: Incremental cache updates
5. **Performance Monitoring**: Add telemetry and metrics