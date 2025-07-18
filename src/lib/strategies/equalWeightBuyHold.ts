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
  calculateAnnualizedReturn,
  addNewStocksProportionally
} from '../utils/portfolioUtils';
import { getStartOfYearDate, getYearsInRange, getYearsBetweenDates } from '../utils/dateUtils';

/**
 * Equal Weight Buy and Hold Strategy
 * 
 * Rules:
 * 1. Start with equal weight among all initially available stocks
 * 2. When new stocks become available at start of each year:
 *    - Calculate their equal weight allocation based on current portfolio size
 *    - Purchase the new stocks
 *    - Reduce existing holdings proportionally
 * 3. No rebalancing - just hold positions
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

  // Process each subsequent year
  const yearsArray = getYearsInRange(startYear + 1, endYear);
  
  for (const year of yearsArray) {
    console.log(`📅 ${year}: Processing year...`);
    
    const yearDate = getStartOfYearDate(year);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    // Get current prices for existing holdings
    const currentPriceData: PriceData[] = [];
    for (const holding of currentHoldings) {
      const priceData = await priceDataFetcher(holding.ticker, yearDate);
      if (priceData) {
        currentPriceData.push(priceData);
      }
    }

    // Update current portfolio value
    currentHoldings = currentHoldings.map(holding => {
      const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
      if (currentPrice) {
        return {
          ...holding,
          value: holding.shares * currentPrice.adjustedPrice
        };
      }
      return holding;
    }).filter(holding => holding.value > 0); // Remove stocks that no longer have price data

    const currentPortfolioValue = currentHoldings.reduce((sum, h) => sum + h.value, 0);
    const totalValue = currentPortfolioValue + cash;

    // Check for new stocks
    const currentTickers = new Set(currentHoldings.map(h => h.ticker));
    const newStocks = availableStocks.filter(stock => !currentTickers.has(stock.ticker));

    if (newStocks.length > 0) {
      console.log(`  📈 Adding ${newStocks.length} new stocks`);
      
      // Get price data for new stocks
      const newStockPriceData: PriceData[] = [];
      for (const stock of newStocks) {
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
        const updatedHoldings = addNewStocksProportionally(
          currentHoldings,
          newStocks.slice(0, newStockPriceData.length),
          newStockWeights,
          newStockPriceData,
          totalValue
        );

        // Execute trades to achieve new allocation
        // Reduce existing positions proportionally
        const reductionFactor = 1 - (newStockPriceData.length * targetWeightPerStock);
        
        currentHoldings.forEach(holding => {
          const targetShares = Math.floor(holding.shares * reductionFactor);
          const sharesToSell = holding.shares - targetShares;
          
          if (sharesToSell > 0) {
            const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
            if (currentPrice) {
              cash += sharesToSell * currentPrice.adjustedPrice;
              holding.shares = targetShares;
              holding.value = holding.shares * currentPrice.adjustedPrice;
            }
          }
        });

        // Buy new stocks
        newStockPriceData.forEach((priceData, index) => {
          const allocation = totalValue * targetWeightPerStock;
          const shares = calculateShares(allocation, priceData.adjustedPrice);
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
    4. No periodic rebalancing - positions grow/shrink with market movements
    5. Maintains buy-and-hold approach throughout the investment period
    
    This strategy provides diversification benefits while minimizing transaction costs
    by avoiding frequent rebalancing.
  `;
}