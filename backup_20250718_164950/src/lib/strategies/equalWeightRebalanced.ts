import { 
  StrategyResult, 
  Stock, 
  PriceData, 
  PortfolioSnapshot, 
  PortfolioHolding 
} from '../../types/backtesting';
import { 
  getAvailableStocks, 
  calculateEqualWeights, 
  calculateShares,
  calculatePortfolioValue,
  calculateTotalReturn,
  calculateAnnualizedReturn
} from '../utils/portfolioUtils';
import { getStartOfYearDate, getYearsInRange, getYearsBetweenDates } from '../utils/dateUtils';

/**
 * Equal Weight Rebalanced Strategy
 * 
 * Rules:
 * 1. Each year, rebalance the portfolio to equal weight across all available stocks
 * 2. Sell overweighted positions and buy underweighted ones
 * 3. New stocks entering the index get equal weight allocation
 * 4. Stocks leaving the index are sold
 * 5. Complete rebalancing at the start of each year
 */

export async function runEqualWeightRebalanced(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  priceDataFetcher: (ticker: string, date: string) => Promise<PriceData | null>
): Promise<StrategyResult> {
  console.log('🔄 Running Equal Weight Rebalanced Strategy...');
  
  const yearlySnapshots: PortfolioSnapshot[] = [];
  let currentHoldings: PortfolioHolding[] = [];
  let cash = initialInvestment;

  // Process each year (including start year)
  const yearsArray = getYearsInRange(startYear, endYear);
  
  for (const year of yearsArray) {
    console.log(`📅 ${year}: Rebalancing portfolio...`);
    
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    console.log(`  📊 Available stocks: ${availableStocks.length}`);
    
    if (availableStocks.length === 0) {
      console.log(`  ⚠️  No stocks available in ${year}`);
      continue;
    }

    // Get current prices for all available stocks
    const currentPriceData: PriceData[] = [];
    for (const stock of availableStocks) {
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
        }
      }
      
      // Clear holdings
      currentHoldings = [];
    }

    // Calculate equal weights for all available stocks
    const equalWeights = calculateEqualWeights(currentPriceData.length);
    const targetValuePerStock = cash / currentPriceData.length;
    
    console.log(`  🎯 Target allocation per stock: $${targetValuePerStock.toLocaleString()}`);

    // Buy equal amounts of all available stocks
    let totalSpent = 0;
    currentPriceData.forEach((priceData, index) => {
      const targetAllocation = cash * equalWeights[index];
      const shares = calculateShares(targetAllocation, priceData.adjustedPrice);
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
    const finalPortfolioValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
    const finalTotalValue = finalPortfolioValue + cash;

    // Update weights based on actual values
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
    console.log(`  💵 Remaining cash: $${cash.toLocaleString()}`);
    console.log(`  📊 New holdings: ${currentHoldings.length} stocks at ${(100 / currentHoldings.length).toFixed(2)}% each`);
    
    // Validation check
    const totalWeight = currentHoldings.reduce((sum, h) => sum + h.weight, 0);
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
  const totalReturn = calculateTotalReturn(startValue, endValue);
  const yearCount = getYearsBetweenDates(
    yearlySnapshots[0].date, 
    yearlySnapshots[yearlySnapshots.length - 1].date
  );
  const annualizedReturn = calculateAnnualizedReturn(startValue, endValue, yearCount);

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

/**
 * Helper function to validate Equal Weight Rebalanced strategy parameters
 */
export function validateEqualWeightRebalancedParams(
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
export function getEqualWeightRebalancedDescription(): string {
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

/**
 * Calculate rebalancing statistics
 */
export function calculateRebalancingStats(snapshots: PortfolioSnapshot[]): {
  totalRebalances: number;
  averageStocksPerRebalance: number;
  maxStocksInPortfolio: number;
  minStocksInPortfolio: number;
} {
  const rebalances = snapshots.length;
  const stockCounts = snapshots.map(s => s.holdings.length);
  
  return {
    totalRebalances: rebalances,
    averageStocksPerRebalance: stockCounts.reduce((sum, count) => sum + count, 0) / rebalances,
    maxStocksInPortfolio: Math.max(...stockCounts),
    minStocksInPortfolio: Math.min(...stockCounts)
  };
}