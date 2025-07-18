// src/lib/strategies/equalWeightBuyHold.ts (Fixed version)

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
 * Equal Weight Buy and Hold Strategy (FIXED VERSION)
 * 
 * Rules:
 * 1. Start with equal weight among all initially available stocks
 * 2. When new stocks become available at start of each year:
 *    - Calculate their equal weight allocation based on current portfolio size
 *    - Purchase the new stocks
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
  const initialTotalValue = currentHoldings.reduce((sum, h) => sum + h.value, 0) + cash;
  yearlySnapshots.push({
    date: startDate,
    totalValue: initialTotalValue,
    holdings: [...currentHoldings],
    cash
  });

  console.log(`  💰 Initial portfolio value: $${initialTotalValue.toLocaleString()}`);
  console.log(`  📊 Initial holdings: ${currentHoldings.length} stocks`);

  // Process each subsequent year
  const yearsArray = getYearsInRange(startYear + 1, endYear);
  
  for (const year of yearsArray) {
    console.log(`📅 ${year}: Processing year...`);
    
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    // Update prices for existing holdings and remove delisted stocks
    const stillActiveHoldings: PortfolioHolding[] = [];
    const currentPriceData: PriceData[] = [];
    
    for (const holding of currentHoldings) {
      const priceData = await priceDataFetcher(holding.ticker, yearDate);
      if (priceData) {
        // Stock is still active
        currentPriceData.push(priceData);
        stillActiveHoldings.push({
          ...holding,
          value: holding.shares * priceData.adjustedPrice
        });
      } else {
        // Stock was delisted - remove from portfolio
        console.log(`  ❌ ${holding.ticker} delisted - removing from portfolio`);
        // Note: In a real scenario, we'd get the last trading price and convert to cash
        // For now, we'll assume the position value goes to zero (worst case)
      }
    }
    
    currentHoldings = stillActiveHoldings;

    const currentPortfolioValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
    const totalValue = currentPortfolioValue + cash;

    // Find genuinely new stocks (not in our portfolio and newly available)
    const currentTickers = new Set(currentHoldings.map(h => h.ticker));
    const newStocks = availableStocks.filter(stock => {
      // Check if this stock is NOT already in our portfolio
      if (currentTickers.has(stock.ticker)) {
        return false;
      }
      
      // Check if this stock just became available this year or last year
      // (allowing for slight date mismatches)
      const stockStartYear = parseInt(stock.startDate.split('-')[0]);
      return stockStartYear >= year - 1;
    });

    if (newStocks.length > 0) {
      console.log(`  📈 Found ${newStocks.length} genuinely new stocks to add`);
      
      // Get price data for new stocks
      const newStockPriceData: PriceData[] = [];
      for (const stock of newStocks) {
        const priceData = await priceDataFetcher(stock.ticker, yearDate);
        if (priceData) {
          newStockPriceData.push(priceData);
          console.log(`    ➕ Adding new stock: ${stock.ticker}`);
        }
      }

      if (newStockPriceData.length > 0) {
        // Calculate allocation for new stocks
        // New methodology: Give new stocks equal weight with existing ones
        const totalStockCount = currentHoldings.length + newStockPriceData.length;
        const targetWeightPerStock = 1 / totalStockCount;
        const totalNewStockWeight = newStockPriceData.length * targetWeightPerStock;
        
        // We need to free up capital for new stocks by reducing existing positions
        const reductionFactor = 1 - totalNewStockWeight;
        
        // Sell portion of existing holdings to raise cash
        currentHoldings.forEach(holding => {
          const targetShares = Math.floor(holding.shares * reductionFactor);
          const sharesToSell = holding.shares - targetShares;
          
          if (sharesToSell > 0) {
            const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
            if (currentPrice) {
              const saleProceeds = sharesToSell * currentPrice.adjustedPrice;
              cash += saleProceeds;
              holding.shares = targetShares;
              holding.value = holding.shares * currentPrice.adjustedPrice;
              console.log(`    💸 Sold ${sharesToSell} shares of ${holding.ticker} for $${saleProceeds.toFixed(2)}`);
            }
          }
        });

        // Buy new stocks with available cash
        const cashPerNewStock = (totalValue * targetWeightPerStock);
        
        newStockPriceData.forEach(priceData => {
          const targetInvestment = Math.min(cashPerNewStock, cash);
          const shares = calculateShares(targetInvestment, priceData.adjustedPrice);
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
            console.log(`    📈 Bought ${shares} shares of ${priceData.ticker} for $${cost.toFixed(2)}`);
          }
        });
      }
    } else {
      console.log(`  ℹ️  No new stocks to add this year`);
    }

    // Update weights based on current values
    const newTotalValue = currentHoldings.reduce((sum, h) => sum + h.value, 0) + cash;
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
    
    1. Initially invests equal amounts in all available stocks
    2. When new stocks join the index, allocates equal weight to them
    3. Reduces existing holdings proportionally to make room for new stocks
    4. Removes delisted stocks from the portfolio
    5. No periodic rebalancing - positions grow/shrink with market movements
    6. Only adds stocks that are genuinely new to the S&P 500
    
    This strategy provides diversification benefits while minimizing transaction costs
    by avoiding frequent rebalancing.
  `;
}