import { useState } from 'react'

interface ResultsDisplayProps {
  results: any
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')
  
  if (!results) return null

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleExcelDownload = async () => {
    try {
      // Determine if cache was bypassed based on results metadata
      const bypassCache = results.from_cache === false || results.message?.includes('real');
      
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          results
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Portfolio Simulation Results-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download results. Please try again.');
    }
  }

  const strategies = [
    { key: 'equalWeightBuyHold', name: 'Equal Weight Buy & Hold', icon: '⚖️' },
    { key: 'marketCapBuyHold', name: 'Market Cap Buy & Hold', icon: '📈' },
    { key: 'equalWeightRebalanced', name: 'Equal Weight Rebalanced', icon: '🔄' },
    { key: 'marketCapRebalanced', name: 'Market Cap Rebalanced', icon: '📊' },
    { key: 'spyBenchmark', name: 'SPY Benchmark', icon: '🏛️' },
  ]

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'holdings', name: 'Holdings', icon: '📋' },
    { id: 'equalWeightBuyHold', name: 'Equal Weight B&H', icon: '⚖️' },
    { id: 'marketCapBuyHold', name: 'Market Cap B&H', icon: '📈' },
    { id: 'equalWeightRebalanced', name: 'Equal Weight Rebal.', icon: '🔄' },
    { id: 'marketCapRebalanced', name: 'Market Cap Rebal.', icon: '📊' },
    { id: 'spyBenchmark', name: 'SPY Benchmark', icon: '🏛️' },
  ]

  const renderHoldingsView = () => {
    if (!results.parameters) return <div>No portfolio data available</div>

    const startYear = results.parameters.startYear
    const endYear = results.parameters.endYear
    const tickers = results.parameters.tickers || []

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">📋</span>
          <h3 className="text-2xl font-semibold text-primary-900">Portfolio Holdings</h3>
        </div>

        {/* Portfolio Composition Summary */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-4">Portfolio Composition</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Total Stocks:</span>
              <span className="ml-2 font-medium">{tickers.length}</span>
            </div>
            <div>
              <span className="text-blue-700">Investment Period:</span>
              <span className="ml-2 font-medium">{startYear} - {endYear}</span>
            </div>
            <div>
              <span className="text-blue-700">Initial Investment:</span>
              <span className="ml-2 font-medium">{formatCurrency(results.parameters.initialInvestment || 1000000)}</span>
            </div>
          </div>
        </div>

        {/* Stock List */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Stock Tickers</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {tickers.map((ticker: string) => (
              <div key={ticker} className="bg-white px-3 py-2 rounded border text-center font-mono font-medium">
                {ticker}
              </div>
            ))}
          </div>
        </div>

        {/* Price and Market Cap History */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Historical Price & Market Cap Data</h4>
          <div className="bg-white border rounded-lg p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-3 font-semibold">Ticker</th>
                    {(() => {
                      // Get all years from any strategy's holdings
                      const allYears = new Set<number>()
                      strategies.forEach(strategy => {
                        const data = results[strategy.key]
                        if (data?.yearlyHoldings) {
                          Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                        }
                      })
                      return Array.from(allYears).sort().map(year => (
                        <th key={year} className="text-center p-3 font-semibold">{year}</th>
                      ))
                    })()}
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-600">
                    <th className="text-left p-2">Price / Market Cap</th>
                    {(() => {
                      const allYears = new Set<number>()
                      strategies.forEach(strategy => {
                        const data = results[strategy.key]
                        if (data?.yearlyHoldings) {
                          Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                        }
                      })
                      return Array.from(allYears).sort().map(year => (
                        <th key={year} className="text-center p-2">Price / MCap (B)</th>
                      ))
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get all unique tickers from all strategies and years
                    const allTickers = new Set<string>()
                    strategies.forEach(strategy => {
                      const data = results[strategy.key]
                      if (data?.yearlyHoldings) {
                        Object.values(data.yearlyHoldings).forEach((yearData: any) => {
                          Object.keys(yearData).forEach(ticker => allTickers.add(ticker))
                        })
                      }
                    })
                    
                    // Get all years
                    const allYears = new Set<number>()
                    strategies.forEach(strategy => {
                      const data = results[strategy.key]
                      if (data?.yearlyHoldings) {
                        Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                      }
                    })
                    const sortedYears = Array.from(allYears).sort()
                    
                    return Array.from(allTickers).sort().map(ticker => (
                      <tr key={ticker} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-mono font-medium">{ticker}</td>
                        {sortedYears.map(year => {
                          // Find data for this ticker in this year from any strategy
                          let priceData = null
                          for (const strategy of strategies) {
                            const data = results[strategy.key]
                            if (data?.yearlyHoldings?.[year]?.[ticker]) {
                              priceData = data.yearlyHoldings[year][ticker]
                              break
                            }
                          }
                          
                          return (
                            <td key={year} className="p-3 text-center text-xs">
                              {priceData ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-blue-600">
                                    ${priceData.price.toFixed(2)}
                                  </div>
                                  <div className="text-gray-600">
                                    {/* Show market cap in billions */}
                                    {priceData.marketCap ? `$${(priceData.marketCap / 1000000000).toFixed(1)}B` : '—'}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Price and market cap data from historical records. Market caps may be estimated if actual data unavailable.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderStrategyDetail = (strategyKey: string, strategyName: string, icon: string) => {
    const data = results[strategyKey]
    if (!data) return <div>No data available for this strategy</div>

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{icon}</span>
          <h3 className="text-2xl font-semibold text-primary-900">{strategyName}</h3>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Return</div>
            <div className={`text-2xl font-bold ${data.totalReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(data.totalReturn)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Annualized Return</div>
            <div className={`text-2xl font-bold ${data.annualizedReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(data.annualizedReturn)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Final Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.finalValue)}
            </div>
          </div>
        </div>

        {/* Strategy Details */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-4">Strategy Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Initial Investment:</span>
              <span className="ml-2 font-medium">{formatCurrency(results.parameters?.initialInvestment || 1000000)}</span>
            </div>
            <div>
              <span className="text-blue-700">Investment Period:</span>
              <span className="ml-2 font-medium">{results.parameters?.startYear} - {results.parameters?.endYear}</span>
            </div>
            <div>
              <span className="text-blue-700">Total Gain/Loss:</span>
              <span className={`ml-2 font-medium ${(data.finalValue - (results.parameters?.initialInvestment || 1000000)) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.finalValue - (results.parameters?.initialInvestment || 1000000))}
              </span>
            </div>
            <div>
              <span className="text-blue-700">Duration:</span>
              <span className="ml-2 font-medium">{(results.parameters?.endYear || 2024) - (results.parameters?.startYear || 2010)} years</span>
            </div>
          </div>
        </div>

        {/* Yearly Holdings Breakdown */}
        {data.yearlyHoldings && Object.keys(data.yearlyHoldings).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Yearly Holdings Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-3 font-semibold">Ticker</th>
                    {Object.keys(data.yearlyHoldings).sort().map(year => (
                      <th key={year} className="text-center p-3 font-semibold">{year}</th>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-600">
                    <th className="text-left p-2">Weight / Shares / Value</th>
                    {Object.keys(data.yearlyHoldings).sort().map(year => (
                      <th key={year} className="text-center p-2">Weight / Shares / Value</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get all unique tickers from all years
                    const allTickers = new Set<string>()
                    Object.values(data.yearlyHoldings).forEach((yearData: any) => {
                      Object.keys(yearData).forEach(ticker => allTickers.add(ticker))
                    })
                    
                    return Array.from(allTickers).sort().map(ticker => (
                      <tr key={ticker} className="border-b border-gray-100 hover:bg-white">
                        <td className="p-3 font-mono font-medium">{ticker}</td>
                        {Object.keys(data.yearlyHoldings).sort().map(year => {
                          const holding = data.yearlyHoldings[year]?.[ticker]
                          return (
                            <td key={year} className="p-3 text-center text-xs">
                              {holding ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-blue-600">
                                    {(holding.weight * 100).toFixed(1)}%
                                  </div>
                                  <div className="text-gray-600">
                                    {Math.round(holding.shares).toLocaleString()}
                                  </div>
                                  <div className="text-gray-800 font-medium">
                                    {formatCurrency(holding.value)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Each cell shows: Weight % / Number of Shares / Dollar Value
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">📊</span>
        <h2 className="text-2xl font-semibold text-primary-900">
          Analysis Results
        </h2>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Strategy Comparison Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-4 font-semibold text-gray-900">Strategy</th>
              <th className="text-right p-4 font-semibold text-gray-900">Total Return</th>
              <th className="text-right p-4 font-semibold text-gray-900">Annualized Return</th>
              <th className="text-right p-4 font-semibold text-gray-900">Final Value</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map(strategy => {
              const data = results[strategy.key]
              if (!data) return null

              return (
                <tr key={strategy.key} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{strategy.icon}</span>
                      <span className="font-medium">{strategy.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono">
                    <span className={data.totalReturn > 0 ? 'text-success' : 'text-danger'}>
                      {formatPercentage(data.totalReturn)}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono">
                    <span className={data.annualizedReturn > 0 ? 'text-success' : 'text-danger'}>
                      {formatPercentage(data.annualizedReturn)}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold">
                    {formatCurrency(data.finalValue)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-gray-50 rounded-lg p-8 mb-6 text-center">
        <div className="text-4xl mb-4">📈</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Performance Chart
        </h3>
        <p className="text-gray-600">
          Interactive chart visualization will be implemented here
        </p>
      </div>

      {/* Export Options */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <span>📄</span>
          <span>Export Options</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={handleExcelDownload}
            className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <span>✅</span>
            <div className="text-left">
              <div className="font-medium">Excel Report (.xlsx)</div>
              <div className="text-sm text-gray-600">Download results in Excel-compatible format</div>
            </div>
          </button>
          
          <button className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <span>📊</span>
            <div className="text-left">
              <div className="font-medium">Strategy Tabs</div>
              <div className="text-sm text-gray-600">Detailed holdings and allocations by year</div>
            </div>
          </button>
          
          <button className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <span>📈</span>
            <div className="text-left">
              <div className="font-medium">Performance Metrics</div>
              <div className="text-sm text-gray-600">Returns, volatility, Sharpe ratios</div>
            </div>
          </button>
        </div>
      </div>

      {/* Analysis Parameters */}
      {results.parameters && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Analysis Parameters</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Period:</span>
              <span className="ml-2 font-medium">{results.parameters.startYear} - {results.parameters.endYear}</span>
            </div>
            <div>
              <span className="text-blue-700">Initial Investment:</span>
              <span className="ml-2 font-medium">{formatCurrency(results.parameters.initialInvestment)}</span>
            </div>
            <div>
              <span className="text-blue-700">Strategies Compared:</span>
              <span className="ml-2 font-medium">{strategies.filter(s => results[s.key]).length}</span>
            </div>
          </div>
        </div>
      )}

          {/* Notice for Mock Data */}
          {results.message && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-800">
                <span>⚠️</span>
                <span className="text-sm">{results.message}</span>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'holdings' ? (
        // Holdings View
        renderHoldingsView()
      ) : (
        // Individual Strategy Detail Views
        <div>
          {activeTab === 'equalWeightBuyHold' && renderStrategyDetail('equalWeightBuyHold', 'Equal Weight Buy & Hold', '⚖️')}
          {activeTab === 'marketCapBuyHold' && renderStrategyDetail('marketCapBuyHold', 'Market Cap Buy & Hold', '📈')}
          {activeTab === 'equalWeightRebalanced' && renderStrategyDetail('equalWeightRebalanced', 'Equal Weight Rebalanced', '🔄')}
          {activeTab === 'marketCapRebalanced' && renderStrategyDetail('marketCapRebalanced', 'Market Cap Rebalanced', '📊')}
          {activeTab === 'spyBenchmark' && renderStrategyDetail('spyBenchmark', 'SPY Benchmark', '🏛️')}
        </div>
      )}
    </div>
  )
}