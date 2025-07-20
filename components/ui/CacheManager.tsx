import { useState, useEffect } from 'react'

export default function CacheManager() {
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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
                {isExporting ? 'Exporting...' : 'Export Historical Data'}
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
                <li>Tab 2: Market Cap - Calculated market capitalization</li>
                <li>Tab 3: Shares Outstanding - Estimated share counts</li>
                <li>Tab 4: Summary - Export metadata and notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}