import { useState, useEffect } from 'react'

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [detailedStats, setDetailedStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetchCacheStats()
  }, [])

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/health')
      if (response.ok) {
        const data = await response.json()
        setCacheStats(data.cache)
      }
    } catch (error) {
      console.error('Failed to fetch cache stats:', error)
    }
  }

  const fetchDetailedStats = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/cache-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      })
      if (response.ok) {
        const data = await response.json()
        setDetailedStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch detailed stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearCache = async (pattern: string = 'market-cap:*') => {
    if (!confirm(`Are you sure you want to clear cache pattern "${pattern}"? This action cannot be undone.`)) {
      return
    }

    setIsClearing(true)
    try {
      const response = await fetch('/api/cache-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-pattern', pattern })
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`✅ ${data.message}\nDeleted: ${data.deleted} entries`)
        await fetchCacheStats()
        if (detailedStats) await fetchDetailedStats()
      } else {
        const error = await response.json()
        alert(`❌ Error: ${error.message}`)
      }
    } catch (error) {
      console.error('Clear cache error:', error)
      alert('Failed to clear cache. Please try again.')
    } finally {
      setIsClearing(false)
    }
  }

  const handleExportCache = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/cache-export-excel')
      
      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the blob from the response
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cache-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export cache. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">💾</span>
          <h2 className="text-2xl font-semibold text-primary-900">
            Cache Management
          </h2>
        </div>
        <button
          onClick={fetchCacheStats}
          disabled={isLoading}
          className="text-primary-500 hover:text-primary-600 text-sm"
        >
          🔄 Refresh Stats
        </button>
      </div>

      {/* Cache Statistics */}
      {cacheStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Status</div>
            <div className="text-lg font-semibold text-gray-900 capitalize">
              {cacheStats.status === 'operational' ? '✅ ' : '❌ '}
              {cacheStats.status}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Cache Type</div>
            <div className="text-lg font-semibold text-gray-900">
              {cacheStats.type || 'Not configured'}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Cached Items</div>
            <div className="text-lg font-semibold text-gray-900">
              {cacheStats.size !== undefined ? cacheStats.size.toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Cache Data</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleExportCache}
            disabled={isExporting}
            className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">📥</span>
            <div className="text-left">
              <div className="font-medium">
                {isExporting ? 'Exporting...' : 'Export Test Data'}
              </div>
              <div className="text-sm text-gray-600">
                Download as Excel with Price, Market Cap & Shares tabs
              </div>
            </div>
          </button>

          <button
            disabled
            className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed"
          >
            <span className="text-2xl">📤</span>
            <div className="text-left">
              <div className="font-medium">Import Cache Data</div>
              <div className="text-sm text-gray-600">
                Coming soon - Upload cache backup
              </div>
            </div>
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600">ℹ️</span>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Cache Export:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Exports data organized by year in Excel format</li>
                <li>Tab 1: Prices - Adjusted close prices by ticker and year</li>
                <li>Tab 2: Market Cap - Real market capitalization from EODHD</li>
                <li>Tab 3: Shares Outstanding - Actual share counts from fundamentals</li>
                <li>Tab 4: Summary - Export metadata and notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Cache Management */}
      <div className="border-t pt-6 mt-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-lg font-semibold text-gray-900 mb-4 hover:text-primary-600 transition-colors"
        >
          <span>{showAdvanced ? '🔽' : '▶️'}</span>
          <span>Advanced Cache Management</span>
        </button>

        {showAdvanced && (
          <div className="space-y-6">
            {/* Detailed Statistics */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Detailed Statistics</h4>
                <button
                  onClick={fetchDetailedStats}
                  disabled={isLoading}
                  className="text-sm text-primary-500 hover:text-primary-600 disabled:opacity-50"
                >
                  {isLoading ? '🔄 Loading...' : '📊 Get Detailed Stats'}
                </button>
              </div>

              {detailedStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600">Total Keys</div>
                    <div className="text-lg font-semibold">{detailedStats.total_keys?.toLocaleString()}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600">Market Data</div>
                    <div className="text-lg font-semibold text-green-800">{detailedStats.market_cap_entries?.toLocaleString()}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600">Backtests</div>
                    <div className="text-lg font-semibold text-blue-800">{detailedStats.backtest_entries?.toLocaleString()}</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-gray-600">Est. Memory</div>
                    <div className="text-lg font-semibold text-purple-800">{detailedStats.memory_usage_estimate}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Cache Operations */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Cache Operations</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Clear Market Data */}
                <button
                  onClick={() => handleClearCache('market-cap:*')}
                  disabled={isClearing}
                  className="flex items-center space-x-2 p-3 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-red-600 text-xl">🗑️</span>
                  <div className="text-left">
                    <div className="font-medium text-red-800">Clear Market Data</div>
                    <div className="text-sm text-red-600">Remove all price/market cap cache</div>
                  </div>
                </button>

                {/* Clear Backtests */}
                <button
                  onClick={() => handleClearCache('backtest:*')}
                  disabled={isClearing}
                  className="flex items-center space-x-2 p-3 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-orange-600 text-xl">📊</span>
                  <div className="text-left">
                    <div className="font-medium text-orange-800">Clear Backtests</div>
                    <div className="text-sm text-orange-600">Remove all backtest results</div>
                  </div>
                </button>

                {/* Clear All (Dangerous) */}
                <button
                  onClick={() => {
                    if (confirm('⚠️ DANGER: This will clear ALL cache data. Are you absolutely sure?')) {
                      handleClearCache('*')
                    }
                  }}
                  disabled={isClearing}
                  className="flex items-center space-x-2 p-3 border-2 border-red-500 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <span className="text-red-700 text-xl">💣</span>
                  <div className="text-left">
                    <div className="font-medium text-red-700">Clear Everything</div>
                    <div className="text-sm text-red-600">⚠️ Destructive operation</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Cache Bypass Instructions */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <span className="text-yellow-600 text-lg">⚡</span>
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-2">Cache Bypass Options:</p>
                  <div className="space-y-1">
                    <p><strong>Market Data API:</strong> Add <code className="bg-yellow-200 px-1 rounded">?bypass_cache=true</code> to any market-cap API call</p>
                    <p><strong>Backtest API:</strong> Include <code className="bg-yellow-200 px-1 rounded">"bypass_cache": true</code> in the request body</p>
                    <p><strong>UI:</strong> Hold <kbd className="bg-yellow-200 px-1 rounded">Shift</kbd> while clicking "Run Analysis" to bypass cache</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}