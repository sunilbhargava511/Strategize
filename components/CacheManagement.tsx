import { useState, useEffect } from 'react'

interface CacheStats {
  uniqueTickers: number
  cacheStructure: string
  failedTickersCount: number
  tickersList?: string[]
  backtestCount?: number
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
  const [exportTickerInput, setExportTickerInput] = useState('')
  const [exportLoading, setExportLoading] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  

  const fetchCacheStats = async () => {
    setCacheStatsLoading(true)
    setCacheStatsError(null)
    try {
      const response = await fetch('/api/cache-management')
      if (!response.ok) throw new Error('Failed to fetch cache stats')
      const data = await response.json()
      
      // Ensure cacheStatistics has proper structure
      const cacheStats = data.cacheStatistics || {}
      const normalizedStats = {
        uniqueTickers: cacheStats.uniqueTickers || 0,
        cacheStructure: cacheStats.cacheStructure || 'Unknown',
        failedTickersCount: cacheStats.failedTickersCount || 0,
        tickersList: cacheStats.tickersList || [],
        failedTickers: cacheStats.failedTickers || []
      }
      
      setCacheStats(normalizedStats)
    } catch (error: any) {
      console.error('Error fetching cache stats:', error)
      setCacheStatsError(error.message)
      // Set empty stats on error to prevent undefined access
      setCacheStats({
        uniqueTickers: 0,
        cacheStructure: 'Unknown',
        failedTickersCount: 0,
        tickersList: [],
        failedTickers: []
      })
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
      
      const cached = data.cached || []
      const missing = data.missing || []
      const failed = data.failed || []
      
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

      // Check if this is a batch job response (status 202)
      if (response.status === 202) {
        const batchData = await response.json()
        if (batchData.jobId) {
          // Save the job ID to localStorage for easy access in Batch Job Manager
          localStorage.setItem('lastBatchJobId', batchData.jobId)
          console.log('📝 Saved batch job ID to localStorage:', batchData.jobId)
          
          alert(`Batch job created: ${batchData.jobId}\n\nProcessing ${batchData.batchInfo.tickersToProcess} tickers in ${batchData.batchInfo.totalBatches} batches.\n\nUse the "Batch Jobs" button to monitor progress!`)
          return
        }
      }

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
      const response = await fetch(`/api/cache-management?key=${encodeURIComponent(`ticker-data:${viewTickerInput}`)}`)
      if (!response.ok) {
        if (response.status === 404) {
          setViewTickerData({})
          return
        }
        throw new Error('Failed to fetch ticker data')
      }
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

  const exportTickersAsJSON = async () => {
    setExportLoading(true)
    try {
      let tickers: string[] = []
      
      if (exportTickerInput.trim()) {
        // Parse comma-separated input
        tickers = exportTickerInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0)
      } else {
        // Export all cached tickers
        if (!cacheStats?.tickersList || cacheStats.tickersList.length === 0) {
          alert('No cached tickers to export')
          return
        }
        tickers = cacheStats.tickersList
      }

      const response = await fetch('/api/cache-export-tickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Download the JSON file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cache-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      alert(`Successfully exported ${tickers.length} tickers as JSON`)
    } catch (error: any) {
      alert(`Export failed: ${error.message}`)
    } finally {
      setExportLoading(false)
    }
  }

  const importTickersFromJSON = async () => {
    if (!importFile) {
      alert('Please select a JSON file to import')
      return
    }

    setImportLoading(true)
    try {
      const fileContent = await importFile.text()
      const importData = JSON.parse(fileContent)

      // Extract data from export format if needed
      const dataToImport = importData.data || importData

      const response = await fetch('/api/cache-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: dataToImport,
          overwrite: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Import failed')
      }

      const result = await response.json()
      alert(result.message)
      
      // Clear the file input and refresh stats
      setImportFile(null)
      const fileInput = document.getElementById('jsonImport') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      fetchCacheStats()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setImportFile(file || null)
  }


  const exportFailedTickers = () => {
    if (!cacheStats?.failedTickers || cacheStats.failedTickers.length === 0) {
      alert('No failed tickers to export')
      return
    }

    // Create CSV content
    const headers = ['Ticker', 'Error', 'Failed At', 'Last Attempt']
    const csvContent = [
      headers.join(','),
      ...cacheStats.failedTickers.map(failed => [
        failed.ticker,
        `"${failed.error.replace(/"/g, '""')}"`, // Escape quotes in error messages
        failed.failed_at,
        failed.last_attempt
      ].join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `failed-tickers-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportAllCachedTickers = () => {
    if (!cacheStats?.tickersList || cacheStats.tickersList.length === 0) {
      alert('No cached tickers to export')
      return
    }

    // Create CSV content with just ticker symbols
    const csvContent = ['Ticker', ...cacheStats.tickersList].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `cached-tickers-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const retryFailedWithDelisted = async () => {
    if (!cacheStats?.failedTickers || cacheStats.failedTickers.length === 0) {
      alert('No failed tickers to retry')
      return
    }

    const failedTickerSymbols = cacheStats.failedTickers.map(f => f.ticker)
    
    try {
      const response = await fetch('/api/fill-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tickers: failedTickerSymbols, 
          action: 'fill',
          retryDelisted: true
        })
      })

      if (!response.ok) throw new Error('Retry failed')

      // Check if this is a batch job response (status 202)
      if (response.status === 202) {
        const batchData = await response.json()
        if (batchData.jobId) {
          localStorage.setItem('lastBatchJobId', batchData.jobId)
          alert(`Batch job created for retrying ${failedTickerSymbols.length} failed tickers with .DELISTED suffix: ${batchData.jobId}\n\nUse the "Batch Jobs" button to monitor progress!`)
          return
        }
      }

      const data = await response.json()
      alert(`Retry with .DELISTED completed!\nSuccessful: ${data.results?.successful?.length || 0}\nFailed: ${data.results?.errors?.length || 0}`)
      fetchCacheStats() // Refresh to see updated failures
    } catch (error: any) {
      alert(`Retry error: ${error.message}`)
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
              <div className="flex space-x-2">
                <button
                  onClick={exportAllCachedTickers}
                  disabled={!cacheStats?.tickersList || cacheStats.tickersList.length === 0}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-50 hover:bg-green-100 disabled:bg-gray-100 text-green-600 disabled:text-gray-400 rounded text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export Cached</span>
                </button>
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Unique Tickers:</span>
                  <span className="ml-2 font-semibold text-blue-600">{cacheStats.uniqueTickers || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Saved Simulations:</span>
                  <span className="ml-2 font-semibold text-purple-600">{cacheStats.backtestCount || 0}</span>
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Failed Tickers</h3>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={exportFailedTickers}
                    className="flex items-center space-x-1 px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={retryFailedWithDelisted}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retry .DELISTED</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(cacheStats.failedTickers || []).map((failed, index) => (
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

          {/* Advanced Operations */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Advanced Operations</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export JSON */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-indigo-900 mb-2">Export Cache as JSON</h4>
                <p className="text-xs text-indigo-700 mb-3">Export ticker data for backup or sharing</p>
                <input
                  type="text"
                  value={exportTickerInput}
                  onChange={(e) => setExportTickerInput(e.target.value)}
                  placeholder="AAPL,MSFT,GOOGL or leave empty for all"
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm mb-2"
                />
                <button
                  onClick={exportTickersAsJSON}
                  disabled={exportLoading}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-100 text-indigo-700 disabled:text-gray-400 rounded-lg transition-colors text-sm"
                >
                  {exportLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Export JSON</span>
                    </>
                  )}
                </button>
              </div>

              {/* Import JSON */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 mb-2">Import Cache from JSON</h4>
                <p className="text-xs text-green-700 mb-3">Import ticker data from backup file</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                  id="jsonImport"
                />
                <label 
                  htmlFor="jsonImport"
                  className="w-full cursor-pointer bg-green-100 hover:bg-green-200 border-2 border-dashed border-green-200 rounded-lg p-3 text-center text-sm text-green-600 mb-2 block"
                >
                  {importFile ? importFile.name : 'Choose JSON File'}
                </label>
                <button
                  onClick={importTickersFromJSON}
                  disabled={importLoading || !importFile}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-green-100 hover:bg-green-200 disabled:bg-gray-100 text-green-700 disabled:text-gray-400 rounded-lg transition-colors text-sm"
                >
                  {importLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Import JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}