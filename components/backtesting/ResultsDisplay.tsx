interface ResultsDisplayProps {
  results: any
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
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
          results,
          bypass_cache: bypassCache
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">📊</span>
        <h2 className="text-2xl font-semibold text-primary-900">
          Analysis Results
        </h2>
      </div>

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
  )
}