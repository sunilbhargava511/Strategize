// Test script to debug EODHD API response format for AAPL
// This will help us understand why shares outstanding is returning constant values

const { default: fetch } = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testEODHDQuarterlyData() {
    const EOD_API_KEY = process.env.EODHD_API_TOKEN;
    if (!EOD_API_KEY) {
        console.error('EODHD_API_TOKEN not configured');
        return;
    }
    
    const ticker = 'AAPL.US';
    console.log(`Testing EODHD API for ${ticker}\n`);
    
    try {
        // Step 1: Get all available quarterly balance sheet dates
        const periodsUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${EOD_API_KEY}&fmt=json&filter=Financials::Balance_Sheet::quarterly`;
        console.log('Step 1 URL:', periodsUrl);
        
        const periodsResponse = await fetch(periodsUrl);
        if (!periodsResponse.ok) {
            console.error(`Failed to get quarterly periods: ${periodsResponse.status}`);
            return;
        }
        
        const allQuarters = await periodsResponse.json();
        console.log('Step 1 Response type:', typeof allQuarters);
        console.log('Step 1 Response keys (first 10):', Object.keys(allQuarters).slice(0, 10));
        console.log('Step 1 Sample quarter data:', allQuarters[Object.keys(allQuarters)[0]]);
        
        // Step 2: Find quarters around 2020 and 2023 to see if they differ
        const testDates = ['2020-12-31', '2023-12-31'];
        const availableDates = Object.keys(allQuarters).sort().reverse();
        
        console.log('\nAvailable dates (latest 20):');
        availableDates.slice(0, 20).forEach(date => {
            console.log(`  ${date}: hasCommonStock = ${!!allQuarters[date]?.commonStockSharesOutstanding}`);
        });
        
        // Step 3: Test specific date queries for shares outstanding
        for (const testDate of testDates) {
            console.log(`\n--- Testing ${testDate} ---`);
            
            // Find best available date before target
            let bestDate = null;
            const targetDate = new Date(testDate);
            
            for (const dateStr of availableDates) {
                const reportDate = new Date(dateStr);
                if (reportDate < targetDate) {
                    bestDate = dateStr;
                    break;
                }
            }
            
            if (!bestDate) {
                console.log(`No quarterly report found before ${testDate}`);
                continue;
            }
            
            console.log(`Best date for ${testDate}: ${bestDate}`);
            
            // Query specific shares outstanding
            const sharesUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${EOD_API_KEY}&fmt=json&filter=Financials::Balance_Sheet::quarterly::${bestDate}::commonStockSharesOutstanding`;
            console.log('Query URL:', sharesUrl);
            
            const sharesResponse = await fetch(sharesUrl);
            if (!sharesResponse.ok) {
                console.log(`Failed to get shares outstanding: ${sharesResponse.status}`);
                continue;
            }
            
            const sharesOutstanding = await sharesResponse.json();
            console.log(`Shares outstanding for ${testDate} (using ${bestDate}):`, sharesOutstanding);
            console.log('Type:', typeof sharesOutstanding);
            
            // Also check what's in the raw quarter data
            const rawQuarterData = allQuarters[bestDate];
            console.log('Raw quarter commonStockSharesOutstanding:', rawQuarterData?.commonStockSharesOutstanding);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testEODHDQuarterlyData();