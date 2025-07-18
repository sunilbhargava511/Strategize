import { NextRequest, NextResponse } from 'next/server';

// Default shares outstanding for major companies (fallback data)
const DEFAULT_SHARES_OUTSTANDING: { [key: string]: number } = {
  'AAPL.US': 15441000000,     // Apple Inc.
  'MSFT.US': 7430000000,      // Microsoft Corporation
  'GOOGL.US': 12700000000,    // Alphabet Inc. Class A
  'GOOG.US': 12700000000,     // Alphabet Inc. Class C
  'AMZN.US': 10700000000,     // Amazon.com Inc.
  'TSLA.US': 3160000000,      // Tesla Inc.
  'META.US': 2540000000,      // Meta Platforms Inc.
  'NVDA.US': 24700000000,     // NVIDIA Corporation
  'BRK-B.US': 1450000000,     // Berkshire Hathaway Inc. Class B
  'LLY.US': 954000000,        // Eli Lilly and Company
  'V.US': 2130000000,         // Visa Inc.
  'UNH.US': 930000000,        // UnitedHealth Group Incorporated
  'MA.US': 960000000,         // Mastercard Incorporated
  'HD.US': 1040000000,        // The Home Depot Inc.
  'JNJ.US': 2400000000,       // Johnson & Johnson
  'PG.US': 2370000000,        // The Procter & Gamble Company
  'JPM.US': 2900000000,       // JPMorgan Chase & Co.
  'XOM.US': 4200000000,       // Exxon Mobil Corporation
  'CVX.US': 1900000000,       // Chevron Corporation
  'ABBV.US': 1760000000,      // AbbVie Inc.
  'WMT.US': 2710000000,       // Walmart Inc.
  'KO.US': 4320000000,        // The Coca-Cola Company
  'PEP.US': 1380000000,       // PepsiCo Inc.
  'COST.US': 443000000,       // Costco Wholesale Corporation
  'MRK.US': 2530000000,       // Merck & Co. Inc.
  'BAC.US': 8200000000,       // Bank of America Corporation
  'ADBE.US': 460000000,       // Adobe Inc.
  'TMO.US': 390000000,        // Thermo Fisher Scientific Inc.
  'ABT.US': 1760000000,       // Abbott Laboratories
  'CRM.US': 1000000000,       // Salesforce Inc.
  'NFLX.US': 440000000,       // Netflix Inc.
  'ORCL.US': 2700000000,      // Oracle Corporation
  'WFC.US': 3700000000,       // Wells Fargo & Company
  'ACN.US': 630000000,        // Accenture plc
  'DIS.US': 1830000000,       // The Walt Disney Company
  'VZ.US': 4200000000,        // Verizon Communications Inc.
  'CMCSA.US': 4100000000,     // Comcast Corporation
  'COP.US': 1300000000,       // ConocoPhillips
  'NKE.US': 1540000000,       // NIKE Inc.
  'DHR.US': 760000000,        // Danaher Corporation
  'TXN.US': 900000000,        // Texas Instruments Incorporated
  'NEE.US': 2000000000,       // NextEra Energy Inc.
  'UPS.US': 870000000,        // United Parcel Service Inc.
  'RTX.US': 1500000000,       // Raytheon Technologies Corporation
  'PM.US': 1550000000,        // Philip Morris International Inc.
  'LOW.US': 680000000,        // Lowe's Companies Inc.
  'LIN.US': 510000000,        // Linde plc
  'AMGN.US': 530000000,       // Amgen Inc.
  'QCOM.US': 1100000000,      // QUALCOMM Incorporated
  'HON.US': 680000000,        // Honeywell International Inc.
  'UNP.US': 630000000,        // Union Pacific Corporation
  'T.US': 7100000000,         // AT&T Inc.
  'AMD.US': 1600000000,       // Advanced Micro Devices Inc.
  'INTU.US': 280000000,       // Intuit Inc.
  'CAT.US': 510000000,        // Caterpillar Inc.
  'IBM.US': 920000000,        // International Business Machines Corporation
  'AMAT.US': 900000000,       // Applied Materials Inc.
  'GS.US': 340000000,         // The Goldman Sachs Group Inc.
  'BA.US': 590000000,         // The Boeing Company
  'BLK.US': 150000000,        // BlackRock Inc.
  'DE.US': 300000000,         // Deere & Company
  'SYK.US': 380000000,        // Stryker Corporation
  'MDT.US': 1350000000,       // Medtronic plc
  'AXP.US': 730000000,        // American Express Company
  'NOW.US': 200000000,        // ServiceNow Inc.
  'GILD.US': 1250000000,      // Gilead Sciences Inc.
  'C.US': 2000000000,         // Citigroup Inc.
  'MU.US': 1100000000,        // Micron Technology Inc.
  'TJX.US': 1170000000,       // The TJX Companies Inc.
  'SCHW.US': 1840000000,      // The Charles Schwab Corporation
  'PLD.US': 930000000,        // Prologis Inc.
  'CB.US': 410000000,         // Chubb Limited
  'BMY.US': 2100000000,       // Bristol-Myers Squibb Company
  'MDLZ.US': 1370000000,      // Mondelez International Inc.
  'SO.US': 1060000000,        // The Southern Company
  'ISRG.US': 360000000,       // Intuitive Surgical Inc.
  'ADI.US': 520000000,        // Analog Devices Inc.
  'REGN.US': 110000000,       // Regeneron Pharmaceuticals Inc.
  'ZTS.US': 460000000,        // Zoetis Inc.
  'CI.US': 300000000,         // Cigna Corporation
  'DUK.US': 770000000,        // Duke Energy Corporation
  'MMM.US': 570000000,        // 3M Company
  'AON.US': 220000000,        // Aon plc
  'CSX.US': 2100000000,       // CSX Corporation
  'USB.US': 1480000000,       // U.S. Bancorp
  'PNC.US': 420000000,        // The PNC Financial Services Group Inc.
  'EMR.US': 590000000,        // Emerson Electric Co.
  'BSX.US': 1430000000,       // Boston Scientific Corporation
  'NSC.US': 2300000000,       // Norfolk Southern Corporation
  'SHW.US': 260000000,        // The Sherwin-Williams Company
  'MCK.US': 150000000,        // McKesson Corporation
  'ITW.US': 320000000,        // Illinois Tool Works Inc.
  'ECL.US': 290000000,        // Ecolab Inc.
  'COF.US': 420000000,        // Capital One Financial Corporation
  'CL.US': 840000000,         // Colgate-Palmolive Company
  'CME.US': 360000000,        // CME Group Inc.
  'FCX.US': 1450000000,       // Freeport-McMoRan Inc.
  'WM.US': 420000000,         // Waste Management Inc.
  'SLB.US': 1400000000,       // Schlumberger Limited
  'GD.US': 280000000,         // General Dynamics Corporation
  'MCO.US': 190000000,        // Moody's Corporation
  'TGT.US': 460000000,        // Target Corporation
  'APD.US': 220000000,        // Air Products and Chemicals Inc.
  'EMN.US': 220000000,        // Eastman Chemical Company
  'BDX.US': 290000000,        // Becton Dickinson and Company
  'EL.US': 360000000,         // The Estée Lauder Companies Inc.
  'NOC.US': 160000000,        // Northrop Grumman Corporation
  'ICE.US': 560000000,        // Intercontinental Exchange Inc.
  'FDX.US': 260000000,        // FedEx Corporation
  'SPY.US': 844000000,        // SPDR S&P 500 ETF Trust
};

function getDefaultSharesOutstanding(ticker: string): number {
  // Ensure ticker has .US suffix
  const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
  return DEFAULT_SHARES_OUTSTANDING[formattedTicker] || 1000000000; // 1B shares as fallback
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const date = searchParams.get('date');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    // Ensure ticker has .US suffix for EODHD API
    const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
    
    console.log(`📊 Fetching market cap data for ${formattedTicker}${date ? ` on ${date}` : ''}`);

    // Get API token from environment
    const apiToken = process.env.EODHD_API_TOKEN;
    if (!apiToken || apiToken === 'your_eodhd_api_token_here') {
      return NextResponse.json(
        { 
          error: 'EODHD API token not configured',
          message: 'Please set EODHD_API_TOKEN in your .env.local file'
        },
        { status: 500 }
      );
    }

    // Build API URL
    let apiUrl = `https://eodhd.com/api/eod/${formattedTicker}?api_token=${apiToken}&fmt=json`;
    if (date) {
      apiUrl += `&from=${date}&to=${date}`;
    } else {
      // Get latest data point
      apiUrl += '&order=d&limit=1';
    }

    console.log(`🔗 API URL: ${apiUrl.replace(apiToken, 'HIDDEN')}`);

    // Fetch data from EODHD
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Portfolio-Backtesting/1.0'
      }
    });

    if (!response.ok) {
      console.error(`❌ EODHD API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `EODHD API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.warn(`⚠️  No data returned for ${formattedTicker}`);
      return NextResponse.json(
        { error: 'No data found for the specified ticker and date' },
        { status: 404 }
      );
    }

    // Handle both single object and array responses
    const priceData = Array.isArray(data) ? data[0] : data;
    
    if (!priceData || !priceData.close) {
      console.warn(`⚠️  Invalid price data for ${formattedTicker}`);
      return NextResponse.json(
        { error: 'Invalid price data received' },
        { status: 404 }
      );
    }

    // Extract price information
    const price = parseFloat(priceData.close);
    const adjustedPrice = parseFloat(priceData.adjusted_close || priceData.close);
    const priceDate = priceData.date;

    // Get shares outstanding (use default if not available from API)
    const sharesOutstanding = getDefaultSharesOutstanding(formattedTicker);
    
    // Calculate market cap
    const marketCap = adjustedPrice * sharesOutstanding;
    const marketCapBillions = marketCap / 1e9;

    // Format market cap for display
    const formatMarketCap = (value: number): string => {
      if (value >= 1e12) {
        return `$${(value / 1e12).toFixed(2)}T`;
      } else if (value >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
      } else if (value >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
      } else {
        return `$${value.toFixed(0)}`;
      }
    };

    const result = {
      ticker: formattedTicker,
      date: priceDate || date || new Date().toISOString().split('T')[0],
      price: price,
      adjusted_price: adjustedPrice,
      shares_outstanding: sharesOutstanding,
      market_cap: marketCap,
      market_cap_billions: marketCapBillions,
      formatted_market_cap: formatMarketCap(marketCap),
      price_adjustment_note: adjustedPrice !== price ? 
        `Split/dividend adjusted price used (${((adjustedPrice / price - 1) * 100).toFixed(1)}% adjustment)` : 
        undefined
    };

    // Log successful requests
    console.log(`✅ Success: ${formattedTicker} (${result.date}) - $${marketCapBillions.toFixed(1)}B`);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ API Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

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

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    // Test if API token is configured
    const apiToken = process.env.EODHD_API_TOKEN;
    if (!apiToken || apiToken === 'your_eodhd_api_token_here') {
      return new Response(null, {
        status: 503,
        headers: {
          'X-Service-Status': 'misconfigured',
          'Cache-Control': 'no-cache',
        },
      });
    }

    return new Response(null, {
      status: 200,
      headers: {
        'X-Service-Status': 'healthy',
        'Cache-Control': 'no-cache',
      },
    });
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