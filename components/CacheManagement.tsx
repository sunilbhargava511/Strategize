import { useState, useEffect } from 'react'

interface CacheStats {
  uniqueTickers: number
  cacheStructure: string
  failedTickersCount: number
  tickersList?: string[]
  failedTickers?: Array<{
    ticker: string
    error: string
    failed_at: string
    last_attempt: string
  }>
}

interface FillCacheProgress {
  processed: number
  total: number
  percentage: number
  successful: number
  failed: number
  currentTicker?: string
}

interface CacheManagementProps {
  isOpen: boolean
  onClose: () => void
}

export default function CacheManagement({ isOpen, onClose }: CacheManagementProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [cacheStatsLoading, setCacheStatsLoading] = useState(false)
  const [cacheStatsError, setCacheStatsError] = useState<string | null>(null)
  
  const [fillCacheInput, setFillCacheInput] = useState('')
  const [fillCacheLoading, setFillCacheLoading] = useState(false)
  const [fillCacheProgress, setFillCacheProgress] = useState<FillCacheProgress | null>(null)
  
  const [viewTickerInput, setViewTickerInput] = useState('')
  const [viewTickerLoading, setViewTickerLoading] = useState(false)
  const [viewTickerData, setViewTickerData] = useState<any>(null)
  
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const fetchCacheStats = async () => {
    setCacheStatsLoading(true)
    setCacheStatsError(null)
    try {
      const response = await fetch('/api/cache-management')
      if (!response.ok) throw new Error('Failed to fetch cache stats')
      const data = await response.json()
      setCacheStats(data.cacheStatistics || null)
    } catch (error: any) {
      console.error('Error fetching cache stats:', error)
      setCacheStatsError(error.message)
    } finally {
      setCacheStatsLoading(false)
    }
  }

  const validateFillCache = async () => {
    if (!fillCacheInput.trim()) {
      alert('Please enter some tickers first')
      return
    }

    const tickers = fillCacheInput
      .split(/[,\s\n\r\t]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t && t.length > 0)

    if (tickers.length === 0) {
      alert('No valid tickers found')
      return
    }

    try {
      const response = await fetch('/api/fill-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, action: 'validate' })
      })

      if (!response.ok) throw new Error('Validation failed')
      const data = await response.json()
      
      const { cached, missing, failed } = data
      const summary = [
        `📊 Validation Results for ${tickers.length} tickers:`,
        `✅ Already cached: ${cached.length}`,
        `❌ Missing from cache: ${missing.length}`,
        failed.length > 0 ? `⚠️ Previously failed: ${failed.length}` : null
      ].filter(Boolean).join('\n')

      alert(summary)
    } catch (error: any) {
      alert(`Validation error: ${error.message}`)
    }
  }

  const fillCacheData = async () => {
    if (!fillCacheInput.trim()) {
      alert('Please enter some tickers first')
      return
    }

    const tickers = fillCacheInput
      .split(/[,\s\n\r\t]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t && t.length > 0)

    if (tickers.length === 0) {
      alert('No valid tickers found')
      return
    }

    setFillCacheLoading(true)
    setFillCacheProgress({
      processed: 0,
      total: tickers.length,
      percentage: 0,
      successful: 0,
      failed: 0
    })

    try {
      const response = await fetch('/api/fill-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, action: 'fill' })
      })

      if (!response.ok) throw new Error('Fill cache failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.progress) {
              setFillCacheProgress(data.progress)
            }
          } catch (e) {
            // Ignore invalid JSON lines
          }
        }
      }
    } catch (error: any) {
      alert(`Fill cache error: ${error.message}`)
    } finally {
      setFillCacheLoading(false)
      setFillCacheProgress(null)
    }
  }

  const viewTickerCache = async () => {
    if (!viewTickerInput.trim()) return

    setViewTickerLoading(true)
    try {
      const response = await fetch(`/api/ticker-cache?ticker=${encodeURIComponent(viewTickerInput)}`)
      if (!response.ok) throw new Error('Failed to fetch ticker data')
      const data = await response.json()
      setViewTickerData(data.data || {})
    } catch (error: any) {
      alert(`Error: ${error.message}`)
      setViewTickerData({})
    } finally {
      setViewTickerLoading(false)
    }
  }

  const clearFailedTicker = async (ticker: string) => {
    try {
      const response = await fetch('/api/cache-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_failed_ticker', ticker })
      })

      if (!response.ok) throw new Error('Failed to remove failed ticker')
      const data = await response.json()
      
      alert(data.message)
      fetchCacheStats() // Refresh stats
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCacheStats()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Cache Management</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Cache Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-700">Cache Statistics</h3>
              </div>
              <button
                onClick={fetchCacheStats}
                disabled={cacheStatsLoading}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>

            {cacheStatsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading cache statistics...</p>
              </div>
            ) : cacheStatsError ? (
              <div className="text-center py-4 text-red-600">
                <p>{cacheStatsError}</p>
              </div>
            ) : cacheStats ? (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Unique Tickers:</span>
                  <span className="ml-2 font-semibold text-blue-600">{cacheStats.uniqueTickers || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cache Structure:</span>
                  <span className="ml-2 font-semibold text-gray-900">{cacheStats.cacheStructure || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Failed Tickers:</span>
                  <span className={`ml-2 font-semibold ${(cacheStats.failedTickersCount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {cacheStats.failedTickersCount || 0}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Fill Cache Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Fill Cache with Historical Data</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Manual Entry</label>
                <input
                  type="text"
                  value={fillCacheInput}
                  onChange={(e) => setFillCacheInput(e.target.value)}
                  placeholder="Enter tickers: AAPL,MSFT,GOOGL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CSV Upload</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setCsvFile(file)
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          try {
                            const text = event.target?.result as string
                            const rawTickers = text.split(/[,\n\r\t\s]+/)
                              .map(t => t.trim().replace(/['"]/g, '').toUpperCase())
                              .filter(t => t && t !== 'TICKER' && t !== 'SYMBOL' && t !== 'STOCK')
                            const tickers = Array.from(new Set(rawTickers))
                            setFillCacheInput(tickers.join(', '))
                          } catch (error) {
                            alert('Error reading CSV file. Please check the format.')
                          }
                        }
                        reader.readAsText(file)
                      }
                    }}
                    className="hidden"
                    id="csvUpload"
                  />
                  <label 
                    htmlFor="csvUpload"
                    className="flex-1 cursor-pointer bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-200 rounded-lg p-2 text-center text-sm text-blue-600"
                  >
                    {csvFile ? csvFile.name : 'Choose File'}
                  </label>
                  {csvFile && (
                    <button
                      onClick={() => {
                        setCsvFile(null)
                        const fileInput = document.getElementById('csvUpload') as HTMLInputElement
                        if (fileInput) fileInput.value = ''
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={validateFillCache}
                disabled={fillCacheLoading || !fillCacheInput.trim()}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 disabled:text-gray-400 rounded-lg transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Validate Cache</span>
              </button>
              
              <button
                onClick={fillCacheData}
                disabled={fillCacheLoading || !fillCacheInput.trim()}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 hover:bg-green-100 disabled:bg-gray-100 text-green-700 disabled:text-gray-400 rounded-lg transition-colors text-sm font-medium"
              >
                {fillCacheLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    <span>Filling...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Fill Cache</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Display */}
            {fillCacheProgress && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex justify-between text-xs text-gray-600 mb-2">
                  <span>Processing tickers...</span>
                  <span>{fillCacheProgress.processed}/{fillCacheProgress.total} ({fillCacheProgress.percentage.toFixed(1)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all duration-300"
                       style={{ width: `${fillCacheProgress.percentage}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">✅ Success: {fillCacheProgress.successful}</span>
                  <span className="text-red-600">❌ Failed: {fillCacheProgress.failed}</span>
                </div>
                {fillCacheProgress.currentTicker && (
                  <div className="text-xs text-gray-500 mt-1">
                    Currently processing: <span className="font-medium">{fillCacheProgress.currentTicker}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* View Ticker Cache */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">View Ticker Cache Data</h3>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                value={viewTickerInput}
                onChange={(e) => setViewTickerInput(e.target.value.toUpperCase())}
                placeholder="e.g., AAPL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && viewTickerInput.trim()) {
                    viewTickerCache()
                  }
                }}
              />
              
              <button
                onClick={viewTickerCache}
                disabled={viewTickerLoading || !viewTickerInput.trim()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 disabled:bg-gray-100 text-purple-700 disabled:text-gray-400 rounded-lg transition-colors text-sm font-medium"
              >
                {viewTickerLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>View Data</span>
                  </>
                )}
              </button>
              
              {/* Display Cache Data */}
              {viewTickerData && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Cache Data for {viewTickerInput}
                    </h4>
                    <button
                      onClick={() => setViewTickerData(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {Object.keys(viewTickerData).length > 0 ? (
                      <>
                        <div className="text-gray-600 mb-2">
                          <strong>Years available:</strong> {Object.keys(viewTickerData).length} ({Object.keys(viewTickerData).sort().join(', ')})
                        </div>
                        {Object.entries(viewTickerData).slice(0, 5).map(([year, data]: [string, any]) => (
                          <div key={year} className="bg-white p-2 rounded border">
                            <div className="font-medium text-gray-700 mb-1">{year}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>Price: <span className="font-medium">${data.price?.toFixed(2) || 'N/A'}</span></div>
                              <div>Market Cap: <span className="font-medium">${data.market_cap ? (data.market_cap / 1e9).toFixed(2) + 'B' : 'N/A'}</span></div>
                              {data.shares_outstanding && (
                                <div className="col-span-2">Shares: <span className="font-medium">{data.shares_outstanding.toLocaleString()}</span></div>
                              )}
                            </div>
                          </div>
                        ))}
                        {Object.keys(viewTickerData).length > 5 && (
                          <div className="text-center text-gray-500 text-xs mt-2">
                            ... and {Object.keys(viewTickerData).length - 5} more years
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-gray-500 text-center py-2">
                        No cache data found for {viewTickerInput}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Remove Failed Tickers */}
          {cacheStats && cacheStats.failedTickersCount > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Failed Tickers</h3>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cacheStats.failedTickers?.map((failed, index) => (
                  <div key={index} className="bg-red-50 rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-red-900">{failed.ticker}</span>
                      <button
                        onClick={() => clearFailedTicker(failed.ticker)}
                        className="text-red-600 hover:text-red-700"
                        title="Remove from failed list"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-red-700">{failed.error}</p>
                    {failed.last_attempt && (
                      <p className="text-red-600 mt-1">
                        Last attempt: {new Date(failed.last_attempt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}