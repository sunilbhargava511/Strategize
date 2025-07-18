module.exports = {

"[project]/.next-internal/server/app/api/spy-data/route/actions.js [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {

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
"[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "START_OF_YEAR_DATES": ()=>START_OF_YEAR_DATES,
    "formatDateForAPI": ()=>formatDateForAPI,
    "formatDateForDisplay": ()=>formatDateForDisplay,
    "getNextValidYear": ()=>getNextValidYear,
    "getStartOfYearDate": ()=>getStartOfYearDate,
    "getYearsBetweenDates": ()=>getYearsBetweenDates,
    "getYearsInRange": ()=>getYearsInRange,
    "hasStartOfYearDate": ()=>hasStartOfYearDate,
    "isDateInRange": ()=>isDateInRange,
    "parseDate": ()=>parseDate
});
const START_OF_YEAR_DATES = {
    '1996': '1996-01-02',
    '1997': '1997-01-07',
    '1998': '1998-01-06',
    '1999': '1999-01-05',
    '2000': '2000-01-04',
    '2001': '2001-01-02',
    '2002': '2002-01-02',
    '2003': '2003-01-07',
    '2004': '2004-01-06',
    '2005': '2005-01-04',
    '2006': '2006-01-03',
    '2007': '2007-01-03',
    '2008': '2008-01-02',
    '2009': '2009-01-06',
    '2010': '2010-01-05',
    '2011': '2011-01-04',
    '2012': '2012-01-03',
    '2013': '2013-01-02',
    '2014': '2014-01-07',
    '2015': '2015-01-06',
    '2016': '2016-01-05',
    '2017': '2017-01-03',
    '2018': '2018-01-02',
    '2019': '2019-01-02',
    '2020': '2020-01-07',
    '2021': '2021-01-05',
    '2022': '2022-01-04',
    '2023': '2023-01-03',
    '2024': '2024-01-02',
    '2025': '2025-01-07'
};
function getStartOfYearDate(year) {
    const yearStr = year.toString();
    const date = START_OF_YEAR_DATES[yearStr];
    if (!date) {
        throw new Error(`No start-of-year date found for year ${year}`);
    }
    return date;
}
function formatDateForAPI(date) {
    if (typeof date === 'string') {
        // Assume it's already in the correct format or convert from M/D/YY
        if (date.includes('/')) {
            const [month, day, year] = date.split('/');
            const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
            return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return date;
    }
    return date.toISOString().split('T')[0];
}
function parseDate(dateStr) {
    // Handle M/D/YY format
    if (dateStr.includes('/')) {
        const [month, day, year] = dateStr.split('/');
        const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
    // Handle YYYY-MM-DD format
    return new Date(dateStr);
}
function isDateInRange(date, startDate, endDate) {
    const checkDate = parseDate(date);
    const rangeStart = parseDate(startDate);
    if (endDate) {
        const rangeEnd = parseDate(endDate);
        return checkDate >= rangeStart && checkDate <= rangeEnd;
    }
    return checkDate >= rangeStart;
}
function getYearsInRange(startYear, endYear) {
    const years = [];
    for(let year = startYear; year <= endYear; year++){
        years.push(year);
    }
    return years;
}
function getYearsBetweenDates(startDate, endDate) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}
function hasStartOfYearDate(year) {
    return START_OF_YEAR_DATES[year.toString()] !== undefined;
}
function getNextValidYear(year) {
    for(let nextYear = year + 1; nextYear <= 2025; nextYear++){
        if (hasStartOfYearDate(nextYear)) {
            return nextYear;
        }
    }
    return null;
}
function formatDateForDisplay(date) {
    const dateObj = parseDate(date);
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
}),
"[project]/src/app/api/spy-data/route.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "GET": ()=>GET,
    "HEAD": ()=>HEAD,
    "OPTIONS": ()=>OPTIONS,
    "POST": ()=>POST,
    "PUT": ()=>PUT
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const startYear = parseInt(searchParams.get('startYear') || '2010');
        const endYear = parseInt(searchParams.get('endYear') || '2024');
        console.log(`📈 Fetching SPY data from ${startYear} to ${endYear}`);
        // Validate years
        if (startYear < 1996 || endYear > 2025 || startYear >= endYear) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid year range. Must be between 1996-2025 and startYear < endYear'
            }, {
                status: 400
            });
        }
        const spyData = [];
        const years = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsInRange"])(startYear, endYear);
        // Get SPY data for each year
        for (const year of years){
            try {
                const yearDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(year);
                // Fetch SPY data using the market-cap API endpoint
                const response = await fetch(`${request.nextUrl.origin}/api/market-cap?ticker=SPY&date=${yearDate}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SPY-Data-Service/1.0'
                    }
                });
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
                await new Promise((resolve)=>setTimeout(resolve, 50));
            } catch (error) {
                console.error(`Error fetching SPY data for ${year}:`, error);
            }
        }
        if (spyData.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'No SPY data could be retrieved for the specified period'
            }, {
                status: 404
            });
        }
        console.log(`📊 Successfully retrieved SPY data for ${spyData.length} years`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            spyData,
            startYear,
            endYear,
            dataPoints: spyData.length
        });
    } catch (error) {
        console.error('SPY data API error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch SPY data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { dates, ticker = 'SPY' } = body;
        if (!dates || !Array.isArray(dates)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Dates array is required'
            }, {
                status: 400
            });
        }
        console.log(`📈 Fetching ${ticker} data for ${dates.length} custom dates`);
        const spyData = [];
        for (const date of dates){
            try {
                const response = await fetch(`${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SPY-Data-Service/1.0'
                    }
                });
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
                await new Promise((resolve)=>setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error fetching ${ticker} data for ${date}:`, error);
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            spyData,
            ticker,
            requestedDates: dates.length,
            retrievedDates: spyData.length
        });
    } catch (error) {
        console.error('Custom SPY data API error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch custom SPY data'
        }, {
            status: 500
        });
    }
}
async function PUT(request) {
    try {
        const body = await request.json();
        const { startDate, endDate, interval = 'monthly', ticker = 'SPY' } = body;
        if (!startDate || !endDate) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'startDate and endDate are required'
            }, {
                status: 400
            });
        }
        console.log(`📈 Fetching ${ticker} data from ${startDate} to ${endDate} (${interval})`);
        // Generate date array based on interval
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (interval === 'monthly') {
            const current = new Date(start);
            while(current <= end){
                dates.push(current.toISOString().split('T')[0]);
                current.setMonth(current.getMonth() + 1);
            }
        } else if (interval === 'yearly') {
            const current = new Date(start);
            while(current <= end){
                dates.push(current.toISOString().split('T')[0]);
                current.setFullYear(current.getFullYear() + 1);
            }
        } else {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid interval. Use "monthly" or "yearly"'
            }, {
                status: 400
            });
        }
        const spyData = [];
        for (const date of dates){
            try {
                const response = await fetch(`${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SPY-Data-Service/1.0'
                    }
                });
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
                await new Promise((resolve)=>setTimeout(resolve, 150));
            } catch (error) {
                console.error(`Error fetching ${ticker} data for ${date}:`, error);
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
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
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch interval SPY data'
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
        // Test fetch of a single SPY data point to verify service health
        const testDate = '2024-01-02';
        const response = await fetch(`${request.nextUrl.origin}/api/market-cap?ticker=SPY&date=${testDate}`, {
            method: 'GET',
            headers: {
                'User-Agent': 'SPY-Health-Check/1.0'
            }
        });
        if (response.ok) {
            return new Response(null, {
                status: 200,
                headers: {
                    'X-Service-Status': 'healthy',
                    'Cache-Control': 'no-cache'
                }
            });
        } else {
            return new Response(null, {
                status: 503,
                headers: {
                    'X-Service-Status': 'degraded',
                    'Cache-Control': 'no-cache'
                }
            });
        }
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

//# sourceMappingURL=%5Broot-of-the-server%5D__285f87fc._.js.map