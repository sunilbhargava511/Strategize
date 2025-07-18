import { NextRequest, NextResponse } from 'next/server';
import { SPYData } from '../../../types/backtesting';
import { getStartOfYearDate, getYearsInRange } from '../../../lib/utils/dateUtils';

/**
 * SPY benchmark data API endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startYear = parseInt(searchParams.get('startYear') || '2010');
    const endYear = parseInt(searchParams.get('endYear') || '2024');

    console.log(`📈 Fetching SPY data from ${startYear} to ${endYear}`);

    // Validate years
    if (startYear < 1996 || endYear > 2025 || startYear >= endYear) {
      return NextResponse.json(
        { error: 'Invalid year range. Must be between 1996-2025 and startYear < endYear' },
        { status: 400 }
      );
    }

    const spyData: SPYData[] = [];
    const years = getYearsInRange(startYear, endYear);
    
    // Get SPY data for each year
    for (const year of years) {
      try {
        const yearDate = getStartOfYearDate(year);
        
        // Fetch SPY data using the market-cap API endpoint
        const response = await fetch(
          `${request.nextUrl.origin}/api/market-cap?ticker=SPY&date=${yearDate}`,
          { 
            method: 'GET',
            headers: { 'User-Agent': 'SPY-Data-Service/1.0' }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.price && data.adjusted_price) {
            spyData.push({
              date: data.date || yearDate,
              price: data.price,
              adjustedPrice: data.adjusted_price
            });
            
            console.log(`✅ SPY ${year}: $${data.adjusted_price.toFixed(2)}`);
          } else {
            console.warn(`⚠️  Incomplete SPY data for ${year}`);
          }
        } else {
          console.warn(`❌ Failed to fetch SPY data for ${year}: ${response.status}`);
        }

        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`Error fetching SPY data for ${year}:`, error);
      }
    }

    if (spyData.length === 0) {
      return NextResponse.json(
        { error: 'No SPY data could be retrieved for the specified period' },
        { status: 404 }
      );
    }

    console.log(`📊 Successfully retrieved SPY data for ${spyData.length} years`);

    return NextResponse.json({
      spyData,
      startYear,
      endYear,
      dataPoints: spyData.length
    });

  } catch (error) {
    console.error('SPY data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SPY data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Handle POST requests for custom SPY data scenarios
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dates, ticker = 'SPY' } = body;

    if (!dates || !Array.isArray(dates)) {
      return NextResponse.json(
        { error: 'Dates array is required' },
        { status: 400 }
      );
    }

    console.log(`📈 Fetching ${ticker} data for ${dates.length} custom dates`);

    const spyData: SPYData[] = [];
    
    for (const date of dates) {
      try {
        const response = await fetch(
          `${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`,
          { 
            method: 'GET',
            headers: { 'User-Agent': 'SPY-Data-Service/1.0' }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.price && data.adjusted_price) {
            spyData.push({
              date: data.date || date,
              price: data.price,
              adjustedPrice: data.adjusted_price
            });
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error fetching ${ticker} data for ${date}:`, error);
      }
    }

    return NextResponse.json({
      spyData,
      ticker,
      requestedDates: dates.length,
      retrievedDates: spyData.length
    });

  } catch (error) {
    console.error('Custom SPY data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom SPY data' },
      { status: 500 }
    );
  }
}

/**
 * Get SPY data for a specific date range with monthly intervals
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, interval = 'monthly', ticker = 'SPY' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`📈 Fetching ${ticker} data from ${startDate} to ${endDate} (${interval})`);

    // Generate date array based on interval
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (interval === 'monthly') {
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setMonth(current.getMonth() + 1);
      }
    } else if (interval === 'yearly') {
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setFullYear(current.getFullYear() + 1);
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid interval. Use "monthly" or "yearly"' },
        { status: 400 }
      );
    }

    const spyData: SPYData[] = [];
    
    for (const date of dates) {
      try {
        const response = await fetch(
          `${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`,
          { 
            method: 'GET',
            headers: { 'User-Agent': 'SPY-Data-Service/1.0' }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.price && data.adjusted_price) {
            spyData.push({
              date: data.date || date,
              price: data.price,
              adjustedPrice: data.adjusted_price
            });
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`Error fetching ${ticker} data for ${date}:`, error);
      }
    }

    return NextResponse.json({
      spyData,
      ticker,
      startDate,
      endDate,
      interval,
      requestedDates: dates.length,
      retrievedDates: spyData.length
    });

  } catch (error) {
    console.error('Interval SPY data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interval SPY data' },
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
 * Health check for SPY data service
 */
export async function HEAD(request: NextRequest) {
  try {
    // Test fetch of a single SPY data point to verify service health
    const testDate = '2024-01-02';
    const response = await fetch(
      `${request.nextUrl.origin}/api/market-cap?ticker=SPY&date=${testDate}`,
      { 
        method: 'GET',
        headers: { 'User-Agent': 'SPY-Health-Check/1.0' }
      }
    );

    if (response.ok) {
      return new Response(null, {
        status: 200,
        headers: {
          'X-Service-Status': 'healthy',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      return new Response(null, {
        status: 503,
        headers: {
          'X-Service-Status': 'degraded',
          'Cache-Control': 'no-cache',
        },
      });
    }
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Service-Status': 'unhealthy',
        'Cache-Control': 'no-cache',
      },
    });
  }
}