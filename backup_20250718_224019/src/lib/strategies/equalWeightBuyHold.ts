// src/lib/strategies/equalWeightBuyHold.ts
// Equal Weight Buy & Hold Strategy - Corrected to buy ANY newly available stocks

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
 * Equal Weight Buy and Hold Strategy
 * 
 * Rules:
 * 1. Start with equal weight among all initially available stocks (S&P 500 members)
 * 2. When new stocks become available in the market at start of each year:
 *    - Calculate their equal weight allocation based on current portfolio size
 *    - Purchase the new stocks (regardless of S&P 500 membership)
 *    - Reduce existing holdings proportionally
 * 3. No rebalancing - just hold positions
 * 4. Remove stocks that are delisted
 */
export async function runEqualWeightBuyHold(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  priceDataFetcher: (ticker: string, date: string) => Promise<PriceData | null>
): Promise<StrategyResult> {
  console.log('🔄 Running Equal Weight Buy & Hold Strategy...');
  
  const yearlySnapshots: PortfolioSnapshot[] = [];
  let currentHoldings: PortfolioHolding[] = [];
  let cash = 0;
  
  // Track which stocks we've seen before (to identify truly new stocks)
  const previouslyAvailableStocks = new Set<string>();

  // Initialize portfolio in start year
  const startDate = getStartOfYearDate(startYear);
  const initialStocks = getAvailableStocks(stocks, startDate);
  
  console.log(`📅 ${startYear}: Initializing with ${initialStocks.length} stocks`);
  
  // Get initial price data
  const initialPriceData: PriceData[] = [];
  for (const stock of initialStocks) {
    const priceData = await priceDataFetcher(stock.ticker, startDate);
    if (priceData) {
      initialPriceData.push(priceData);
      previouslyAvailableStocks.add(stock.ticker);
    }
  }

  if (initialPriceData.length === 0) {
    throw new Error('No price data available for initial stocks');
  }

  // Calculate equal weights and initial positions
  const equalWeights = calculateEqualWeights(initialPriceData.length);
  
  initialPriceData.forEach((priceData, index) => {
    const allocation = initialInvestment * equalWeights[index];
    const shares = calculateShares(allocation, priceData.adjustedPrice);
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
  const initialValue = calculatePortfolioValue(currentHoldings, cash);
  yearlySnapshots.push({
    date: startDate,
    totalValue: initialValue,
    holdings: [...currentHoldings],
    cash
  });

  // Process each subsequent year
  const years = getYearsInRange(startYear + 1, endYear);
  
  for (const year of years) {
    const yearDate = getStartOfYearDate(year);
    const availableThisYear = getAvailableStocks(stocks, yearDate);
    
    console.log(`\n📅 ${year}: Processing year`);
    
    // Find stocks that are newly available in the market (not seen before)
    const newStocks = availableThisYear.filter(stock => {
      // Check if we've never seen this stock before
      return !previouslyAvailableStocks.has(stock.ticker);
    });
    
    // Add newly available stocks to our tracking set
    newStocks.forEach(stock => previouslyAvailableStocks.add(stock.ticker));
    
    if (newStocks.length > 0) {
      console.log(`  🆕 Found ${newStocks.length} newly available stocks: ${newStocks.map(s => s.ticker).join(', ')}`);
      
      // Get current portfolio value before adding new stocks
      const pricePromises = currentHoldings.map(async (holding) => {
        const priceData = await priceDataFetcher(holding.ticker, yearDate);
        return priceData ? holding.shares * priceData.adjustedPrice : 0;
      });
      
      const holdingValues = await Promise.all(pricePromises);
      const currentPortfolioValue = holdingValues.reduce((sum, value) => sum + value, 0) + cash;
      
      // Calculate equal allocation for each new stock
      const totalStocks = currentHoldings.length + newStocks.length;
      const targetAllocationPerStock = currentPortfolioValue / totalStocks;
      const fundsNeededForNewStocks = targetAllocationPerStock * newStocks.length;
      
      // Reduce existing holdings proportionally to free up funds
      const reductionFactor = 1 - (fundsNeededForNewStocks / (currentPortfolioValue - cash));
      
      // Update existing holdings (reduce proportionally)
      for (let i = 0; i < currentHoldings.length; i++) {
        const holding = currentHoldings[i];
        const priceData = await priceDataFetcher(holding.ticker, yearDate);
        
        if (priceData) {
          const currentValue = holding.shares * priceData.adjustedPrice;
          const newValue = currentValue * reductionFactor;
          const newShares = Math.floor(newValue / priceData.adjustedPrice);
          const actualNewValue = newShares * priceData.adjustedPrice;
          
          cash += currentValue - actualNewValue; // Add cash from sold shares
          
          currentHoldings[i] = {
            ...holding,
            shares: newShares,
            value: actualNewValue
          };
        }
      }
      
      // Buy new stocks with available funds
      for (const newStock of newStocks) {
        const priceData = await priceDataFetcher(newStock.ticker, yearDate);
        
        if (priceData && priceData.adjustedPrice > 0) {
          const allocation = targetAllocationPerStock;
          const shares = calculateShares(allocation, priceData.adjustedPrice);
          const actualValue = shares * priceData.adjustedPrice;
          
          if (shares > 0 && cash >= actualValue) {
            currentHoldings.push({
              ticker: newStock.ticker,
              shares,
              value: actualValue,
              weight: 0, // Will be recalculated
              marketCap: priceData.marketCap
            });
            
            cash -= actualValue;
          }
        }
      }
    }
    
    // Remove delisted stocks
    const activeStockTickers = new Set(availableThisYear.map(s => s.ticker));
    const beforeCount = currentHoldings.length;
    currentHoldings = currentHoldings.filter(holding => activeStockTickers.has(holding.ticker));
    const removedCount = beforeCount - currentHoldings.length;
    
    if (removedCount > 0) {
      console.log(`  ❌ Removed ${removedCount} delisted stocks`);
    }
    
    // Update portfolio values for the year
    const updatedHoldings: PortfolioHolding[] = [];
    let totalValue = cash;
    
    for (const holding of currentHoldings) {
      const priceData = await priceDataFetcher(holding.ticker, yearDate);
      
      if (priceData) {
        const value = holding.shares * priceData.adjustedPrice;
        updatedHoldings.push({
          ...holding,
          value,
          marketCap: priceData.marketCap
        });
        totalValue += value;
      }
    }
    
    currentHoldings = updatedHoldings;
    
    // Update weights based on current values
    const newTotalValue = calculatePortfolioValue(currentHoldings, cash);
    currentHoldings = currentHoldings.map(holding => ({
      ...holding,
      weight: newTotalValue > 0 ? holding.value / newTotalValue : 0
    }));

    // Record yearly snapshot
    yearlySnapshots.push({
      date: yearDate,
      totalValue: newTotalValue,
      holdings: [...currentHoldings],
      cash
    });

    console.log(`  💰 Portfolio value: $${newTotalValue.toLocaleString()}`);
    console.log(`  📊 Holdings: ${currentHoldings.length} stocks`);
    console.log(`  💵 Cash: $${cash.toFixed(2)}`);
  }

  if (yearlySnapshots.length === 0) {
    throw new Error('No valid snapshots created');
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

  console.log('✅ Equal Weight Buy & Hold Strategy completed');
  console.log(`📈 Total Return: ${(totalReturn * 100).toFixed(2)}%`);
  console.log(`📊 Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
  console.log(`🔢 Final holdings: ${currentHoldings.length} stocks`);

  return {
    strategy: 'Equal Weight Buy & Hold',
    startValue,
    endValue,
    totalReturn,
    annualizedReturn,
    yearlySnapshots
  };
}

/**
 * Helper function to validate Equal Weight Buy & Hold strategy parameters
 */
export function validateEqualWeightBuyHoldParams(
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
export function getEqualWeightBuyHoldDescription(): string {
  return `
    Equal Weight Buy & Hold Strategy:
    
    1. Initially invests equal amounts in all available S&P 500 stocks
    2. When new stocks become available in the market, allocates equal weight to them
    3. Reduces existing holdings proportionally to make room for new stocks
    4. Removes delisted stocks from the portfolio
    5. No periodic rebalancing - positions grow/shrink with market movements
    6. Buys ANY newly available stocks, not just S&P 500 members
    
    This strategy provides diversification benefits while minimizing transaction costs
    by avoiding frequent rebalancing and capturing new market opportunities.
  `;
}