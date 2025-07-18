import { NextRequest, NextResponse } from 'next/server';
import { BacktestConfig, runAllStrategies, validateBacktestConfig } from '../../../lib/strategies/strategyRunner';
import { PriceData, SPYData, Stock } from '../../../types/backtesting';

// Rate limiting configuration
const RATE_LIMIT_DELAY = parseInt(process.env.BACKTEST_RATE_LIMIT_MS || '100');
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.BACKTEST_MAX_CONCURRENT_REQUESTS || '5');

/**
 * Main backtesting API endpoint
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

          // Create price data fetcher with rate limiting
          let requestCount = 0;
          const priceDataFetcher = async (ticker: string, date: string): Promise<PriceData | null> => {
            try {
              requestCount++;
              if (requestCount % 10 === 0) {
                sendProgress(
                  Math.min(2 + Math.floor(requestCount / 100), 8), 
                  10, 
                  `Fetching price data... (${requestCount} requests)`
                );
              }

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
                return null;
              }

              const data = await response.json();
              
              if (!data.price || !data.shares_outstanding) {
                console.warn(`Incomplete data for ${ticker} on ${date}`);
                return null;
              }

              return {
                ticker: data.ticker,
                date: data.date,
                price: data.price,
                adjustedPrice: data.adjusted_price || data.price,
                sharesOutstanding: data.shares_outstanding,
                marketCap: data.market_cap || (data.price * data.shares_outstanding)
              };
            } catch (error) {
              console.error(`Error fetching data for ${ticker} on ${date}:`, error);
              return null;
            }
          };

          // Create SPY data fetcher
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
 * Get S&P 500 historical constituents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

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
    console.error('Error loading S&P 500 data:', error);
    return NextResponse.json(
      { error: 'Failed to load S&P 500 data' },
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
 * Utility function to load start-of-year dates
 */
async function loadStartOfYearDates(): Promise<{ [year: string]: string }> {
  try {
    const fs = require('fs');
    const path = require('path');
    const Papa = require('papaparse');

    const csvPath = path.join(process.cwd(), 'data', 'start-of-year-dates.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.warn('Start-of-year dates file not found, using defaults');
      return {};
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true
    });

    const dates: { [year: string]: string } = {};
    
    if (parsed.data && parsed.data.length > 0) {
      const row = parsed.data[0];
      for (const [year, dateStr] of Object.entries(row)) {
        if (year !== 'Year' && typeof dateStr === 'string') {
          // Convert from M/D/YY to YYYY-MM-DD format
          if (dateStr.includes('/')) {
            const [month, day, year2Digit] = dateStr.split('/');
            const fullYear = parseInt(year2Digit) < 50 ? `20${year2Digit}` : `19${year2Digit}`;
            dates[year] = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
      }
    }

    return dates;
  } catch (error) {
    console.error('Error loading start-of-year dates:', error);
    return {};
  }
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
