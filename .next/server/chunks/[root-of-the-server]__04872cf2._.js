module.exports = {

"[project]/.next-internal/server/app/api/market-cap/route/actions.js [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
}}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}}),
"[project]/src/app/api/market-cap/route.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "GET": ()=>GET,
    "HEAD": ()=>HEAD,
    "OPTIONS": ()=>OPTIONS
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
// Default shares outstanding for major companies (fallback data)
const DEFAULT_SHARES_OUTSTANDING = {
    'AAPL.US': 15441000000,
    'MSFT.US': 7430000000,
    'GOOGL.US': 12700000000,
    'GOOG.US': 12700000000,
    'AMZN.US': 10700000000,
    'TSLA.US': 3160000000,
    'META.US': 2540000000,
    'NVDA.US': 24700000000,
    'BRK-B.US': 1450000000,
    'LLY.US': 954000000,
    'V.US': 2130000000,
    'UNH.US': 930000000,
    'MA.US': 960000000,
    'HD.US': 1040000000,
    'JNJ.US': 2400000000,
    'PG.US': 2370000000,
    'JPM.US': 2900000000,
    'XOM.US': 4200000000,
    'CVX.US': 1900000000,
    'ABBV.US': 1760000000,
    'WMT.US': 2710000000,
    'KO.US': 4320000000,
    'PEP.US': 1380000000,
    'COST.US': 443000000,
    'MRK.US': 2530000000,
    'BAC.US': 8200000000,
    'ADBE.US': 460000000,
    'TMO.US': 390000000,
    'ABT.US': 1760000000,
    'CRM.US': 1000000000,
    'NFLX.US': 440000000,
    'ORCL.US': 2700000000,
    'WFC.US': 3700000000,
    'ACN.US': 630000000,
    'DIS.US': 1830000000,
    'VZ.US': 4200000000,
    'CMCSA.US': 4100000000,
    'COP.US': 1300000000,
    'NKE.US': 1540000000,
    'DHR.US': 760000000,
    'TXN.US': 900000000,
    'NEE.US': 2000000000,
    'UPS.US': 870000000,
    'RTX.US': 1500000000,
    'PM.US': 1550000000,
    'LOW.US': 680000000,
    'LIN.US': 510000000,
    'AMGN.US': 530000000,
    'QCOM.US': 1100000000,
    'HON.US': 680000000,
    'UNP.US': 630000000,
    'T.US': 7100000000,
    'AMD.US': 1600000000,
    'INTU.US': 280000000,
    'CAT.US': 510000000,
    'IBM.US': 920000000,
    'AMAT.US': 900000000,
    'GS.US': 340000000,
    'BA.US': 590000000,
    'BLK.US': 150000000,
    'DE.US': 300000000,
    'SYK.US': 380000000,
    'MDT.US': 1350000000,
    'AXP.US': 730000000,
    'NOW.US': 200000000,
    'GILD.US': 1250000000,
    'C.US': 2000000000,
    'MU.US': 1100000000,
    'TJX.US': 1170000000,
    'SCHW.US': 1840000000,
    'PLD.US': 930000000,
    'CB.US': 410000000,
    'BMY.US': 2100000000,
    'MDLZ.US': 1370000000,
    'SO.US': 1060000000,
    'ISRG.US': 360000000,
    'ADI.US': 520000000,
    'REGN.US': 110000000,
    'ZTS.US': 460000000,
    'CI.US': 300000000,
    'DUK.US': 770000000,
    'MMM.US': 570000000,
    'AON.US': 220000000,
    'CSX.US': 2100000000,
    'USB.US': 1480000000,
    'PNC.US': 420000000,
    'EMR.US': 590000000,
    'BSX.US': 1430000000,
    'NSC.US': 2300000000,
    'SHW.US': 260000000,
    'MCK.US': 150000000,
    'ITW.US': 320000000,
    'ECL.US': 290000000,
    'COF.US': 420000000,
    'CL.US': 840000000,
    'CME.US': 360000000,
    'FCX.US': 1450000000,
    'WM.US': 420000000,
    'SLB.US': 1400000000,
    'GD.US': 280000000,
    'MCO.US': 190000000,
    'TGT.US': 460000000,
    'APD.US': 220000000,
    'EMN.US': 220000000,
    'BDX.US': 290000000,
    'EL.US': 360000000,
    'NOC.US': 160000000,
    'ICE.US': 560000000,
    'FDX.US': 260000000,
    'SPY.US': 844000000
};
function getDefaultSharesOutstanding(ticker) {
    // Ensure ticker has .US suffix
    const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
    return DEFAULT_SHARES_OUTSTANDING[formattedTicker] || 1000000000; // 1B shares as fallback
}
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker');
        const date = searchParams.get('date');
        if (!ticker) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Ticker parameter is required'
            }, {
                status: 400
            });
        }
        // Ensure ticker has .US suffix for EODHD API
        const formattedTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
        console.log(`📊 Fetching market cap data for ${formattedTicker}${date ? ` on ${date}` : ''}`);
        // Get API token from environment
        const apiToken = process.env.EODHD_API_TOKEN;
        if (!apiToken || apiToken === 'your_eodhd_api_token_here') {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'EODHD API token not configured',
                message: 'Please set EODHD_API_TOKEN in your .env.local file'
            }, {
                status: 500
            });
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
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `EODHD API error: ${response.status} ${response.statusText}`
            }, {
                status: response.status
            });
        }
        const data = await response.json();
        if (!data || Array.isArray(data) && data.length === 0) {
            console.warn(`⚠️  No data returned for ${formattedTicker}`);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'No data found for the specified ticker and date'
            }, {
                status: 404
            });
        }
        // Handle both single object and array responses
        const priceData = Array.isArray(data) ? data[0] : data;
        if (!priceData || !priceData.close) {
            console.warn(`⚠️  Invalid price data for ${formattedTicker}`);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid price data received'
            }, {
                status: 404
            });
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
        const formatMarketCap = (value)=>{
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
            price_adjustment_note: adjustedPrice !== price ? `Split/dividend adjusted price used (${((adjustedPrice / price - 1) * 100).toFixed(1)}% adjustment)` : undefined
        };
        // Log successful requests
        console.log(`✅ Success: ${formattedTicker} (${result.date}) - $${marketCapBillions.toFixed(1)}B`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
    } catch (error) {
        console.error('❌ API Error:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: errorMessage
        }, {
            status: 500
        });
    }
}
async function OPTIONS(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}
async function HEAD(request) {
    try {
        // Test if API token is configured
        const apiToken = process.env.EODHD_API_TOKEN;
        if (!apiToken || apiToken === 'your_eodhd_api_token_here') {
            return new Response(null, {
                status: 503,
                headers: {
                    'X-Service-Status': 'misconfigured',
                    'Cache-Control': 'no-cache'
                }
            });
        }
        return new Response(null, {
            status: 200,
            headers: {
                'X-Service-Status': 'healthy',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        return new Response(null, {
            status: 503,
            headers: {
                'X-Service-Status': 'unhealthy',
                'Cache-Control': 'no-cache'
            }
        });
    }
}
}),

};

//# sourceMappingURL=%5Broot-of-the-server%5D__04872cf2._.js.map