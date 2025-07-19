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
  calculateTotalReturn,
  calculateAnnualizedReturn
} from '../utils/portfolioUtils';
import { getStartOfYearDate, getYearsInRange, getYearsBetweenDates } from '../utils/dateUtils';

export async function runMarketCapBuyHold(
  stocks: Stock[],
  startYear: number,
  endYear: number,
  initialInvestment: number,
  priceDataFetcher: (ticker: string, date: string) => Promise<PriceData | null>
): Promise<StrategyResult> {
  console.log('🔄 Running Market Cap Weighted Buy & Hold Strategy...');
  
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

  // Calculate market cap weights and initial positions
  const marketCapWeights = calculateMarketCapWeights(initialPriceData);
  
  initialPriceData.forEach((priceData, index) => {
    const allocation = initialInvestment * marketCapWeights[index];
    const shares = calculateShares(allocation, priceData.adjustedPrice);
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
  const initialTotalValue = currentHoldings.reduce((sum, h) => sum + h.value, 0) + cash;
  yearlySnapshots.push({
    date: startDate,
    totalValue: initialTotalValue,
    holdings: [...currentHoldings],
    cash
  });

  console.log(`  💰 Initial portfolio value: $${initialTotalValue.toLocaleString()}`);

  // Process each subsequent year
  const subsequentYears = getYearsInRange(startYear + 1, endYear);
  
  for (const currentYear of subsequentYears) {
    console.log(`📅 ${currentYear}: Processing year...`);
    
    const yearDate = getStartOfYearDate(currentYear);
    const availableStocks = getAvailableStocks(stocks, yearDate);
    
    // Get current prices for existing holdings
    const currentPriceData: PriceData[] = [];
    for (const holding of currentHoldings) {
      const priceData = await priceDataFetcher(holding.ticker, yearDate);
      if (priceData) {
        currentPriceData.push(priceData);
      }
    }

    // Update current portfolio value with new prices
    currentHoldings = currentHoldings.map(holding => {
      const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
      if (currentPrice) {
        return {
          ...holding,
          value: holding.shares * currentPrice.adjustedPrice,
          marketCap: currentPrice.marketCap
        };
      }
      return holding;
    }).filter(holding => holding.value > 0);

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
        // Calculate market cap weights for ALL stocks (existing + new)
        const allPriceData = [...currentPriceData, ...newStockPriceData];
        const allMarketCapWeights = calculateMarketCapWeights(allPriceData);
        
        // Determine weights for new stocks only
        const newStockWeights = allMarketCapWeights.slice(currentPriceData.length);
        const totalNewWeight = newStockWeights.reduce((sum, weight) => sum + weight, 0);
        
        let cashFromSales = 0;
        currentHoldings.forEach((holding, index) => {
          const newTargetWeight = allMarketCapWeights[index];
          const currentWeight = holding.value / totalValue;
          
          if (newTargetWeight < currentWeight) {
            const targetValue = totalValue * newTargetWeight;
            const currentPrice = currentPriceData.find(p => p.ticker === holding.ticker);
            
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
        newStockPriceData.forEach((priceData, index) => {
          const weight = newStockWeights[index];
          const allocation = totalValue * weight;
          const shares = calculateShares(allocation, priceData.adjustedPrice);
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
  const timeSpan = getYearsBetweenDates(
    yearlySnapshots[0].date, 
    yearlySnapshots[yearlySnapshots.length - 1].date
  );
  const annualizedReturn = calculateAnnualizedReturn(startValue, endValue, timeSpan);

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

export function validateMarketCapBuyHoldParams(
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
  
  return {
    isValid: errors.length === 0,
    errors
  };
}