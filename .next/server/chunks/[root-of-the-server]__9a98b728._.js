module.exports = {

"[project]/.next-internal/server/app/api/backtesting/route/actions.js [app-rsc] (server actions loader, ecmascript)": ((__turbopack_context__) => {

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
"[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "addNewStocksProportionally": ()=>addNewStocksProportionally,
    "calculateAnnualizedReturn": ()=>calculateAnnualizedReturn,
    "calculateEqualWeights": ()=>calculateEqualWeights,
    "calculateMarketCapWeights": ()=>calculateMarketCapWeights,
    "calculatePortfolioValue": ()=>calculatePortfolioValue,
    "calculateShares": ()=>calculateShares,
    "calculateTotalReturn": ()=>calculateTotalReturn,
    "cleanupHoldings": ()=>cleanupHoldings,
    "formatCurrency": ()=>formatCurrency,
    "formatPercentage": ()=>formatPercentage,
    "getAvailableStocks": ()=>getAvailableStocks,
    "getPortfolioStats": ()=>getPortfolioStats,
    "rebalancePortfolio": ()=>rebalancePortfolio,
    "sortHoldingsByValue": ()=>sortHoldingsByValue,
    "updatePortfolioWeights": ()=>updatePortfolioWeights,
    "validateHoldings": ()=>validateHoldings
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
function getAvailableStocks(stocks, date) {
    return stocks.filter((stock)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDateInRange"])(date, stock.startDate, stock.endDate));
}
function calculateEqualWeights(stockCount) {
    const weight = 1 / stockCount;
    return Array(stockCount).fill(weight);
}
function calculateMarketCapWeights(priceData) {
    const totalMarketCap = priceData.reduce((sum, data)=>sum + data.marketCap, 0);
    if (totalMarketCap === 0) {
        return calculateEqualWeights(priceData.length);
    }
    return priceData.map((data)=>data.marketCap / totalMarketCap);
}
function calculateShares(dollarAmount, price) {
    if (price <= 0) return 0;
    return Math.floor(dollarAmount / price);
}
function calculatePortfolioValue(holdings, priceData) {
    let totalValue = 0;
    holdings.forEach((holding)=>{
        const currentPrice = priceData.find((p)=>p.ticker === holding.ticker);
        if (currentPrice) {
            totalValue += holding.shares * currentPrice.adjustedPrice;
        }
    });
    return totalValue;
}
function updatePortfolioWeights(holdings, totalValue) {
    return holdings.map((holding)=>({
            ...holding,
            weight: totalValue > 0 ? holding.value / totalValue : 0
        }));
}
function rebalancePortfolio(currentHoldings, targetWeights, availableStocks, priceData, totalValue, cash = 0) {
    const trades = [];
    const newHoldings = [];
    let remainingCash = cash;
    // Calculate target dollar amounts
    const totalToInvest = totalValue + cash;
    availableStocks.forEach((stock, index)=>{
        const targetWeight = targetWeights[index] || 0;
        const targetValue = totalToInvest * targetWeight;
        const currentPrice = priceData.find((p)=>p.ticker === stock.ticker);
        if (!currentPrice || currentPrice.adjustedPrice <= 0) {
            return;
        }
        const currentHolding = currentHoldings.find((h)=>h.ticker === stock.ticker);
        const currentValue = currentHolding ? currentHolding.value : 0;
        const currentShares = currentHolding ? currentHolding.shares : 0;
        // Calculate required shares for target value
        const targetShares = Math.floor(targetValue / currentPrice.adjustedPrice);
        const sharesDiff = targetShares - currentShares;
        if (sharesDiff !== 0) {
            const tradeValue = Math.abs(sharesDiff) * currentPrice.adjustedPrice;
            if (sharesDiff > 0) {
                // Buy shares
                if (remainingCash >= tradeValue) {
                    remainingCash -= tradeValue;
                    trades.push({
                        ticker: stock.ticker,
                        action: 'buy',
                        shares: sharesDiff,
                        price: currentPrice.adjustedPrice,
                        value: tradeValue
                    });
                } else {
                    // Buy as many shares as possible with remaining cash
                    const affordableShares = Math.floor(remainingCash / currentPrice.adjustedPrice);
                    if (affordableShares > 0) {
                        const affordableValue = affordableShares * currentPrice.adjustedPrice;
                        remainingCash -= affordableValue;
                        trades.push({
                            ticker: stock.ticker,
                            action: 'buy',
                            shares: affordableShares,
                            price: currentPrice.adjustedPrice,
                            value: affordableValue
                        });
                    }
                }
            } else {
                // Sell shares
                remainingCash += tradeValue;
                trades.push({
                    ticker: stock.ticker,
                    action: 'sell',
                    shares: Math.abs(sharesDiff),
                    price: currentPrice.adjustedPrice,
                    value: tradeValue
                });
            }
        }
        // Update holdings
        const finalShares = currentShares + (sharesDiff > 0 ? Math.min(sharesDiff, Math.floor(remainingCash / currentPrice.adjustedPrice)) : sharesDiff);
        if (finalShares > 0) {
            newHoldings.push({
                ticker: stock.ticker,
                shares: finalShares,
                value: finalShares * currentPrice.adjustedPrice,
                weight: finalShares * currentPrice.adjustedPrice / totalToInvest,
                marketCap: currentPrice.marketCap
            });
        }
    });
    return {
        holdings: newHoldings,
        cash: remainingCash,
        trades
    };
}
function addNewStocksProportionally(currentHoldings, newStocks, newStockWeights, priceData, totalValue) {
    const newHoldings = [
        ...currentHoldings
    ];
    const totalNewWeight = newStockWeights.reduce((sum, weight)=>sum + weight, 0);
    const reductionFactor = 1 - totalNewWeight;
    // Reduce existing holdings proportionally
    newHoldings.forEach((holding)=>{
        holding.weight *= reductionFactor;
        holding.value = holding.weight * totalValue;
    });
    // Add new stocks
    newStocks.forEach((stock, index)=>{
        const weight = newStockWeights[index];
        const value = weight * totalValue;
        const currentPrice = priceData.find((p)=>p.ticker === stock.ticker);
        if (currentPrice && currentPrice.adjustedPrice > 0) {
            const shares = Math.floor(value / currentPrice.adjustedPrice);
            if (shares > 0) {
                newHoldings.push({
                    ticker: stock.ticker,
                    shares,
                    value: shares * currentPrice.adjustedPrice,
                    weight,
                    marketCap: currentPrice.marketCap
                });
            }
        }
    });
    return newHoldings;
}
function calculateAnnualizedReturn(startValue, endValue, years) {
    if (startValue <= 0 || years <= 0) return 0;
    return Math.pow(endValue / startValue, 1 / years) - 1;
}
function calculateTotalReturn(startValue, endValue) {
    if (startValue <= 0) return 0;
    return (endValue - startValue) / startValue;
}
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}
function formatPercentage(value, decimals = 2) {
    return `${(value * 100).toFixed(decimals)}%`;
}
function validateHoldings(holdings) {
    return holdings.every((holding)=>holding.shares >= 0 && holding.value >= 0 && holding.weight >= 0 && holding.weight <= 1);
}
function cleanupHoldings(holdings) {
    return holdings.filter((holding)=>holding.shares > 0);
}
function sortHoldingsByValue(holdings) {
    return [
        ...holdings
    ].sort((a, b)=>b.value - a.value);
}
function getPortfolioStats(holdings) {
    const totalValue = holdings.reduce((sum, holding)=>sum + holding.value, 0);
    const sortedHoldings = sortHoldingsByValue(holdings);
    return {
        totalValue,
        stockCount: holdings.length,
        largestHolding: sortedHoldings[0] || null,
        topConcentration: sortedHoldings[0]?.weight || 0
    };
}
}),
"[project]/src/lib/strategies/equalWeightBuyHold.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "getEqualWeightBuyHoldDescription": ()=>getEqualWeightBuyHoldDescription,
    "runEqualWeightBuyHold": ()=>runEqualWeightBuyHold,
    "validateEqualWeightBuyHoldParams": ()=>validateEqualWeightBuyHoldParams
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
async function runEqualWeightBuyHold(stocks, startYear, endYear, initialInvestment, priceDataFetcher) {
    console.log('🔄 Running Equal Weight Buy & Hold Strategy...');
    const yearlySnapshots = [];
    let currentHoldings = [];
    let cash = 0;
    // Initialize portfolio in start year
    const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
    const initialStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, startDate);
    console.log(`📅 ${startYear}: Initializing with ${initialStocks.length} stocks`);
    // Get initial price data
    const initialPriceData = [];
    for (const stock of initialStocks){
        const priceData = await priceDataFetcher(stock.ticker, startDate);
        if (priceData) {
            initialPriceData.push(priceData);
        }
    }
    // Calculate equal weights and initial positions
    const equalWeights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateEqualWeights"])(initialPriceData.length);
    initialPriceData.forEach((priceData, index)=>{
        const allocation = initialInvestment * equalWeights[index];
        const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(allocation, priceData.adjustedPrice);
        const actualValue = shares * priceData.adjustedPrice;
        if (shares > 0) {
            currentHoldings.push({
                ticker: priceData.ticker,
                shares,
                value: actualValue,
                weight: equalWeights[index],
                marketCap: priceData.marketCap
            });
        }
        cash += allocation - actualValue; // Add leftover cash
    });
    // Record initial snapshot
    const initialTotalValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0) + cash;
    yearlySnapshots.push({
        date: startDate,
        totalValue: initialTotalValue,
        holdings: [
            ...currentHoldings
        ],
        cash
    });
    // Process each subsequent year
    const yearsArray = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsInRange"])(startYear + 1, endYear);
    for (const year of yearsArray){
        console.log(`📅 ${year}: Processing year...`);
        const yearDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(year);
        const availableStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, yearDate);
        // Get current prices for existing holdings
        const currentPriceData = [];
        for (const holding of currentHoldings){
            const priceData = await priceDataFetcher(holding.ticker, yearDate);
            if (priceData) {
                currentPriceData.push(priceData);
            }
        }
        // Update current portfolio value
        currentHoldings = currentHoldings.map((holding)=>{
            const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
            if (currentPrice) {
                return {
                    ...holding,
                    value: holding.shares * currentPrice.adjustedPrice
                };
            }
            return holding;
        }).filter((holding)=>holding.value > 0); // Remove stocks that no longer have price data
        const currentPortfolioValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0);
        const totalValue = currentPortfolioValue + cash;
        // Check for new stocks
        const currentTickers = new Set(currentHoldings.map((h)=>h.ticker));
        const newStocks = availableStocks.filter((stock)=>!currentTickers.has(stock.ticker));
        if (newStocks.length > 0) {
            console.log(`  📈 Adding ${newStocks.length} new stocks`);
            // Get price data for new stocks
            const newStockPriceData = [];
            for (const stock of newStocks){
                const priceData = await priceDataFetcher(stock.ticker, yearDate);
                if (priceData) {
                    newStockPriceData.push(priceData);
                }
            }
            if (newStockPriceData.length > 0) {
                // Calculate new allocation: equal weight for all stocks (existing + new)
                const totalStockCount = currentHoldings.length + newStockPriceData.length;
                const targetWeightPerStock = 1 / totalStockCount;
                // Calculate how much to allocate to new stocks
                const newStockWeights = Array(newStockPriceData.length).fill(targetWeightPerStock);
                // Add new stocks with proportional reduction of existing holdings
                const updatedHoldings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["addNewStocksProportionally"])(currentHoldings, newStocks.slice(0, newStockPriceData.length), newStockWeights, newStockPriceData, totalValue);
                // Execute trades to achieve new allocation
                // Reduce existing positions proportionally
                const reductionFactor = 1 - newStockPriceData.length * targetWeightPerStock;
                currentHoldings.forEach((holding)=>{
                    const targetShares = Math.floor(holding.shares * reductionFactor);
                    const sharesToSell = holding.shares - targetShares;
                    if (sharesToSell > 0) {
                        const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
                        if (currentPrice) {
                            cash += sharesToSell * currentPrice.adjustedPrice;
                            holding.shares = targetShares;
                            holding.value = holding.shares * currentPrice.adjustedPrice;
                        }
                    }
                });
                // Buy new stocks
                newStockPriceData.forEach((priceData, index)=>{
                    const allocation = totalValue * targetWeightPerStock;
                    const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(allocation, priceData.adjustedPrice);
                    const cost = shares * priceData.adjustedPrice;
                    if (shares > 0 && cost <= cash) {
                        cash -= cost;
                        currentHoldings.push({
                            ticker: priceData.ticker,
                            shares,
                            value: cost,
                            weight: targetWeightPerStock,
                            marketCap: priceData.marketCap
                        });
                    }
                });
            }
        }
        // Update weights based on current values
        const newTotalValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0) + cash;
        currentHoldings = currentHoldings.map((holding)=>({
                ...holding,
                weight: newTotalValue > 0 ? holding.value / newTotalValue : 0
            }));
        // Record yearly snapshot
        yearlySnapshots.push({
            date: yearDate,
            totalValue: newTotalValue,
            holdings: [
                ...currentHoldings
            ],
            cash
        });
        console.log(`  💰 Portfolio value: $${newTotalValue.toLocaleString()}`);
        console.log(`  📊 Holdings: ${currentHoldings.length} stocks`);
    }
    // Calculate final results
    const startValue = yearlySnapshots[0].totalValue;
    const endValue = yearlySnapshots[yearlySnapshots.length - 1].totalValue;
    const totalReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateTotalReturn"])(startValue, endValue);
    const yearCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsBetweenDates"])(yearlySnapshots[0].date, yearlySnapshots[yearlySnapshots.length - 1].date);
    const annualizedReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateAnnualizedReturn"])(startValue, endValue, yearCount);
    console.log('✅ Equal Weight Buy & Hold Strategy completed');
    console.log(`📈 Total Return: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`📊 Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
    return {
        strategy: 'Equal Weight Buy & Hold',
        startValue,
        endValue,
        totalReturn,
        annualizedReturn,
        yearlySnapshots
    };
}
function validateEqualWeightBuyHoldParams(stocks, startYear, endYear, initialInvestment) {
    const errors = [];
    if (!stocks || stocks.length === 0) {
        errors.push('No stocks provided');
    }
    if (startYear >= endYear) {
        errors.push('Start year must be before end year');
    }
    if (initialInvestment <= 0) {
        errors.push('Initial investment must be positive');
    }
    if (stocks && stocks.length > 0) {
        const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
        const initialStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, startDate);
        if (initialStocks.length === 0) {
            errors.push(`No stocks available at start date (${startDate})`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function getEqualWeightBuyHoldDescription() {
    return `
    Equal Weight Buy & Hold Strategy:
    
    1. Initially invests equal amounts in all available stocks
    2. When new stocks join the index, allocates equal weight to them
    3. Reduces existing holdings proportionally to make room for new stocks
    4. No periodic rebalancing - positions grow/shrink with market movements
    5. Maintains buy-and-hold approach throughout the investment period
    
    This strategy provides diversification benefits while minimizing transaction costs
    by avoiding frequent rebalancing.
  `;
}
}),
"[project]/src/lib/strategies/marketCapBuyHold.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "runMarketCapBuyHold": ()=>runMarketCapBuyHold,
    "validateMarketCapBuyHoldParams": ()=>validateMarketCapBuyHoldParams
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
async function runMarketCapBuyHold(stocks, startYear, endYear, initialInvestment, priceDataFetcher) {
    console.log('🔄 Running Market Cap Weighted Buy & Hold Strategy...');
    const yearlySnapshots = [];
    let currentHoldings = [];
    let cash = 0;
    // Initialize portfolio in start year
    const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
    const initialStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, startDate);
    console.log(`📅 ${startYear}: Initializing with ${initialStocks.length} stocks`);
    // Get initial price data
    const initialPriceData = [];
    for (const stock of initialStocks){
        const priceData = await priceDataFetcher(stock.ticker, startDate);
        if (priceData) {
            initialPriceData.push(priceData);
        }
    }
    if (initialPriceData.length === 0) {
        throw new Error('No price data available for initial stocks');
    }
    // Calculate market cap weights and initial positions
    const marketCapWeights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateMarketCapWeights"])(initialPriceData);
    initialPriceData.forEach((priceData, index)=>{
        const allocation = initialInvestment * marketCapWeights[index];
        const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(allocation, priceData.adjustedPrice);
        const actualValue = shares * priceData.adjustedPrice;
        if (shares > 0) {
            currentHoldings.push({
                ticker: priceData.ticker,
                shares,
                value: actualValue,
                weight: marketCapWeights[index],
                marketCap: priceData.marketCap
            });
        }
        cash += allocation - actualValue;
    });
    // Record initial snapshot
    const initialTotalValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0) + cash;
    yearlySnapshots.push({
        date: startDate,
        totalValue: initialTotalValue,
        holdings: [
            ...currentHoldings
        ],
        cash
    });
    console.log(`  💰 Initial portfolio value: $${initialTotalValue.toLocaleString()}`);
    // Process each subsequent year
    const subsequentYears = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsInRange"])(startYear + 1, endYear);
    for (const currentYear of subsequentYears){
        console.log(`📅 ${currentYear}: Processing year...`);
        const yearDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(currentYear);
        const availableStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, yearDate);
        // Get current prices for existing holdings
        const currentPriceData = [];
        for (const holding of currentHoldings){
            const priceData = await priceDataFetcher(holding.ticker, yearDate);
            if (priceData) {
                currentPriceData.push(priceData);
            }
        }
        // Update current portfolio value with new prices
        currentHoldings = currentHoldings.map((holding)=>{
            const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
            if (currentPrice) {
                return {
                    ...holding,
                    value: holding.shares * currentPrice.adjustedPrice,
                    marketCap: currentPrice.marketCap
                };
            }
            return holding;
        }).filter((holding)=>holding.value > 0);
        const currentPortfolioValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0);
        const totalValue = currentPortfolioValue + cash;
        // Check for new stocks
        const currentTickers = new Set(currentHoldings.map((h)=>h.ticker));
        const newStocks = availableStocks.filter((stock)=>!currentTickers.has(stock.ticker));
        if (newStocks.length > 0) {
            console.log(`  📈 Adding ${newStocks.length} new stocks`);
            // Get price data for new stocks
            const newStockPriceData = [];
            for (const stock of newStocks){
                const priceData = await priceDataFetcher(stock.ticker, yearDate);
                if (priceData) {
                    newStockPriceData.push(priceData);
                }
            }
            if (newStockPriceData.length > 0) {
                // Calculate market cap weights for ALL stocks (existing + new)
                const allPriceData = [
                    ...currentPriceData,
                    ...newStockPriceData
                ];
                const allMarketCapWeights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateMarketCapWeights"])(allPriceData);
                // Determine weights for new stocks only
                const newStockWeights = allMarketCapWeights.slice(currentPriceData.length);
                const totalNewWeight = newStockWeights.reduce((sum, weight)=>sum + weight, 0);
                let cashFromSales = 0;
                currentHoldings.forEach((holding, index)=>{
                    const newTargetWeight = allMarketCapWeights[index];
                    const currentWeight = holding.value / totalValue;
                    if (newTargetWeight < currentWeight) {
                        const targetValue = totalValue * newTargetWeight;
                        const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
                        if (currentPrice) {
                            const targetShares = Math.floor(targetValue / currentPrice.adjustedPrice);
                            const sharesToSell = holding.shares - targetShares;
                            if (sharesToSell > 0) {
                                cashFromSales += sharesToSell * currentPrice.adjustedPrice;
                                holding.shares = targetShares;
                                holding.value = holding.shares * currentPrice.adjustedPrice;
                                holding.weight = newTargetWeight;
                            }
                        }
                    }
                });
                cash += cashFromSales;
                // Buy new stocks according to their market cap weights
                newStockPriceData.forEach((priceData, index)=>{
                    const weight = newStockWeights[index];
                    const allocation = totalValue * weight;
                    const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(allocation, priceData.adjustedPrice);
                    const cost = shares * priceData.adjustedPrice;
                    if (shares > 0 && cost <= cash) {
                        cash -= cost;
                        currentHoldings.push({
                            ticker: priceData.ticker,
                            shares,
                            value: cost,
                            weight,
                            marketCap: priceData.marketCap
                        });
                    }
                });
            }
        }
        // Update weights based on current values
        const newTotalValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0) + cash;
        currentHoldings = currentHoldings.map((holding)=>({
                ...holding,
                weight: newTotalValue > 0 ? holding.value / newTotalValue : 0
            }));
        // Record yearly snapshot
        yearlySnapshots.push({
            date: yearDate,
            totalValue: newTotalValue,
            holdings: [
                ...currentHoldings
            ],
            cash
        });
        console.log(`  💰 Portfolio value: $${newTotalValue.toLocaleString()}`);
        console.log(`  📊 Holdings: ${currentHoldings.length} stocks`);
    }
    // Calculate final results
    const startValue = yearlySnapshots[0].totalValue;
    const endValue = yearlySnapshots[yearlySnapshots.length - 1].totalValue;
    const totalReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateTotalReturn"])(startValue, endValue);
    const timeSpan = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsBetweenDates"])(yearlySnapshots[0].date, yearlySnapshots[yearlySnapshots.length - 1].date);
    const annualizedReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateAnnualizedReturn"])(startValue, endValue, timeSpan);
    console.log('✅ Market Cap Weighted Buy & Hold Strategy completed');
    console.log(`📈 Total Return: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`📊 Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
    return {
        strategy: 'Market Cap Weighted Buy & Hold',
        startValue,
        endValue,
        totalReturn,
        annualizedReturn,
        yearlySnapshots
    };
}
function validateMarketCapBuyHoldParams(stocks, startYear, endYear, initialInvestment) {
    const errors = [];
    if (!stocks || stocks.length === 0) {
        errors.push('No stocks provided');
    }
    if (startYear >= endYear) {
        errors.push('Start year must be before end year');
    }
    if (initialInvestment <= 0) {
        errors.push('Initial investment must be positive');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
}),
"[project]/src/lib/strategies/equalWeightRebalanced.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "calculateRebalancingStats": ()=>calculateRebalancingStats,
    "getEqualWeightRebalancedDescription": ()=>getEqualWeightRebalancedDescription,
    "runEqualWeightRebalanced": ()=>runEqualWeightRebalanced,
    "validateEqualWeightRebalancedParams": ()=>validateEqualWeightRebalancedParams
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
async function runEqualWeightRebalanced(stocks, startYear, endYear, initialInvestment, priceDataFetcher) {
    console.log('🔄 Running Equal Weight Rebalanced Strategy...');
    const yearlySnapshots = [];
    let currentHoldings = [];
    let cash = initialInvestment;
    // Process each year (including start year)
    const yearsArray = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsInRange"])(startYear, endYear);
    for (const year of yearsArray){
        console.log(`📅 ${year}: Rebalancing portfolio...`);
        const yearDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(year);
        const availableStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, yearDate);
        console.log(`  📊 Available stocks: ${availableStocks.length}`);
        if (availableStocks.length === 0) {
            console.log(`  ⚠️  No stocks available in ${year}`);
            continue;
        }
        // Get current prices for all available stocks
        const currentPriceData = [];
        for (const stock of availableStocks){
            const priceData = await priceDataFetcher(stock.ticker, yearDate);
            if (priceData) {
                currentPriceData.push(priceData);
            }
        }
        if (currentPriceData.length === 0) {
            console.log(`  ❌ No price data available for ${year}`);
            continue;
        }
        // Calculate current portfolio value
        let currentPortfolioValue = 0;
        if (currentHoldings.length > 0) {
            currentPortfolioValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculatePortfolioValue"])(currentHoldings, currentPriceData);
        }
        const totalValue = currentPortfolioValue + cash;
        console.log(`  💰 Total value before rebalancing: $${totalValue.toLocaleString()}`);
        // COMPLETE REBALANCING - Sell all positions first
        if (currentHoldings.length > 0) {
            console.log(`  🔄 Liquidating ${currentHoldings.length} existing positions`);
            // Sell all current holdings
            for (const holding of currentHoldings){
                const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
                if (currentPrice) {
                    const saleValue = holding.shares * currentPrice.adjustedPrice;
                    cash += saleValue;
                    console.log(`    💸 Sold ${holding.shares} shares of ${holding.ticker} for $${saleValue.toLocaleString()}`);
                }
            }
            // Clear holdings
            currentHoldings = [];
        }
        // Calculate equal weights for all available stocks
        const equalWeights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateEqualWeights"])(currentPriceData.length);
        const targetValuePerStock = cash / currentPriceData.length;
        console.log(`  🎯 Target allocation per stock: $${targetValuePerStock.toLocaleString()}`);
        // Buy equal amounts of all available stocks
        let totalSpent = 0;
        currentPriceData.forEach((priceData, index)=>{
            const targetAllocation = cash * equalWeights[index];
            const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(targetAllocation, priceData.adjustedPrice);
            const actualCost = shares * priceData.adjustedPrice;
            if (shares > 0) {
                currentHoldings.push({
                    ticker: priceData.ticker,
                    shares,
                    value: actualCost,
                    weight: equalWeights[index],
                    marketCap: priceData.marketCap
                });
                totalSpent += actualCost;
                console.log(`    📈 Bought ${shares} shares of ${priceData.ticker} for $${actualCost.toLocaleString()}`);
            }
        });
        // Update remaining cash
        cash -= totalSpent;
        // Calculate final portfolio value
        const finalPortfolioValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0);
        const finalTotalValue = finalPortfolioValue + cash;
        // Update weights based on actual values
        currentHoldings = currentHoldings.map((holding)=>({
                ...holding,
                weight: finalTotalValue > 0 ? holding.value / finalTotalValue : 0
            }));
        // Record yearly snapshot
        yearlySnapshots.push({
            date: yearDate,
            totalValue: finalTotalValue,
            holdings: [
                ...currentHoldings
            ],
            cash
        });
        console.log(`  ✅ Rebalancing complete`);
        console.log(`  💰 Final portfolio value: $${finalTotalValue.toLocaleString()}`);
        console.log(`  💵 Remaining cash: $${cash.toLocaleString()}`);
        console.log(`  📊 New holdings: ${currentHoldings.length} stocks at ${(100 / currentHoldings.length).toFixed(2)}% each`);
        // Validation check
        const totalWeight = currentHoldings.reduce((sum, h)=>sum + h.weight, 0);
        if (Math.abs(totalWeight - 1) > 0.01 && currentHoldings.length > 0) {
            console.log(`  ⚠️  Weight sum: ${(totalWeight * 100).toFixed(2)}% (expected 100%)`);
        }
    }
    if (yearlySnapshots.length === 0) {
        throw new Error('No valid snapshots created - check data availability');
    }
    // Calculate final results
    const startValue = yearlySnapshots[0].totalValue;
    const endValue = yearlySnapshots[yearlySnapshots.length - 1].totalValue;
    const totalReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateTotalReturn"])(startValue, endValue);
    const yearCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsBetweenDates"])(yearlySnapshots[0].date, yearlySnapshots[yearlySnapshots.length - 1].date);
    const annualizedReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateAnnualizedReturn"])(startValue, endValue, yearCount);
    console.log('✅ Equal Weight Rebalanced Strategy completed');
    console.log(`📈 Total Return: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`📊 Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
    console.log(`🔄 Total rebalancing events: ${yearlySnapshots.length}`);
    return {
        strategy: 'Equal Weight Rebalanced Annually',
        startValue,
        endValue,
        totalReturn,
        annualizedReturn,
        yearlySnapshots
    };
}
function validateEqualWeightRebalancedParams(stocks, startYear, endYear, initialInvestment) {
    const errors = [];
    if (!stocks || stocks.length === 0) {
        errors.push('No stocks provided');
    }
    if (startYear >= endYear) {
        errors.push('Start year must be before end year');
    }
    if (initialInvestment <= 0) {
        errors.push('Initial investment must be positive');
    }
    if (stocks && stocks.length > 0) {
        const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
        const initialStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, startDate);
        if (initialStocks.length === 0) {
            errors.push(`No stocks available at start date (${startDate})`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function getEqualWeightRebalancedDescription() {
    return `
    Equal Weight Rebalanced Annually Strategy:
    
    1. Each year, completely rebalances to equal weight across all available stocks
    2. Sells all existing positions and redistributes capital equally
    3. New stocks entering the index immediately get equal weight allocation
    4. Stocks leaving the index are sold during rebalancing
    5. Maintains precise equal weighting through annual rebalancing
    6. Higher transaction costs due to frequent trading
    
    This strategy provides maximum diversification and ensures no single stock
    dominates the portfolio, but generates more trading activity than buy-and-hold
    approaches.
  `;
}
function calculateRebalancingStats(snapshots) {
    const rebalances = snapshots.length;
    const stockCounts = snapshots.map((s)=>s.holdings.length);
    return {
        totalRebalances: rebalances,
        averageStocksPerRebalance: stockCounts.reduce((sum, count)=>sum + count, 0) / rebalances,
        maxStocksInPortfolio: Math.max(...stockCounts),
        minStocksInPortfolio: Math.min(...stockCounts)
    };
}
}),
"[project]/src/lib/strategies/marketCapRebalanced.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "calculateConcentrationStats": ()=>calculateConcentrationStats,
    "getMarketCapRebalancedDescription": ()=>getMarketCapRebalancedDescription,
    "runMarketCapRebalanced": ()=>runMarketCapRebalanced,
    "validateMarketCapRebalancedParams": ()=>validateMarketCapRebalancedParams
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
async function runMarketCapRebalanced(stocks, startYear, endYear, initialInvestment, priceDataFetcher) {
    console.log('🔄 Running Market Cap Weighted Rebalanced Strategy...');
    const yearlySnapshots = [];
    let currentHoldings = [];
    let cash = initialInvestment;
    // Process each year (including start year)
    const yearsArray = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsInRange"])(startYear, endYear);
    for (const year of yearsArray){
        console.log(`📅 ${year}: Rebalancing portfolio to market cap weights...`);
        const yearDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(year);
        const availableStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, yearDate);
        console.log(`  📊 Available stocks: ${availableStocks.length}`);
        if (availableStocks.length === 0) {
            console.log(`  ⚠️  No stocks available in ${year}`);
            continue;
        }
        // Get current prices and market caps for all available stocks
        const currentPriceData = [];
        for (const stock of availableStocks){
            const priceData = await priceDataFetcher(stock.ticker, yearDate);
            if (priceData && priceData.marketCap > 0) {
                currentPriceData.push(priceData);
            }
        }
        if (currentPriceData.length === 0) {
            console.log(`  ❌ No valid price/market cap data available for ${year}`);
            continue;
        }
        // Calculate current portfolio value
        let currentPortfolioValue = 0;
        if (currentHoldings.length > 0) {
            currentPortfolioValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculatePortfolioValue"])(currentHoldings, currentPriceData);
        }
        const totalValue = currentPortfolioValue + cash;
        console.log(`  💰 Total value before rebalancing: $${totalValue.toLocaleString()}`);
        // COMPLETE REBALANCING - Sell all positions first
        if (currentHoldings.length > 0) {
            console.log(`  🔄 Liquidating ${currentHoldings.length} existing positions`);
            // Sell all current holdings
            for (const holding of currentHoldings){
                const currentPrice = currentPriceData.find((p)=>p.ticker === holding.ticker);
                if (currentPrice) {
                    const saleValue = holding.shares * currentPrice.adjustedPrice;
                    cash += saleValue;
                    console.log(`    💸 Sold ${holding.shares} shares of ${holding.ticker} for $${saleValue.toLocaleString()}`);
                } else {
                    // Stock was delisted or no longer available
                    console.log(`    ⚠️  ${holding.ticker} no longer available (delisted)`);
                }
            }
            // Clear holdings
            currentHoldings = [];
        }
        // Calculate market cap weights
        const marketCapWeights = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateMarketCapWeights"])(currentPriceData);
        // Log market cap distribution for insight
        const totalMarketCap = currentPriceData.reduce((sum, data)=>sum + data.marketCap, 0);
        console.log(`  📈 Total market cap: $${(totalMarketCap / 1e9).toFixed(1)}B`);
        // Show top 5 largest companies by market cap
        const sortedByMarketCap = [
            ...currentPriceData
        ].sort((a, b)=>b.marketCap - a.marketCap).slice(0, 5);
        console.log('  🏆 Top 5 companies by market cap:');
        sortedByMarketCap.forEach((data, index)=>{
            const weight = data.marketCap / totalMarketCap;
            console.log(`    ${index + 1}. ${data.ticker}: ${(weight * 100).toFixed(1)}% ($${(data.marketCap / 1e9).toFixed(1)}B)`);
        });
        // Buy stocks according to market cap weights
        let totalSpent = 0;
        currentPriceData.forEach((priceData, index)=>{
            const weight = marketCapWeights[index];
            const targetAllocation = cash * weight;
            const shares = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateShares"])(targetAllocation, priceData.adjustedPrice);
            const actualCost = shares * priceData.adjustedPrice;
            if (shares > 0) {
                currentHoldings.push({
                    ticker: priceData.ticker,
                    shares,
                    value: actualCost,
                    weight,
                    marketCap: priceData.marketCap
                });
                totalSpent += actualCost;
                // Only log significant positions (>0.1% weight) to avoid spam
                if (weight > 0.001) {
                    console.log(`    📈 Bought ${shares} shares of ${priceData.ticker} (${(weight * 100).toFixed(2)}%) for $${actualCost.toLocaleString()}`);
                }
            }
        });
        // Update remaining cash
        cash -= totalSpent;
        // Calculate final portfolio value
        const finalPortfolioValue = currentHoldings.reduce((sum, h)=>sum + h.value, 0);
        const finalTotalValue = finalPortfolioValue + cash;
        // Update weights based on actual values (should be very close to target weights)
        currentHoldings = currentHoldings.map((holding)=>({
                ...holding,
                weight: finalTotalValue > 0 ? holding.value / finalTotalValue : 0
            }));
        // Record yearly snapshot
        yearlySnapshots.push({
            date: yearDate,
            totalValue: finalTotalValue,
            holdings: [
                ...currentHoldings
            ],
            cash
        });
        console.log(`  ✅ Rebalancing complete`);
        console.log(`  💰 Final portfolio value: $${finalTotalValue.toLocaleString()}`);
        console.log(`  💵 Remaining cash: $${cash.toLocaleString()} (${(cash / finalTotalValue * 100).toFixed(2)}%)`);
        console.log(`  📊 New holdings: ${currentHoldings.length} stocks`);
        // Show concentration metrics
        const topHoldings = [
            ...currentHoldings
        ].sort((a, b)=>b.weight - a.weight).slice(0, 5);
        const top5Weight = topHoldings.reduce((sum, h)=>sum + h.weight, 0);
        const top10Weight = [
            ...currentHoldings
        ].sort((a, b)=>b.weight - a.weight).slice(0, 10).reduce((sum, h)=>sum + h.weight, 0);
        console.log(`  🎯 Top 5 holdings: ${(top5Weight * 100).toFixed(1)}% of portfolio`);
        console.log(`  🎯 Top 10 holdings: ${(top10Weight * 100).toFixed(1)}% of portfolio`);
        // Validation check
        const totalWeight = currentHoldings.reduce((sum, h)=>sum + h.weight, 0);
        if (Math.abs(totalWeight - 1) > 0.01 && currentHoldings.length > 0) {
            console.log(`  ⚠️  Weight sum: ${(totalWeight * 100).toFixed(2)}% (expected ~100%)`);
        }
    }
    if (yearlySnapshots.length === 0) {
        throw new Error('No valid snapshots created - check data availability');
    }
    // Calculate final results
    const startValue = yearlySnapshots[0].totalValue;
    const endValue = yearlySnapshots[yearlySnapshots.length - 1].totalValue;
    const totalReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateTotalReturn"])(startValue, endValue);
    const yearCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsBetweenDates"])(yearlySnapshots[0].date, yearlySnapshots[yearlySnapshots.length - 1].date);
    const annualizedReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateAnnualizedReturn"])(startValue, endValue, yearCount);
    console.log('✅ Market Cap Weighted Rebalanced Strategy completed');
    console.log(`📈 Total Return: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`📊 Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
    console.log(`🔄 Total rebalancing events: ${yearlySnapshots.length}`);
    return {
        strategy: 'Market Cap Weighted Rebalanced Annually',
        startValue,
        endValue,
        totalReturn,
        annualizedReturn,
        yearlySnapshots
    };
}
function validateMarketCapRebalancedParams(stocks, startYear, endYear, initialInvestment) {
    const errors = [];
    if (!stocks || stocks.length === 0) {
        errors.push('No stocks provided');
    }
    if (startYear >= endYear) {
        errors.push('Start year must be before end year');
    }
    if (initialInvestment <= 0) {
        errors.push('Initial investment must be positive');
    }
    if (stocks && stocks.length > 0) {
        const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
        const initialStocks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAvailableStocks"])(stocks, startDate);
        if (initialStocks.length === 0) {
            errors.push(`No stocks available at start date (${startDate})`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function getMarketCapRebalancedDescription() {
    return `
    Market Cap Weighted Rebalanced Annually Strategy:
    
    1. Each year, completely rebalances to market cap weights across all available stocks
    2. Larger companies receive proportionally larger allocations based on market cap
    3. Sells all positions and redistributes capital according to current market caps
    4. New stocks entering the index get market cap weighted allocation
    5. Stocks leaving the index are sold during rebalancing
    6. Maintains market consensus weighting through annual rebalancing
    7. Higher transaction costs due to frequent trading
    
    This strategy follows institutional index fund approaches, concentrating in 
    larger companies while maintaining market-representative weightings through
    periodic rebalancing.
  `;
}
function calculateConcentrationStats(snapshots) {
    const stats = snapshots.map((snapshot)=>{
        const sortedHoldings = [
            ...snapshot.holdings
        ].sort((a, b)=>b.weight - a.weight);
        const top5Weight = sortedHoldings.slice(0, 5).reduce((sum, h)=>sum + h.weight, 0);
        const top10Weight = sortedHoldings.slice(0, 10).reduce((sum, h)=>sum + h.weight, 0);
        const maxWeight = sortedHoldings[0]?.weight || 0;
        return {
            top5Weight,
            top10Weight,
            maxWeight,
            stockCount: snapshot.holdings.length
        };
    });
    const avgTop5 = stats.reduce((sum, s)=>sum + s.top5Weight, 0) / stats.length;
    const avgTop10 = stats.reduce((sum, s)=>sum + s.top10Weight, 0) / stats.length;
    const maxWeight = Math.max(...stats.map((s)=>s.maxWeight));
    const avgStocks = stats.reduce((sum, s)=>sum + s.stockCount, 0) / stats.length;
    return {
        averageTop5Concentration: avgTop5,
        averageTop10Concentration: avgTop10,
        maxSingleStockWeight: maxWeight,
        averageNumberOfStocks: avgStocks
    };
}
}),
"[project]/src/lib/strategies/strategyRunner.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "createBacktestConfig": ()=>createBacktestConfig,
    "formatResults": ()=>formatResults,
    "getAvailableStrategies": ()=>getAvailableStrategies,
    "runAllStrategies": ()=>runAllStrategies,
    "validateBacktestConfig": ()=>validateBacktestConfig
});
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$equalWeightBuyHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/strategies/equalWeightBuyHold.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$marketCapBuyHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/strategies/marketCapBuyHold.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$equalWeightRebalanced$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/strategies/equalWeightRebalanced.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$marketCapRebalanced$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/strategies/marketCapRebalanced.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/portfolioUtils.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/dateUtils.ts [app-route] (ecmascript)");
;
;
;
;
;
;
async function runAllStrategies(config, priceDataFetcher, spyDataFetcher) {
    console.log('🚀 Starting comprehensive portfolio backtest...');
    console.log(`📅 Period: ${config.startYear} - ${config.endYear}`);
    console.log(`💰 Initial Investment: $${config.initialInvestment.toLocaleString()}`);
    console.log(`📊 Total Stocks: ${config.stocks.length}`);
    const startTime = Date.now();
    const results = [];
    // Get SPY benchmark data
    console.log('\n📈 Fetching SPY benchmark data...');
    const spyData = await spyDataFetcher(config.startYear, config.endYear);
    // Calculate SPY benchmark performance
    const spyBenchmark = calculateSPYBenchmark(spyData, config.startYear, config.endYear, config.initialInvestment);
    console.log(`📊 SPY Benchmark Return: ${(spyBenchmark.totalReturn * 100).toFixed(2)}%`);
    // Define which strategies to run
    const strategiesToRun = [
        {
            name: 'Equal Weight Buy & Hold',
            enabled: config.strategies.includes('equalWeightBuyHold')
        },
        {
            name: 'Market Cap Weighted Buy & Hold',
            enabled: config.strategies.includes('marketCapBuyHold')
        },
        {
            name: 'Equal Weight Rebalanced Annually',
            enabled: config.strategies.includes('equalWeightRebalanced')
        },
        {
            name: 'Market Cap Weighted Rebalanced Annually',
            enabled: config.strategies.includes('marketCapRebalanced')
        }
    ];
    const enabledStrategies = strategiesToRun.filter((s)=>s.enabled);
    console.log(`\n🎯 Running ${enabledStrategies.length} strategies...`);
    // Run Equal Weight Buy & Hold
    if (config.strategies.includes('equalWeightBuyHold')) {
        console.log('\n🔄 Running Strategy 1/4: Equal Weight Buy & Hold');
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$equalWeightBuyHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runEqualWeightBuyHold"])(config.stocks, config.startYear, config.endYear, config.initialInvestment, priceDataFetcher);
            results.push(result);
            console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
        } catch (error) {
            console.error('❌ Equal Weight Buy & Hold failed:', error);
        }
    }
    // Run Market Cap Weighted Buy & Hold
    if (config.strategies.includes('marketCapBuyHold')) {
        console.log('\n🔄 Running Strategy 2/4: Market Cap Weighted Buy & Hold');
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$marketCapBuyHold$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runMarketCapBuyHold"])(config.stocks, config.startYear, config.endYear, config.initialInvestment, priceDataFetcher);
            results.push(result);
            console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
        } catch (error) {
            console.error('❌ Market Cap Weighted Buy & Hold failed:', error);
        }
    }
    // Run Equal Weight Rebalanced
    if (config.strategies.includes('equalWeightRebalanced')) {
        console.log('\n🔄 Running Strategy 3/4: Equal Weight Rebalanced Annually');
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$equalWeightRebalanced$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runEqualWeightRebalanced"])(config.stocks, config.startYear, config.endYear, config.initialInvestment, priceDataFetcher);
            results.push(result);
            console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
        } catch (error) {
            console.error('❌ Equal Weight Rebalanced failed:', error);
        }
    }
    // Run Market Cap Weighted Rebalanced
    if (config.strategies.includes('marketCapRebalanced')) {
        console.log('\n🔄 Running Strategy 4/4: Market Cap Weighted Rebalanced Annually');
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$marketCapRebalanced$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runMarketCapRebalanced"])(config.stocks, config.startYear, config.endYear, config.initialInvestment, priceDataFetcher);
            results.push(result);
            console.log(`✅ Completed - Return: ${(result.totalReturn * 100).toFixed(2)}%`);
        } catch (error) {
            console.error('❌ Market Cap Weighted Rebalanced failed:', error);
        }
    }
    // Calculate summary statistics
    const executionTime = Date.now() - startTime;
    const summary = calculateSummary(results, spyBenchmark, executionTime);
    console.log('\n🎉 Backtest Complete!');
    console.log('='.repeat(50));
    console.log('📊 RESULTS SUMMARY');
    console.log('='.repeat(50));
    // Display results table
    console.log('\nStrategy Performance:');
    console.log('Strategy'.padEnd(35) + 'Total Return'.padEnd(15) + 'Annual Return'.padEnd(15) + 'Final Value');
    console.log('-'.repeat(80));
    results.forEach((result)=>{
        const totalRet = `${(result.totalReturn * 100).toFixed(2)}%`;
        const annualRet = `${(result.annualizedReturn * 100).toFixed(2)}%`;
        const finalVal = `$${result.endValue.toLocaleString()}`;
        console.log(result.strategy.padEnd(35) + totalRet.padEnd(15) + annualRet.padEnd(15) + finalVal);
    });
    // SPY Benchmark
    const spyTotalRet = `${(spyBenchmark.totalReturn * 100).toFixed(2)}%`;
    const spyAnnualRet = `${(spyBenchmark.annualizedReturn * 100).toFixed(2)}%`;
    const spyFinalVal = `$${spyBenchmark.endValue.toLocaleString()}`;
    console.log('-'.repeat(80));
    console.log('SPY Benchmark'.padEnd(35) + spyTotalRet.padEnd(15) + spyAnnualRet.padEnd(15) + spyFinalVal);
    console.log(`\n🏆 Best Strategy: ${summary.bestStrategy}`);
    console.log(`📉 Worst Strategy: ${summary.worstStrategy}`);
    console.log(`🎯 Strategies beating SPY: ${summary.spyOutperformers.length > 0 ? summary.spyOutperformers.join(', ') : 'None'}`);
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(1)} seconds`);
    return {
        strategies: results,
        spyBenchmark,
        summary
    };
}
/**
 * Calculate SPY benchmark performance
 */ function calculateSPYBenchmark(spyData, startYear, endYear, initialInvestment) {
    if (spyData.length === 0) {
        throw new Error('No SPY data available for benchmark');
    }
    // Find start and end data points
    const startDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(startYear);
    const endDate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getStartOfYearDate"])(endYear);
    const startPoint = spyData.find((d)=>d.date >= startDate) || spyData[0];
    const endPoint = spyData[spyData.length - 1];
    // Calculate SPY returns
    const sharesOwned = initialInvestment / startPoint.adjustedPrice;
    const endValue = sharesOwned * endPoint.adjustedPrice;
    const totalReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateTotalReturn"])(initialInvestment, endValue);
    const years = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$dateUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getYearsBetweenDates"])(startPoint.date, endPoint.date);
    const annualizedReturn = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$portfolioUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateAnnualizedReturn"])(initialInvestment, endValue, years);
    return {
        startValue: initialInvestment,
        endValue,
        totalReturn,
        annualizedReturn,
        data: spyData
    };
}
/**
 * Calculate summary statistics
 */ function calculateSummary(results, spyBenchmark, executionTime) {
    if (results.length === 0) {
        return {
            bestStrategy: 'None',
            worstStrategy: 'None',
            spyOutperformers: [],
            executionTime
        };
    }
    // Find best and worst strategies
    const bestStrategy = results.reduce((best, current)=>current.endValue > best.endValue ? current : best);
    const worstStrategy = results.reduce((worst, current)=>current.endValue < worst.endValue ? current : worst);
    // Find strategies that beat SPY
    const spyOutperformers = results.filter((result)=>result.endValue > spyBenchmark.endValue).map((result)=>result.strategy);
    return {
        bestStrategy: bestStrategy.strategy,
        worstStrategy: worstStrategy.strategy,
        spyOutperformers,
        executionTime
    };
}
function validateBacktestConfig(config) {
    const errors = [];
    if (!config.stocks || config.stocks.length === 0) {
        errors.push('No stocks provided in configuration');
    }
    if (config.startYear >= config.endYear) {
        errors.push('Start year must be before end year');
    }
    if (config.startYear < 1996 || config.endYear > 2025) {
        errors.push('Years must be between 1996 and 2025');
    }
    if (config.initialInvestment <= 0) {
        errors.push('Initial investment must be positive');
    }
    if (!config.strategies || config.strategies.length === 0) {
        errors.push('No strategies selected');
    }
    const validStrategies = [
        'equalWeightBuyHold',
        'marketCapBuyHold',
        'equalWeightRebalanced',
        'marketCapRebalanced'
    ];
    const invalidStrategies = config.strategies.filter((s)=>!validStrategies.includes(s));
    if (invalidStrategies.length > 0) {
        errors.push(`Invalid strategies: ${invalidStrategies.join(', ')}`);
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function getAvailableStrategies() {
    return [
        {
            id: 'equalWeightBuyHold',
            name: 'Equal Weight Buy & Hold',
            description: 'Start with equal weights, add new stocks proportionally, no rebalancing'
        },
        {
            id: 'marketCapBuyHold',
            name: 'Market Cap Weighted Buy & Hold',
            description: 'Start with market cap weights, add new stocks by market cap, no rebalancing'
        },
        {
            id: 'equalWeightRebalanced',
            name: 'Equal Weight Rebalanced Annually',
            description: 'Rebalance to equal weights across all stocks each year'
        },
        {
            id: 'marketCapRebalanced',
            name: 'Market Cap Weighted Rebalanced Annually',
            description: 'Rebalance to market cap weights across all stocks each year'
        }
    ];
}
function createBacktestConfig(stocks, startYear, endYear, initialInvestment = 1000000, strategies = [
    'equalWeightBuyHold',
    'marketCapBuyHold',
    'equalWeightRebalanced',
    'marketCapRebalanced'
]) {
    return {
        stocks,
        startYear,
        endYear,
        initialInvestment,
        strategies
    };
}
function formatResults(results) {
    let output = 'Portfolio Backtesting Results\n';
    output += '='.repeat(50) + '\n\n';
    results.strategies.forEach((strategy)=>{
        output += `${strategy.strategy}:\n`;
        output += `  Final Value: $${strategy.endValue.toLocaleString()}\n`;
        output += `  Total Return: ${(strategy.totalReturn * 100).toFixed(2)}%\n`;
        output += `  Annualized Return: ${(strategy.annualizedReturn * 100).toFixed(2)}%\n\n`;
    });
    output += `SPY Benchmark:\n`;
    output += `  Final Value: $${results.spyBenchmark.endValue.toLocaleString()}\n`;
    output += `  Total Return: ${(results.spyBenchmark.totalReturn * 100).toFixed(2)}%\n`;
    output += `  Annualized Return: ${(results.spyBenchmark.annualizedReturn * 100).toFixed(2)}%\n\n`;
    output += `Best Strategy: ${results.summary.bestStrategy}\n`;
    output += `Strategies beating SPY: ${results.summary.spyOutperformers.join(', ')}\n`;
    return output;
}
}),
"[externals]/fs [external] (fs, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}}),
"[externals]/path [external] (path, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}}),
"[externals]/stream [external] (stream, cjs)": ((__turbopack_context__) => {

var { m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}}),
"[project]/src/app/api/backtesting/route.ts [app-route] (ecmascript)": ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s({
    "GET": ()=>GET,
    "HEAD": ()=>HEAD,
    "OPTIONS": ()=>OPTIONS,
    "POST": ()=>POST
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$strategyRunner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/strategies/strategyRunner.ts [app-route] (ecmascript)");
;
;
// Rate limiting configuration
const RATE_LIMIT_DELAY = parseInt(process.env.BACKTEST_RATE_LIMIT_MS || '100');
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.BACKTEST_MAX_CONCURRENT_REQUESTS || '5');
async function POST(request) {
    try {
        const config = await request.json();
        // Validate configuration
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$strategyRunner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateBacktestConfig"])(config);
        if (!validation.isValid) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid configuration',
                details: validation.errors
            }, {
                status: 400
            });
        }
        console.log('🚀 Starting backtest API request...');
        console.log(`📅 Period: ${config.startYear} - ${config.endYear}`);
        console.log(`📊 Strategies: ${config.strategies.join(', ')}`);
        console.log(`💰 Initial Investment: $${config.initialInvestment.toLocaleString()}`);
        // Create a streaming response
        const stream = new ReadableStream({
            async start (controller) {
                const encoder = new TextEncoder();
                const sendProgress = (current, total, step)=>{
                    const progress = {
                        type: 'progress',
                        progress: {
                            current,
                            total,
                            step
                        }
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'));
                };
                const sendError = (error)=>{
                    const errorMsg = {
                        type: 'error',
                        error
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(errorMsg) + '\n'));
                    controller.close();
                };
                const sendResults = (results)=>{
                    const resultsMsg = {
                        type: 'results',
                        results
                    };
                    controller.enqueue(encoder.encode(JSON.stringify(resultsMsg) + '\n'));
                    controller.close();
                };
                try {
                    // Initialize progress
                    sendProgress(1, 10, 'Initializing backtesting environment...');
                    // Create price data fetcher with rate limiting
                    let requestCount = 0;
                    const priceDataFetcher = async (ticker, date)=>{
                        try {
                            requestCount++;
                            if (requestCount % 10 === 0) {
                                sendProgress(Math.min(2 + Math.floor(requestCount / 100), 8), 10, `Fetching price data... (${requestCount} requests)`);
                            }
                            // Add rate limiting delay
                            if (RATE_LIMIT_DELAY > 0) {
                                await new Promise((resolve)=>setTimeout(resolve, RATE_LIMIT_DELAY));
                            }
                            const response = await fetch(`${request.nextUrl.origin}/api/market-cap?ticker=${ticker}&date=${date}`, {
                                method: 'GET',
                                headers: {
                                    'User-Agent': 'Backtesting-Service/1.0'
                                }
                            });
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
                                marketCap: data.market_cap || data.price * data.shares_outstanding
                            };
                        } catch (error) {
                            console.error(`Error fetching data for ${ticker} on ${date}:`, error);
                            return null;
                        }
                    };
                    // Create SPY data fetcher
                    const spyDataFetcher = async (startYear, endYear)=>{
                        sendProgress(3, 10, 'Fetching SPY benchmark data...');
                        try {
                            const response = await fetch(`${request.nextUrl.origin}/api/spy-data?startYear=${startYear}&endYear=${endYear}`);
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
                    const results = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$strategies$2f$strategyRunner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runAllStrategies"])(config, priceDataFetcher, spyDataFetcher);
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
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        console.error('Backtesting API error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, {
            status: 500
        });
    }
}
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        if (action === 'sp500-stocks') {
            // Load S&P 500 historical data from CSV
            const fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
            const path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
            const Papa = __turbopack_context__.r("[project]/node_modules/papaparse/papaparse.js [app-route] (ecmascript)");
            const csvPath = path.join(process.cwd(), 'data', 'sp500-tickers.csv');
            if (!fs.existsSync(csvPath)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: 'S&P 500 data file not found'
                }, {
                    status: 404
                });
            }
            const csvContent = fs.readFileSync(csvPath, 'utf8');
            const parsed = Papa.parse(csvContent, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            });
            const stocks = parsed.data.map((row)=>({
                    ticker: row.ticker,
                    startDate: row.start_date,
                    endDate: row.end_date || null
                }));
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                stocks
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Invalid action parameter'
        }, {
            status: 400
        });
    } catch (error) {
        console.error('Error loading S&P 500 data:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load S&P 500 data'
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
/**
 * Utility function to load start-of-year dates
 */ async function loadStartOfYearDates() {
    try {
        const fs = __turbopack_context__.r("[externals]/fs [external] (fs, cjs)");
        const path = __turbopack_context__.r("[externals]/path [external] (path, cjs)");
        const Papa = __turbopack_context__.r("[project]/node_modules/papaparse/papaparse.js [app-route] (ecmascript)");
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
        const dates = {};
        if (parsed.data && parsed.data.length > 0) {
            const row = parsed.data[0];
            for (const [year, dateStr] of Object.entries(row)){
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
async function HEAD(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Cache-Control': 'no-cache'
        }
    });
}
}),

};

//# sourceMappingURL=%5Broot-of-the-server%5D__9a98b728._.js.map