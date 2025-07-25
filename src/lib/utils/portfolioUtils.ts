import { PortfolioHolding, PriceData, Stock } from '../../types/backtesting';
import { isDateInRange } from './dateUtils';

/**
 * Portfolio utilities for backtesting strategies
 */

/**
 * Get stocks available on a specific date
 */
export function getAvailableStocks(stocks: Stock[], date: string): Stock[] {
  return stocks.filter(stock => isDateInRange(date, stock.startDate, stock.endDate));
}

/**
 * Calculate equal weights for a list of stocks
 */
export function calculateEqualWeights(stockCount: number): number[] {
  const weight = 1 / stockCount;
  return Array(stockCount).fill(weight);
}

/**
 * Calculate market cap weights from price data
 */
export function calculateMarketCapWeights(priceData: PriceData[]): number[] {
  const totalMarketCap = priceData.reduce((sum, data) => sum + data.marketCap, 0);
  
  if (totalMarketCap === 0) {
    return calculateEqualWeights(priceData.length);
  }
  
  return priceData.map(data => data.marketCap / totalMarketCap);
}

/**
 * Calculate shares to purchase given dollar allocation and price
 */
export function calculateShares(dollarAmount: number, price: number): number {
  if (price <= 0) return 0;
  return Math.floor(dollarAmount / price);
}

/**
 * Calculate portfolio value from holdings and current prices
 */
export function calculatePortfolioValue(
  holdings: PortfolioHolding[], 
  priceData: PriceData[]
): number {
  let totalValue = 0;
  
  holdings.forEach(holding => {
    const currentPrice = priceData.find(p => p.ticker === holding.ticker);
    if (currentPrice) {
      totalValue += holding.shares * currentPrice.adjustedPrice;
    }
  });
  
  return totalValue;
}

/**
 * Update portfolio weights based on current values
 */
export function updatePortfolioWeights(
  holdings: PortfolioHolding[], 
  totalValue: number
): PortfolioHolding[] {
  return holdings.map(holding => ({
    ...holding,
    weight: totalValue > 0 ? holding.value / totalValue : 0
  }));
}

/**
 * Rebalance portfolio to target weights
 */
export function rebalancePortfolio(
  currentHoldings: PortfolioHolding[],
  targetWeights: number[],
  availableStocks: Stock[],
  priceData: PriceData[],
  totalValue: number,
  cash: number = 0
): { holdings: PortfolioHolding[]; cash: number; trades: Trade[] } {
  const trades: Trade[] = [];
  const newHoldings: PortfolioHolding[] = [];
  let remainingCash = cash;

  // Calculate target dollar amounts
  const totalToInvest = totalValue + cash;
  
  availableStocks.forEach((stock, index) => {
    const targetWeight = targetWeights[index] || 0;
    const targetValue = totalToInvest * targetWeight;
    const currentPrice = priceData.find(p => p.ticker === stock.ticker);
    
    if (!currentPrice || currentPrice.adjustedPrice <= 0) {
      return;
    }

    const currentHolding = currentHoldings.find(h => h.ticker === stock.ticker);
    const currentValue = currentHolding ? currentHolding.value : 0;
    const currentShares = currentHolding ? currentHolding.shares : 0;

    // Calculate required shares for target value
    const targetShares = Math.floor(targetValue / currentPrice.adjustedPrice);
    const sharesDiff = targetShares - currentShares;
    let actualSharesTraded = 0;

    if (sharesDiff !== 0) {
      const tradeValue = Math.abs(sharesDiff) * currentPrice.adjustedPrice;
      
      if (sharesDiff > 0) {
        // Buy shares
        if (remainingCash >= tradeValue) {
          remainingCash -= tradeValue;
          actualSharesTraded = sharesDiff;
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
            actualSharesTraded = affordableShares;
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
        actualSharesTraded = sharesDiff; // Negative for sells
        trades.push({
          ticker: stock.ticker,
          action: 'sell',
          shares: Math.abs(sharesDiff),
          price: currentPrice.adjustedPrice,
          value: tradeValue
        });
      }
    }

    // Update holdings using actual shares traded
    const finalShares = currentShares + actualSharesTraded;
    
    if (finalShares > 0) {
      newHoldings.push({
        ticker: stock.ticker,
        shares: finalShares,
        value: finalShares * currentPrice.adjustedPrice,
        weight: (finalShares * currentPrice.adjustedPrice) / totalToInvest,
        marketCap: currentPrice.marketCap
      });
    }
  });

  return { holdings: newHoldings, cash: remainingCash, trades };
}

/**
 * Add new stocks to portfolio with proportional reduction
 */
export function addNewStocksProportionally(
  currentHoldings: PortfolioHolding[],
  newStocks: Stock[],
  newStockWeights: number[],
  priceData: PriceData[],
  totalValue: number
): PortfolioHolding[] {
  const newHoldings = [...currentHoldings];
  const totalNewWeight = newStockWeights.reduce((sum, weight) => sum + weight, 0);
  const reductionFactor = 1 - totalNewWeight;

  // Reduce existing holdings proportionally
  newHoldings.forEach(holding => {
    holding.weight *= reductionFactor;
    holding.value = holding.weight * totalValue;
  });

  // Add new stocks
  newStocks.forEach((stock, index) => {
    const weight = newStockWeights[index];
    const value = weight * totalValue;
    const currentPrice = priceData.find(p => p.ticker === stock.ticker);
    
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

/**
 * Calculate annualized return
 */
export function calculateAnnualizedReturn(
  startValue: number, 
  endValue: number, 
  years: number
): number {
  if (startValue <= 0 || years <= 0) return 0;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Calculate total return
 */
export function calculateTotalReturn(startValue: number, endValue: number): number {
  if (startValue <= 0) return 0;
  return (endValue - startValue) / startValue;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Trade interface for tracking transactions
 */
export interface Trade {
  ticker: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
}

/**
 * Validate portfolio holdings
 */
export function validateHoldings(holdings: PortfolioHolding[]): boolean {
  return holdings.every(holding => 
    holding.shares >= 0 && 
    holding.value >= 0 && 
    holding.weight >= 0 &&
    holding.weight <= 1
  );
}

/**
 * Clean up holdings (remove zero-share positions)
 */
export function cleanupHoldings(holdings: PortfolioHolding[]): PortfolioHolding[] {
  return holdings.filter(holding => holding.shares > 0);
}

/**
 * Sort holdings by value (descending)
 */
export function sortHoldingsByValue(holdings: PortfolioHolding[]): PortfolioHolding[] {
  return [...holdings].sort((a, b) => b.value - a.value);
}

/**
 * Get portfolio statistics
 */
export function getPortfolioStats(holdings: PortfolioHolding[]): {
  totalValue: number;
  stockCount: number;
  largestHolding: PortfolioHolding | null;
  topConcentration: number;
} {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const sortedHoldings = sortHoldingsByValue(holdings);
  
  return {
    totalValue,
    stockCount: holdings.length,
    largestHolding: sortedHoldings[0] || null,
    topConcentration: sortedHoldings[0]?.weight || 0
  };
}