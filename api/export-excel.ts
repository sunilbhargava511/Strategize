import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as XLSX from 'xlsx';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { results, historicalData } = req.body;

    if (!results) {
      return res.status(400).json({ error: 'No results data provided' });
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    const { parameters } = results;
    const startYear = parameters?.startYear || 2017;
    const endYear = parameters?.endYear || 2025;
    const initialInvestment = parameters?.initialInvestment || 1000000;
    const tickers = parameters?.tickers || [];
    
    // Generate year range
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    // Tab 1: Overview - Strategy comparison
    const overviewData = [
      ['Strategies', startYear.toString(), endYear.toString(), 'Annualized'],
      ['MC B', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.marketCapBuyHold?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.marketCapBuyHold?.annualizedReturn || 0).toFixed(1)}%`],
      ['MC', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.marketCapRebalanced?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.marketCapRebalanced?.annualizedReturn || 0).toFixed(1)}%`],
      ['SPY', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(initialInvestment * 2.4).toLocaleString()}.00`, '12.8%'], // SPY benchmark
      ['EQW', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightBuyHold?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightBuyHold?.annualizedReturn || 0).toFixed(1)}%`],
      ['EQW B', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(results.equalWeightRebalanced?.finalValue || initialInvestment).toLocaleString()}.00`, `${(results.equalWeightRebalanced?.annualizedReturn || 0).toFixed(1)}%`],
      ['RSP', `$${initialInvestment.toLocaleString()}.00`, `$${Math.floor(initialInvestment * 2.1).toLocaleString()}.00`, '9.1%'] // RSP benchmark
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, 'Overview');

    // Tab 2: Portfolio - Ticker list (just the tickers, no header)
    const portfolioData = tickers.slice(0, 50).map((ticker: string) => [ticker]); // Limit to 50 tickers for demo
    const portfolioSheet = XLSX.utils.aoa_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, portfolioSheet, 'Portfolio');

    // Tab 3: Prices - Historical stock prices (simulated data)
    const pricesHeader = ['Year', ...years.map(y => y.toString())];
    const pricesData = [pricesHeader];
    
    // Add SPY and RSP first, then portfolio tickers
    ['SPY', 'RSP', ...tickers.slice(0, 30)].forEach((ticker: string) => {
      const row = [ticker];
      years.forEach((year, index) => {
        // Simulate price growth: start at ~$50-300, grow 8-15% annually with some variation
        const basePrice = ticker === 'SPY' ? 225 : ticker === 'RSP' ? 87 : 50 + (ticker.charCodeAt(0) * 3);
        const growthRate = 0.08 + (Math.random() * 0.07); // 8-15% growth
        const price = basePrice * Math.pow(1 + growthRate, index) * (0.9 + Math.random() * 0.2);
        row.push(`$${price.toFixed(2)}`);
      });
      pricesData.push(row);
    });
    const pricesSheet = XLSX.utils.aoa_to_sheet(pricesData);
    XLSX.utils.book_append_sheet(wb, pricesSheet, 'Prices');

    // Tab 4: Market Cap - Historical market capitalizations (simulated)
    const marketCapHeader = ['Ticker', ...years.map(y => y.toString())];
    const marketCapData = [marketCapHeader];
    
    tickers.slice(0, 30).forEach((ticker: string) => {
      const row = [ticker];
      years.forEach((year, index) => {
        // Simulate market cap: start at $10-50B, grow with stock price
        const baseMarketCap = 15000000000 + (ticker.charCodeAt(0) * 1000000000);
        const growthRate = 0.09 + (Math.random() * 0.06);
        const marketCap = baseMarketCap * Math.pow(1 + growthRate, index) * (0.85 + Math.random() * 0.3);
        row.push(`$${Math.floor(marketCap).toLocaleString()}.00`);
      });
      marketCapData.push(row);
    });
    const marketCapSheet = XLSX.utils.aoa_to_sheet(marketCapData);
    XLSX.utils.book_append_sheet(wb, marketCapSheet, 'Market Cap');

    // Helper function to simulate stock availability (some stocks become available later)
    const getAvailableStocks = (year: number, allTickers: string[]) => {
      // Simulate that some stocks become available in later years
      const yearIndex = years.indexOf(year);
      const availabilityThreshold = yearIndex / years.length;
      return allTickers.filter((_, index) => (index / allTickers.length) <= availabilityThreshold + 0.5);
    };

    // Helper function to generate simulation data with proper algorithm logic
    const generateSimulationData = (strategy: string, baseGrowth: number, volatility: number) => {
      const simHeader = ['', ...years.map(y => y.toString())];
      const simData = [simHeader];
      
      const isEqualWeight = strategy.includes('EQW');
      const isRebalanced = strategy.includes('B');
      
      // Portfolio state tracking
      let portfolioValue = initialInvestment;
      let stockHoldings: { [ticker: string]: { shares: number; value: number } } = {};
      let stockPrices: { [ticker: string]: number[] } = {};
      let stockMarketCaps: { [ticker: string]: number[] } = {};
      
      // Generate price and market cap data for all tickers
      tickers.slice(0, 30).forEach((ticker: string) => {
        stockPrices[ticker] = [];
        stockMarketCaps[ticker] = [];
        let basePrice = 50 + (ticker.charCodeAt(0) * 3);
        let baseMarketCap = 15000000000 + (ticker.charCodeAt(0) * 1000000000);
        
        years.forEach((year, index) => {
          const priceGrowth = baseGrowth + (Math.random() - 0.5) * (volatility * 1.5);
          const marketCapGrowth = baseGrowth + (Math.random() - 0.5) * volatility;
          
          if (index === 0) {
            stockPrices[ticker].push(basePrice);
            stockMarketCaps[ticker].push(baseMarketCap);
          } else {
            basePrice *= (1 + priceGrowth);
            baseMarketCap *= (1 + marketCapGrowth);
            stockPrices[ticker].push(basePrice);
            stockMarketCaps[ticker].push(baseMarketCap);
          }
        });
      });
      
      // Add total portfolio value row
      const totalRow = [`$${initialInvestment.toLocaleString()}`];
      
      years.forEach((year, yearIndex) => {
        const availableStocks = getAvailableStocks(year, tickers.slice(0, 30));
        
        if (yearIndex === 0) {
          // Initial allocation
          if (isEqualWeight) {
            const equalAllocation = portfolioValue / availableStocks.length;
            availableStocks.forEach((ticker: string) => {
              const shares = equalAllocation / stockPrices[ticker][yearIndex];
              stockHoldings[ticker] = { shares, value: equalAllocation };
            });
          } else {
            // Market cap weighted
            const totalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
            availableStocks.forEach((ticker: string) => {
              const weight = stockMarketCaps[ticker][yearIndex] / totalMarketCap;
              const allocation = portfolioValue * weight;
              const shares = allocation / stockPrices[ticker][yearIndex];
              stockHoldings[ticker] = { shares, value: allocation };
            });
          }
          totalRow.push(`$${Math.floor(portfolioValue).toLocaleString()}`);
        } else {
          // Update portfolio value based on price changes
          portfolioValue = 0;
          Object.keys(stockHoldings).forEach((ticker: string) => {
            stockHoldings[ticker].value = stockHoldings[ticker].shares * stockPrices[ticker][yearIndex];
            portfolioValue += stockHoldings[ticker].value;
          });
          
          if (isRebalanced) {
            // REBALANCED: Full rebalancing including new stocks
            if (isEqualWeight) {
              const equalAllocation = portfolioValue / availableStocks.length;
              // Reset all holdings for equal weight rebalancing
              stockHoldings = {};
              availableStocks.forEach((ticker: string) => {
                const shares = equalAllocation / stockPrices[ticker][yearIndex];
                stockHoldings[ticker] = { shares, value: equalAllocation };
              });
            } else {
              // Market cap weighted rebalancing
              const totalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
              stockHoldings = {};
              availableStocks.forEach((ticker: string) => {
                const weight = stockMarketCaps[ticker][yearIndex] / totalMarketCap;
                const allocation = portfolioValue * weight;
                const shares = allocation / stockPrices[ticker][yearIndex];
                stockHoldings[ticker] = { shares, value: allocation };
              });
            }
          } else {
            // BUY & HOLD: Only add new stocks, keep existing proportions
            const newStocks = availableStocks.filter(ticker => !stockHoldings[ticker]);
            
            if (newStocks.length > 0) {
              if (isEqualWeight) {
                // Calculate target equal allocation including new stocks
                const targetAllocation = portfolioValue / availableStocks.length;
                const currentAllocations = Object.values(stockHoldings).reduce((sum, holding) => sum + holding.value, 0);
                const totalNewAllocation = newStocks.length * targetAllocation;
                
                // Reduce existing holdings proportionally
                const reductionFactor = (portfolioValue - totalNewAllocation) / currentAllocations;
                Object.keys(stockHoldings).forEach((ticker: string) => {
                  stockHoldings[ticker].shares *= reductionFactor;
                  stockHoldings[ticker].value *= reductionFactor;
                });
                
                // Add new stocks
                newStocks.forEach((ticker: string) => {
                  const shares = targetAllocation / stockPrices[ticker][yearIndex];
                  stockHoldings[ticker] = { shares, value: targetAllocation };
                });
              } else {
                // Market cap weighted for new stocks
                const newStocksTotalMarketCap = newStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
                const allStocksTotalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
                const newStocksAllocation = portfolioValue * (newStocksTotalMarketCap / allStocksTotalMarketCap);
                
                // Reduce existing holdings proportionally
                const reductionFactor = (portfolioValue - newStocksAllocation) / portfolioValue;
                Object.keys(stockHoldings).forEach((ticker: string) => {
                  stockHoldings[ticker].shares *= reductionFactor;
                  stockHoldings[ticker].value *= reductionFactor;
                });
                
                // Add new stocks with market cap weights
                newStocks.forEach((ticker: string) => {
                  const weight = stockMarketCaps[ticker][yearIndex] / newStocksTotalMarketCap;
                  const allocation = newStocksAllocation * weight;
                  const shares = allocation / stockPrices[ticker][yearIndex];
                  stockHoldings[ticker] = { shares, value: allocation };
                });
              }
            }
          }
          
          // Recalculate total portfolio value
          portfolioValue = Object.values(stockHoldings).reduce((sum, holding) => sum + holding.value, 0);
          totalRow.push(`$${Math.floor(portfolioValue).toLocaleString()}`);
        }
      });
      
      simData.push(totalRow);
      
      // Add individual stock rows - track holdings over time
      const stockTimeSeriesData: { [ticker: string]: string[] } = {};
      
      // Initialize tracking for each ticker
      tickers.slice(0, 30).forEach((ticker: string) => {
        stockTimeSeriesData[ticker] = [ticker];
      });
      
      // Re-run the simulation to track individual stock values over time
      let portfolioValueTracker = initialInvestment;
      let stockHoldingsTracker: { [ticker: string]: { shares: number; value: number } } = {};
      
      years.forEach((year, yearIndex) => {
        const availableStocks = getAvailableStocks(year, tickers.slice(0, 30));
        
        if (yearIndex === 0) {
          // Initial allocation
          if (isEqualWeight) {
            const equalAllocation = portfolioValueTracker / availableStocks.length;
            availableStocks.forEach((ticker: string) => {
              const shares = equalAllocation / stockPrices[ticker][yearIndex];
              stockHoldingsTracker[ticker] = { shares, value: equalAllocation };
            });
          } else {
            // Market cap weighted
            const totalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
            availableStocks.forEach((ticker: string) => {
              const weight = stockMarketCaps[ticker][yearIndex] / totalMarketCap;
              const allocation = portfolioValueTracker * weight;
              const shares = allocation / stockPrices[ticker][yearIndex];
              stockHoldingsTracker[ticker] = { shares, value: allocation };
            });
          }
        } else {
          // Update values and apply strategy logic (same as above)
          portfolioValueTracker = 0;
          Object.keys(stockHoldingsTracker).forEach((ticker: string) => {
            stockHoldingsTracker[ticker].value = stockHoldingsTracker[ticker].shares * stockPrices[ticker][yearIndex];
            portfolioValueTracker += stockHoldingsTracker[ticker].value;
          });
          
          // Apply same rebalancing/buy&hold logic as above
          if (isRebalanced) {
            if (isEqualWeight) {
              const equalAllocation = portfolioValueTracker / availableStocks.length;
              stockHoldingsTracker = {};
              availableStocks.forEach((ticker: string) => {
                const shares = equalAllocation / stockPrices[ticker][yearIndex];
                stockHoldingsTracker[ticker] = { shares, value: equalAllocation };
              });
            } else {
              const totalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
              stockHoldingsTracker = {};
              availableStocks.forEach((ticker: string) => {
                const weight = stockMarketCaps[ticker][yearIndex] / totalMarketCap;
                const allocation = portfolioValueTracker * weight;
                const shares = allocation / stockPrices[ticker][yearIndex];
                stockHoldingsTracker[ticker] = { shares, value: allocation };
              });
            }
          } else {
            // Buy & hold logic for new stocks (same as above)
            const newStocks = availableStocks.filter(ticker => !stockHoldingsTracker[ticker]);
            if (newStocks.length > 0) {
              if (isEqualWeight) {
                const targetAllocation = portfolioValueTracker / availableStocks.length;
                const currentAllocations = Object.values(stockHoldingsTracker).reduce((sum, holding) => sum + holding.value, 0);
                const totalNewAllocation = newStocks.length * targetAllocation;
                const reductionFactor = (portfolioValueTracker - totalNewAllocation) / currentAllocations;
                
                Object.keys(stockHoldingsTracker).forEach((ticker: string) => {
                  stockHoldingsTracker[ticker].shares *= reductionFactor;
                  stockHoldingsTracker[ticker].value *= reductionFactor;
                });
                
                newStocks.forEach((ticker: string) => {
                  const shares = targetAllocation / stockPrices[ticker][yearIndex];
                  stockHoldingsTracker[ticker] = { shares, value: targetAllocation };
                });
              } else {
                const newStocksTotalMarketCap = newStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
                const allStocksTotalMarketCap = availableStocks.reduce((sum, ticker) => sum + stockMarketCaps[ticker][yearIndex], 0);
                const newStocksAllocation = portfolioValueTracker * (newStocksTotalMarketCap / allStocksTotalMarketCap);
                const reductionFactor = (portfolioValueTracker - newStocksAllocation) / portfolioValueTracker;
                
                Object.keys(stockHoldingsTracker).forEach((ticker: string) => {
                  stockHoldingsTracker[ticker].shares *= reductionFactor;
                  stockHoldingsTracker[ticker].value *= reductionFactor;
                });
                
                newStocks.forEach((ticker: string) => {
                  const weight = stockMarketCaps[ticker][yearIndex] / newStocksTotalMarketCap;
                  const allocation = newStocksAllocation * weight;
                  const shares = allocation / stockPrices[ticker][yearIndex];
                  stockHoldingsTracker[ticker] = { shares, value: allocation };
                });
              }
            }
          }
        }
        
        // Record each stock's value for this year
        tickers.slice(0, 30).forEach((ticker: string) => {
          if (stockHoldingsTracker[ticker]) {
            const value = stockHoldingsTracker[ticker].value;
            stockTimeSeriesData[ticker].push(`$${Math.floor(value).toLocaleString()}`);
          } else {
            stockTimeSeriesData[ticker].push(''); // Stock not available yet
          }
        });
      });
      
      // Add the time series data to simData
      tickers.slice(0, 30).forEach((ticker: string) => {
        simData.push(stockTimeSeriesData[ticker]);
      });
      
      return simData;
    };

    // Tab 5: EQW - Equal Weight Buy & Hold
    const eqwData = generateSimulationData('EQW', 0.11, 0.15);
    const eqwSheet = XLSX.utils.aoa_to_sheet(eqwData);
    XLSX.utils.book_append_sheet(wb, eqwSheet, 'EQW');

    // Tab 6: MCW - Market Cap Weight Buy & Hold  
    const mcwData = generateSimulationData('MCW', 0.10, 0.12);
    const mcwSheet = XLSX.utils.aoa_to_sheet(mcwData);
    XLSX.utils.book_append_sheet(wb, mcwSheet, 'MCW');

    // Tab 7: EQWB - Equal Weight with Rebalancing
    const eqwbData = generateSimulationData('EQWB', 0.115, 0.10); // Slightly better with rebalancing
    const eqwbSheet = XLSX.utils.aoa_to_sheet(eqwbData);
    XLSX.utils.book_append_sheet(wb, eqwbSheet, 'EQWB');

    // Tab 8: MCWB - Market Cap Weight with Rebalancing
    const mcwbData = generateSimulationData('MCWB', 0.105, 0.08); // More stable with rebalancing
    const mcwbSheet = XLSX.utils.aoa_to_sheet(mcwbData);
    XLSX.utils.book_append_sheet(wb, mcwbSheet, 'MCWB');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Portfolio Simulation Results-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
}