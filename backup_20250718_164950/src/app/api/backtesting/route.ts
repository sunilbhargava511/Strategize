// src/app/api/backtesting/route.ts (Updated with cache)

import { NextRequest, NextResponse } from 'next/server';
import { BacktestConfig, runAllStrategies, validateBacktestConfig } from '../../../lib/strategies/strategyRunner';
import { PriceData, SPYData, Stock } from '../../../types/backtesting';
import { getHistoricalDataCache } from '../../../lib/cache/historicalDataCache';

// Rate limiting configuration
const RATE_LIMIT_DELAY = parseInt(process.env.BACKTEST_RATE_LIMIT_MS || '100');
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.BACKTEST_MAX_CONCURRENT_REQUESTS || '5');

/**
 * Main backtesting API endpoint with caching
 */
export async function POST(request: NextRequest) {
  try {
    const config: BacktestConfig = await request.json();
    
    // Validate configuration
    const validation = validateBacktestConfig(config);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }

    console.log('🚀 Starting backtest API request...');
    console.log(`📅 Period: ${config.startYear} - ${config.endYear}`);
    console.log(`📊 Strategies: ${config.strategies.join(', ')}`);
    console.log(`💰 Initial Investment: $${config.initialInvestment.toLocaleString()}`);

    // Get cache instance
    const cache = getHistoricalDataCache();
    const cacheStats = cache.getStats();
    console.log(`📦 Cache stats: ${cacheStats.totalRecords} records, ${cacheStats.uniqueTickers} tickers`);

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendProgress = (current: number, total: number, step: string) => {
          const progress = { type: 'progress', progress: { current, total, step } };
          controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));
        };

        const sendError = (error: string) => {
          const errorMsg = { type: 'error', error };
          controller.enqueue(encoder.encode(JSON.stringify(errorMsg) + '\n'));
          controller.close();
        };

        const sendResults = (results: any) => {
          const resultsMsg = { type: 'results', results };
          controller.enqueue(encoder.encode(JSON.stringify(resultsMsg) + '\n'));
          controller.close();
        };

        try {
          // Initialize progress
          sendProgress(1, 10, 'Initializing backtesting environment...');

          // Create price data fetcher with caching
          let requestCount = 0;
          let cacheHits = 0;
          let cacheMisses = 0;
          
          const priceDataFetcher = async (ticker: string, date: string): Promise<PriceData | null> => {
            try {
              requestCount++;
              if (requestCount % 10 === 0) {
                sendProgress(
                  Math.min(2 + Math.floor(requestCount / 100), 8), 
                  10, 
                  `Fetching price data... (${requestCount} requests, ${cacheHits} cache hits)`
                );
              }

              // Check cache first
              const cached = cache.get(ticker, date);
              if (cached && !cached.isDelisted) {
                cacheHits++;
                return {
                  ticker: cached.ticker,
                  date: cached.date,
                  price: cached.price,
                  adjustedPrice: cached.adjustedPrice,
                  sharesOutstanding: cached.sharesOutstanding,
                  marketCap: cached.marketCap
                };
              } else if (cached && cached.isDelisted) {
                // Stock was delisted, return null
                cacheHits++;
                return null;
              }

              // Cache miss - fetch from API
              cacheMisses++;
              
              // Add rate limiting delay
              if (RATE_LIMIT_DELAY > 0) {
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              }

              const response = await fetch(
                `${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`,
                { 
                  method: 'GET',
                  headers: { 'User-Agent': 'Backtesting-Service/1.0' }
                }
              );

              if (!response.ok) {
                console.warn(`Failed to fetch data for ${ticker} on ${date}: ${response.status}`);
                
                // Cache the failure
                cache.set({
                  ticker,
                  date,
                  price: 0,
                  adjustedPrice: 0,
                  sharesOutstanding: 0,
                  marketCap: 0,
                  lastUpdated: new Date().toISOString(),
                  isDelisted: true
                });
                
                return null;
              }

              const data = await response.json();
              
              if (!data.price || !data.shares_outstanding) {
                console.warn(`Incomplete data for ${ticker} on ${date}`);
                return null;
              }

              const priceData: PriceData = {
                ticker: data.ticker,
                date: data.date,
                price: data.price,
                adjustedPrice: data.adjusted_price || data.price,
                sharesOutstanding: data.shares_outstanding,
                marketCap: data.market_cap || (data.price * data.shares_outstanding)
              };

              // Cache the successful result
              cache.set({
                ticker: priceData.ticker,
                date: priceData.date,
                price: priceData.price,
                adjustedPrice: priceData.adjustedPrice,
                sharesOutstanding: priceData.sharesOutstanding,
                marketCap: priceData.marketCap,
                lastUpdated: new Date().toISOString(),
                isDelisted: false
              });

              return priceData;
            } catch (error) {
              console.error(`Error fetching data for ${ticker} on ${date}:`, error);
              return null;
            }
          };

          // Create SPY data fetcher with caching
          const spyDataFetcher = async (startYear: number, endYear: number): Promise<SPYData[]> => {
            sendProgress(3, 10, 'Fetching SPY benchmark data...');
            
            try {
              const response = await fetch(
                `${request.nextUrl.origin}/api/spy-data?startYear=${startYear}&endYear=${endYear}`
              );
              
              if (!response.ok) {
                throw new Error(`SPY data fetch failed: ${response.status}`);
              }
              
              const data = await response.json();
              return data.spyData || [];
            } catch (error) {
              console.error('Error fetching SPY data:', error);
              throw new Error('Failed to fetch SPY benchmark data');
            }
          };

          sendProgress(4, 10, 'Starting strategy execution...');

          // Run all strategies
          const results = await runAllStrategies(
            config,
            priceDataFetcher,
            spyDataFetcher
          );

          // Save cache after backtest
          cache.flush();
          
          console.log(`📊 Cache performance: ${cacheHits} hits, ${cacheMisses} misses (${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}% hit rate)`);
          
          sendProgress(10, 10, 'Backtest completed successfully!');
          
          // Send final results
          sendResults(results);

        } catch (error) {
          console.error('Backtest execution failed:', error);
          sendError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Backtesting API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Cache management endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'cache-stats') {
      const cache = getHistoricalDataCache();
      const stats = cache.getStats();
      
      return NextResponse.json({
        ...stats,
        message: 'Cache statistics retrieved successfully'
      });
    }

    if (action === 'sp500-stocks') {
      // Load S&P 500 historical data from CSV
      const fs = require('fs');
      const path = require('path');
      const Papa = require('papaparse');

      const csvPath = path.join(process.cwd(), 'data', 'sp500-tickers.csv');
      
      if (!fs.existsSync(csvPath)) {
        return NextResponse.json(
          { error: 'S&P 500 data file not found' },
          { status: 404 }
        );
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const parsed = Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      const stocks: Stock[] = parsed.data.map((row: any) => ({
        ticker: row.ticker,
        startDate: row.start_date,
        endDate: row.end_date || null
      }));

      return NextResponse.json({ stocks });
    }

    return NextResponse.json(
      { error: 'Invalid action parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Clear cache endpoint
 */
export async function DELETE(request: NextRequest) {
  try {
    const cache = getHistoricalDataCache();
    cache.clear();
    
    return NextResponse.json({
      message: 'Cache cleared successfully',
      stats: cache.getStats()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Health check endpoint
 */
export async function HEAD(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
}