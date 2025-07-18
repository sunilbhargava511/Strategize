import { 
  StrategyResult, 
  Stock, 
  PriceData, 
  PortfolioSnapshot, 
  PortfolioHolding 
} from '../../types/backtesting';
import { 
  getAvailableStocks, 
  calculateMarketCapWeights, 
  calculateShares,
  calculatePortfolioValue,
  calculateTotalReturn,
  calculateAnnualizedReturn
} from '../utils/portfolioUtils';
import { getStartOfYearDate, getYearsInRange, getYearsBetweenDates } from '../utils/dateUtils';

/**
 * Market Cap Weighted Rebalanced Strategy
 * 
 * Rules:
 * 1. Each year, rebalance the portfolio to market cap weights across all available stocks
 * 2. Sell overweighted positions and buy underweighted ones to match market cap ratios
 * 3. New stocks entering the index get market cap weighted allocation
 * 4. Stocks leaving the index are sold
 * 5. Complete rebalancing at the start of each year based on current market caps
 */

export async function runMarketCapRebalanced(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  priceDataFetcher: (ticker: string, date: string) => Promise<PriceData | null>
): Promise<StrategyResult> {
  console.log('🔄 Running Market Cap Weighted Rebalanced Strategy...');
  
  const yearlySnapshots: PortfolioSnapshot[] = [];
  let currentHoldings: PortfolioHolding[] = [];
  let cash = initialInvestment;

  // Process each year (including start year)
  const yearsArray = getYearsInRange(startYear, endYear);
  
  for (const year of yearsArray) {
    console.log(`📅 ${year}: Rebalancing portfolio to market cap weights...`);
    
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    console.log(`  📊 Available stocks: ${availableStocks.length}`);
    
    if (availableStocks.length === 0) {
      console.log(`  ⚠️  No stocks available in ${year}`);
      continue;
    }

    // Get current prices and market caps for all available stocks
    const currentPriceData: PriceData[] = [];
    for (const stock of availableStocks) {
      const priceData = await priceDataFetcher(stock.ticker, yearDate);
      if (priceData && priceData.marketCap > 0) { // Ensure we have valid market cap data
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
      currentPortfolioValue = calculatePortfolioValue(currentHoldings, currentPriceData);
    }
    
    const totalValue = currentPortfolioValue + cash;
    console.log(`  💰 Total value before rebalancing: $${totalValue.toLocaleString()}`);

    // COMPLETE REBALANCING - Sell all positions first
    if (currentHoldings.length > 0) {
      console.log(`  🔄 Liquidating ${currentHoldings.length} existing positions`);
      
      // Sell all current holdings
      for (const holding of currentHoldings) {
        const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
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
    const marketCapWeights = calculateMarketCapWeights(currentPriceData);
    
    // Log market cap distribution for insight
    const totalMarketCap = currentPriceData.reduce((sum, data) => sum + data.marketCap, 0);
    console.log(`  📈 Total market cap: $${(totalMarketCap / 1e9).toFixed(1)}B`);
    
    // Show top 5 largest companies by market cap
    const sortedByMarketCap = [...currentPriceData]
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 5);
    
    console.log('  🏆 Top 5 companies by market cap:');
    sortedByMarketCap.forEach((data, index) => {
      const weight = data.marketCap / totalMarketCap;
      console.log(`    ${index + 1}. ${data.ticker}: ${(weight * 100).toFixed(1)}% ($${(data.marketCap / 1e9).toFixed(1)}B)`);
    });

    // Buy stocks according to market cap weights
    let totalSpent = 0;
    currentPriceData.forEach((priceData, index) => {
      const weight = marketCapWeights[index];
      const targetAllocation = cash * weight;
      const shares = calculateShares(targetAllocation, priceData.adjustedPrice);
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
    const finalPortfolioValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
    const finalTotalValue = finalPortfolioValue + cash;

    // Update weights based on actual values (should be very close to target weights)
    currentHoldings = currentHoldings.map(holding => ({
      ...holding,
      weight: finalTotalValue > 0 ? holding.value / finalTotalValue : 0
    }));

    // Record yearly snapshot
    yearlySnapshots.push({
      date: yearDate,
      totalValue: finalTotalValue,
      holdings: [...currentHoldings],
      cash
    });

    console.log(`  ✅ Rebalancing complete`);
    console.log(`  💰 Final portfolio value: $${finalTotalValue.toLocaleString()}`);
    console.log(`  💵 Remaining cash: $${cash.toLocaleString()} (${(cash / finalTotalValue * 100).toFixed(2)}%)`);
    console.log(`  📊 New holdings: ${currentHoldings.length} stocks`);
    
    // Show concentration metrics
    const topHoldings = [...currentHoldings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
    
    const top5Weight = topHoldings.reduce((sum, h) => sum + h.weight, 0);
    const top10Weight = [...currentHoldings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10)
      .reduce((sum, h) => sum + h.weight, 0);
    
    console.log(`  🎯 Top 5 holdings: ${(top5Weight * 100).toFixed(1)}% of portfolio`);
    console.log(`  🎯 Top 10 holdings: ${(top10Weight * 100).toFixed(1)}% of portfolio`);
    
    // Validation check
    const totalWeight = currentHoldings.reduce((sum, h) => sum + h.weight, 0);
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
  const totalReturn = calculateTotalReturn(startValue, endValue);
  const yearCount = getYearsBetweenDates(
    yearlySnapshots[0].date, 
    yearlySnapshots[yearlySnapshots.length - 1].date
  );
  const annualizedReturn = calculateAnnualizedReturn(startValue, endValue, yearCount);

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

/**
 * Helper function to validate Market Cap Rebalanced strategy parameters
 */
export function validateMarketCapRebalancedParams(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
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
    const startDate = getStartOfYearDate(startYear);
    const initialStocks = getAvailableStocks(stocks, startDate);
    
    if (initialStocks.length === 0) {
      errors.push(`No stocks available at start date (${startDate})`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get strategy description
 */
export function getMarketCapRebalancedDescription(): string {
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

/**
 * Calculate concentration statistics for market cap weighted portfolios
 */
export function calculateConcentrationStats(snapshots: PortfolioSnapshot[]): {
  averageTop5Concentration: number;
  averageTop10Concentration: number;
  maxSingleStockWeight: number;
  averageNumberOfStocks: number;
} {
  const stats = snapshots.map(snapshot => {
    const sortedHoldings = [...snapshot.holdings].sort((a, b) => b.weight - a.weight);
    
    const top5Weight = sortedHoldings.slice(0, 5).reduce((sum, h) => sum + h.weight, 0);
    const top10Weight = sortedHoldings.slice(0, 10).reduce((sum, h) => sum + h.weight, 0);
    const maxWeight = sortedHoldings[0]?.weight || 0;
    
    return {
      top5Weight,
      top10Weight,
      maxWeight,
      stockCount: snapshot.holdings.length
    };
  });
  
  const avgTop5 = stats.reduce((sum, s) => sum + s.top5Weight, 0) / stats.length;
  const avgTop10 = stats.reduce((sum, s) => sum + s.top10Weight, 0) / stats.length;
  const maxWeight = Math.max(...stats.map(s => s.maxWeight));
  const avgStocks = stats.reduce((sum, s) => sum + s.stockCount, 0) / stats.length;
  
  return {
    averageTop5Concentration: avgTop5,
    averageTop10Concentration: avgTop10,
    maxSingleStockWeight: maxWeight,
    averageNumberOfStocks: avgStocks
  };
}