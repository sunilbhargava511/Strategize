import { useState, useEffect } from 'react'

interface CachedAnalysis {
  key: string;
  tickers: string[];
  startYear: number;
  endYear: number;
  initialInvestment: number;
  tickerCount: number;
  cachedAt?: string;
  expiresAt?: string;
  isPermanent: boolean;
  size?: number;
  customName?: string;
  cachedData?: any;
}

interface CacheManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnalysis?: (analysis: CachedAnalysis) => void;
}

export default function CacheManagement({ isOpen, onClose, onSelectAnalysis }: CacheManagementProps) {
  const [analyses, setAnalyses] = useState<CachedAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [totalSize, setTotalSize] = useState(0)
  const [sortBy, setSortBy] = useState<'date' | 'tickers' | 'period'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [tickerInput, setTickerInput] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [fillCacheInput, setFillCacheInput] = useState('')
  const [fillCacheLoading, setFillCacheLoading] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [viewTickerInput, setViewTickerInput] = useState('')
  const [viewTickerData, setViewTickerData] = useState<any>(null)
  const [viewTickerLoading, setViewTickerLoading] = useState(false)

  const fetchCachedAnalyses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cache-management')
      if (response.ok) {
        const data = await response.json()
        setAnalyses(data.analyses || [])
        setTotalSize(data.totalSizeBytes || 0)
        setCacheStats(data.cacheStatistics || null)
      }
    } catch (error) {
      console.error('Failed to fetch cached analyses:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteSelected = async () => {
    if (selectedKeys.size === 0) return

    const confirmMessage = `Are you sure you want to delete ${selectedKeys.size} cached analysis result${selectedKeys.size > 1 ? 's' : ''}?`
    if (!confirm(confirmMessage)) return

    try {
      const response = await fetch('/api/cache-management', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: Array.from(selectedKeys) })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deletedCount} cached analyses`)
        setSelectedKeys(new Set())
        fetchCachedAnalyses()
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      alert('Failed to delete cached analyses')
      console.error('Delete error:', error)
    }
  }

  const clearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL cached analysis results? This cannot be undone.')) return

    try {
      const response = await fetch('/api/cache-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully cleared ${data.deletedCount} cached analyses`)
        setSelectedKeys(new Set())
        fetchCachedAnalyses()
      } else {
        throw new Error('Clear all failed')
      }
    } catch (error) {
      alert('Failed to clear cached analyses')
      console.error('Clear all error:', error)
    }
  }

  const clearMarketData = async () => {
    if (confirmationInput !== 'CLEAR_MARKET_DATA') {
      alert('Please type the confirmation code exactly: CLEAR_MARKET_DATA')
      return
    }

    if (!confirm('⚠️ WARNING: This will clear ALL EODHD market data cache (prices, market caps, shares). This is expensive data that will need to be re-fetched. Are you absolutely sure?')) {
      return
    }

    try {
      const response = await fetch('/api/cache-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'clear_market_data',
          confirmationCode: 'CLEAR_MARKET_DATA'
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully cleared ${data.deletedCount} market data cache entries\n\nBreakdown:\n- Prices: ${data.breakdown?.prices || 0}\n- Market Caps: ${data.breakdown?.marketCaps || 0}\n- Shares: ${data.breakdown?.shares || 0}`)
        setConfirmationInput('')
        fetchCachedAnalyses()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Clear market data failed')
      }
    } catch (error: any) {
      alert(`Failed to clear market data: ${error.message}`)
      console.error('Clear market data error:', error)
    }
  }

  const clearEverything = async () => {
    if (confirmationInput !== 'NUCLEAR_CLEAR_EVERYTHING') {
      alert('Please type the confirmation code exactly: NUCLEAR_CLEAR_EVERYTHING')
      return
    }

    if (!confirm('☢️ NUCLEAR WARNING: This will delete EVERYTHING in the cache - all analyses AND all EODHD market data. This cannot be undone and will be very expensive to rebuild. Are you absolutely certain?')) {
      return
    }

    if (!confirm('Final confirmation: Type YES to proceed with nuclear cache clearing')) {
      return
    }

    try {
      const response = await fetch('/api/cache-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'clear_everything',
          confirmationCode: 'NUCLEAR_CLEAR_EVERYTHING'
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`☢️ NUCLEAR CLEAR COMPLETE: Deleted ALL ${data.deletedCount} cache entries`)
        setConfirmationInput('')
        setSelectedKeys(new Set())
        fetchCachedAnalyses()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Nuclear clear failed')
      }
    } catch (error: any) {
      alert(`Failed to nuclear clear: ${error.message}`)
      console.error('Nuclear clear error:', error)
    }
  }

  const clearByTicker = async () => {
    if (confirmationInput !== 'CLEAR_TICKER_DATA') {
      alert('Please type the confirmation code exactly: CLEAR_TICKER_DATA')
      return
    }

    const tickers = tickerInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t)
    if (tickers.length === 0) {
      alert('Please enter at least one ticker symbol')
      return
    }

    if (!confirm(`Are you sure you want to clear ALL cache data (analyses + market data) for these tickers?\n\n${tickers.join(', ')}\n\nThis cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/cache-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'clear_by_ticker',
          tickers,
          confirmationCode: 'CLEAR_TICKER_DATA'
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully cleared ${data.deletedCount} cache entries for tickers: ${tickers.join(', ')}`)
        setConfirmationInput('')
        setTickerInput('')
        fetchCachedAnalyses()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Clear by ticker failed')
      }
    } catch (error: any) {
      alert(`Failed to clear ticker data: ${error.message}`)
      console.error('Clear by ticker error:', error)
    }
  }

  const parseCSV = (csvContent: string): string[] => {
    const lines = csvContent.split('\n')
    const tickers = new Set<string>()
    
    for (const line of lines) {
      if (line.trim()) {
        // Split by comma and take the first column (ticker symbol)
        const columns = line.split(',')
        if (columns.length > 0) {
          const ticker = columns[0].trim().replace(/['"]/g, '').toUpperCase()
          if (ticker && ticker.length > 0 && ticker !== 'TICKER' && ticker !== 'SYMBOL') {
            tickers.add(ticker)
          }
        }
      }
    }
    
    return Array.from(tickers)
  }

  const getTickersFromInput = async (): Promise<string[]> => {
    let tickers: string[] = []
    
    if (csvFile) {
      // Parse CSV file
      try {
        const csvContent = await csvFile.text()
        tickers = parseCSV(csvContent)
      } catch (error) {
        alert('Failed to read CSV file')
        return []
      }
    } else if (fillCacheInput.trim()) {
      // Parse manual input
      tickers = fillCacheInput.split(',').map(t => t.trim().toUpperCase()).filter(t => t)
    }
    
    if (tickers.length === 0) {
      alert('Please enter ticker symbols manually or upload a CSV file')
      return []
    }
    
    return tickers
  }

  const validateFillCache = async () => {
    const tickers = await getTickersFromInput()
    if (tickers.length === 0) return

    setFillCacheLoading(true)
    try {
      const response = await fetch('/api/fill-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'validate',
          tickers
        })
      })

      if (response.ok) {
        const data = await response.json()
        const cachedCount = data.cached?.length || 0
        const missingCount = data.missing?.length || 0
        const cachedList = data.cached?.join(', ') || 'None'
        const missingList = data.missing?.join(', ') || 'None'
        
        const summary = `Cache Status for ${tickers.length} tickers:\n\n✅ Already Cached: ${cachedCount}\n❌ Missing: ${missingCount}\n\nCached: ${cachedList}\nMissing: ${missingList}`
        alert(summary)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Validation failed')
      }
    } catch (error: any) {
      alert(`Failed to validate cache: ${error.message}`)
      console.error('Validate cache error:', error)
    } finally {
      setFillCacheLoading(false)
    }
  }

  const viewTickerCache = async () => {
    const ticker = viewTickerInput.trim().toUpperCase()
    if (!ticker) {
      alert('Please enter a ticker symbol')
      return
    }

    setViewTickerLoading(true)
    try {
      const response = await fetch(`/api/cache-management?key=${encodeURIComponent(`ticker-data:${ticker}`)}`);
      
      if (response.ok) {
        const data = await response.json()
        setViewTickerData({
          ticker,
          data: data.data,
          found: true,
          yearCount: data.data ? Object.keys(data.data).length : 0
        })
      } else if (response.status === 404) {
        setViewTickerData({
          ticker,
          data: null,
          found: false,
          yearCount: 0
        })
      } else {
        throw new Error('Failed to fetch ticker data')
      }
    } catch (error: any) {
      alert(`Failed to view ticker data: ${error.message}`)
      console.error('View ticker error:', error)
    } finally {
      setViewTickerLoading(false)
    }
  }

  const fillCacheData = async () => {
    const tickers = await getTickersFromInput()
    if (tickers.length === 0) return

    const estimatedTime = Math.ceil(tickers.length / 10)
    if (!confirm(`Fill cache for ${tickers.length} tickers?\n\nThis will fetch historical data from EODHD API.\nEstimated time: ~${estimatedTime} minutes\n\nContinue?`)) {
      return
    }

    setFillCacheLoading(true)
    try {
      const response = await fetch('/api/fill-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'fill',
          tickers
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const successCount = data.results?.successful?.length || data.results?.success?.length || 0
          const errorCount = data.results?.errors?.length || 0
          const warningCount = data.results?.warnings?.length || 0
          const successList = data.results?.successful?.join(', ') || data.results?.success?.join(', ') || 'None'
          const errorList = data.results?.errors?.map((e: any) => `${e.ticker} (${e.error})`).join(', ') || 'None'
          
          alert(`Cache Fill Complete!\n\n✅ Success: ${successCount}\n❌ Errors: ${errorCount}\n⚠️ Warnings: ${warningCount}\n\nSuccessfully cached: ${successList}\nErrors: ${errorList}`)
          setFillCacheInput('')
          fetchCachedAnalyses() // Refresh cache stats
        } else {
          alert(`Cache fill failed: ${data.message}`)
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Fill cache failed')
      }
    } catch (error: any) {
      alert(`Failed to fill cache: ${error.message}`)
      console.error('Fill cache error:', error)
    } finally {
      setFillCacheLoading(false)
    }
  }

  const updateCacheName = async (key: string, customName: string) => {
    try {
      const response = await fetch('/api/cache-management', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, customName })
      })

      if (response.ok) {
        const data = await response.json()
        // Update the local state
        setAnalyses(prev => prev.map(analysis => 
          analysis.key === key 
            ? { ...analysis, customName: customName || undefined }
            : analysis
        ))
        setEditingKey(null)
        setEditingName('')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update name')
      }
    } catch (error: any) {
      alert(`Failed to update cache name: ${error.message}`)
      console.error('Update name error:', error)
    }
  }

  const startEditing = (analysis: CachedAnalysis) => {
    setEditingKey(analysis.key)
    setEditingName(analysis.customName || '')
  }

  const cancelEditing = () => {
    setEditingKey(null)
    setEditingName('')
  }

  const saveEdit = async () => {
    if (editingKey) {
      await updateCacheName(editingKey, editingName.trim())
    }
  }

  const generateDefaultName = (analysis: CachedAnalysis) => {
    const topTickers = analysis.tickers.slice(0, 3).join(', ')
    const suffix = analysis.tickers.length > 3 ? ` +${analysis.tickers.length - 3}` : ''
    return `${topTickers}${suffix} (${analysis.startYear}-${analysis.endYear})`
  }

  const loadAnalysis = async (analysis: CachedAnalysis) => {
    if (!onSelectAnalysis) return
    
    try {
      const response = await fetch(`/api/cache-management?key=${encodeURIComponent(analysis.key)}`)
      if (response.ok) {
        const { data } = await response.json()
        onSelectAnalysis({
          ...analysis,
          cachedData: data
        })
        onClose()
      } else {
        throw new Error('Failed to load cached analysis')
      }
    } catch (error) {
      alert('Failed to load analysis. It may have expired.')
      console.error('Load analysis error:', error)
    }
  }

  const toggleSelection = (key: string) => {
    const newSelected = new Set(selectedKeys)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedKeys(newSelected)
  }

  const selectAll = () => {
    if (selectedKeys.size === analyses.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(analyses.map(a => a.key)))
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    if (dateStr === 'Unknown') return 'Unknown'
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const sortedAnalyses = [...analyses].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'date':
        const dateA = new Date(a.cachedAt === 'Unknown' ? 0 : a.cachedAt!)
        const dateB = new Date(b.cachedAt === 'Unknown' ? 0 : b.cachedAt!)
        comparison = dateA.getTime() - dateB.getTime()
        break
      case 'tickers':
        comparison = a.tickerCount - b.tickerCount
        break
      case 'period':
        comparison = (a.endYear - a.startYear) - (b.endYear - b.startYear)
        break
    }
    
    return sortOrder === 'desc' ? -comparison : comparison
  })

  useEffect(() => {
    if (isOpen) {
      fetchCachedAnalyses()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">💾</span>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Simulation History</h2>
              <p className="text-sm text-gray-600">
                View and manage your analysis history ({analyses.length} total, {formatSize(totalSize)})
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Advanced Settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
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

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <h3 className="text-lg font-semibold text-gray-900">Cache Statistics</h3>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Unique Tickers:</span>
                  <span className="font-bold text-lg text-blue-600">{cacheStats.uniqueTickers.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Cache Structure:</span>
                  <span className="font-medium capitalize">{cacheStats.cacheStructure || 'ticker-based'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Data Points:</span>
                  <span className="font-medium">{cacheStats.totalYearDataPoints ? cacheStats.totalYearDataPoints.toLocaleString() : '0'} year records</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Avg Years/Ticker:</span>
                  <span className="font-medium">{cacheStats.averageYearsPerTicker || '0'} years</span>
                </div>
              </div>
            </div>
            {cacheStats.uniqueTickers > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-700 hover:text-blue-900 font-medium">
                  View all {cacheStats.uniqueTickers} cached tickers
                </summary>
                <div className="mt-2 p-3 bg-white rounded-lg border border-blue-200 max-h-32 overflow-y-auto">
                  <div className="text-xs text-gray-700 font-mono grid grid-cols-8 gap-2">
                    {cacheStats.tickersList.map((ticker: string) => (
                      <span key={ticker} className="hover:text-blue-600 cursor-default">{ticker}</span>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedKeys.size === analyses.length ? 'Deselect All' : 'Select All'}
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="date">Cache Date</option>
                  <option value="tickers">Ticker Count</option>
                  <option value="period">Analysis Period</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchCachedAnalyses}
                disabled={loading}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
              >
                🔄 Refresh
              </button>
              
              {selectedKeys.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-medium"
                >
                  🗑️ Delete Selected ({selectedKeys.size})
                </button>
              )}
              
              <button
                onClick={clearAll}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Controls - shown when gear icon is clicked */}
        {showAdvanced && (
          <div className="border-b border-gray-200 bg-red-50">
            <div className="p-4">
              <div className="mt-4 space-y-4">
                {/* Fill Cache Section */}
                <div className="bg-white border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xl">💾</span>
                    <h4 className="font-semibold text-green-900">Fill Cache with Historical Data</h4>
                  </div>
                  <p className="text-sm text-green-700 mb-4">
                    Pre-populate cache with historical data from EODHD API. This ensures fast simulations without API calls during analysis.
                  </p>
                  
                  <div className="space-y-4">
                    {/* Input Methods */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Manual Entry</h5>
                        <input
                          type="text"
                          placeholder="Enter tickers: AAPL,MSFT,GOOGL"
                          value={fillCacheInput}
                          onChange={(e) => {
                            setFillCacheInput(e.target.value)
                            if (e.target.value.trim()) setCsvFile(null) // Clear CSV if manual input
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">CSV Upload</h5>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setCsvFile(file)
                            if (file) setFillCacheInput('') // Clear manual input if CSV uploaded
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {csvFile && (
                          <div className="text-xs text-green-700">
                            ✅ {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Validate Cache Coverage</h5>
                        <p className="text-xs text-gray-600">Check which tickers are already cached</p>
                        <button
                          onClick={validateFillCache}
                          disabled={fillCacheLoading || (!fillCacheInput.trim() && !csvFile)}
                          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                        >
                          {fillCacheLoading ? '🔍 Validating...' : '🔍 Validate Cache'}
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="font-medium text-gray-900">Fill Cache</h5>
                        <p className="text-xs text-gray-600">Fetch and cache historical data for missing tickers</p>
                        <button
                          onClick={fillCacheData}
                          disabled={fillCacheLoading || (!fillCacheInput.trim() && !csvFile)}
                          className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                        >
                          {fillCacheLoading ? '⏳ Filling Cache...' : '💾 Fill Cache'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">ℹ️</span>
                      <div className="text-sm text-blue-800">
                        <strong>Pro Tip:</strong> Fill cache during off-peak hours. Large portfolios (100+ tickers) may take 10+ minutes. 
                        Use validation first to see what's already cached.
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Ticker Data Section */}
                <div className="bg-white border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xl">🔍</span>
                    <h4 className="font-semibold text-purple-900">View Ticker Cache Data</h4>
                  </div>
                  <p className="text-sm text-purple-700 mb-4">
                    Inspect the cached data for a specific ticker to verify what's stored.
                  </p>
                  
                  <div className="flex items-end space-x-3 mb-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 mb-1">Ticker Symbol</label>
                      <input
                        type="text"
                        placeholder="e.g., AAPL"
                        value={viewTickerInput}
                        onChange={(e) => setViewTickerInput(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && viewTickerCache()}
                      />
                    </div>
                    <button
                      onClick={viewTickerCache}
                      disabled={viewTickerLoading || !viewTickerInput.trim()}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                    >
                      {viewTickerLoading ? '🔍 Loading...' : '🔍 View Data'}
                    </button>
                  </div>

                  {/* Results Display */}
                  {viewTickerData && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900">
                          {viewTickerData.found ? '✅' : '❌'} Cache Data for {viewTickerData.ticker}
                        </h5>
                        <button
                          onClick={() => setViewTickerData(null)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Close"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {viewTickerData.found ? (
                        <div>
                          <div className="text-sm text-gray-600 mb-3">
                            <strong>Years cached:</strong> {viewTickerData.yearCount} years
                          </div>
                          
                          <div className="max-h-64 overflow-y-auto bg-white border rounded p-3">
                            <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                              {JSON.stringify(viewTickerData.data, null, 2)}
                            </pre>
                          </div>
                          
                          <div className="mt-3 text-xs text-gray-500">
                            Data format: Each year contains price, market_cap, and shares_outstanding
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-gray-500 mb-2">❌ No cache data found for {viewTickerData.ticker}</div>
                          <div className="text-xs text-gray-400">
                            This ticker has not been cached yet. Use Fill Cache to populate it.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xl">☢️</span>
                    <h4 className="font-semibold text-red-900">Dangerous Operations</h4>
                  </div>
                  <p className="text-sm text-red-700 mb-4">
                    These operations affect EODHD market data cache, which is expensive to rebuild. Use with extreme caution.
                  </p>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Clear Market Data */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Clear Market Data</h5>
                      <p className="text-xs text-gray-600">Clears all EODHD price, market cap, and shares data</p>
                      <input
                        type="text"
                        placeholder="Type: CLEAR_MARKET_DATA"
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={clearMarketData}
                        disabled={confirmationInput !== 'CLEAR_MARKET_DATA'}
                        className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                      >
                        🚨 Clear Market Data
                      </button>
                    </div>

                    {/* Clear By Ticker */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Clear By Ticker</h5>
                      <p className="text-xs text-gray-600">Clears all data for specific tickers</p>
                      <input
                        type="text"
                        placeholder="Enter tickers: AAPL,MSFT"
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Type: CLEAR_TICKER_DATA"
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={clearByTicker}
                        disabled={confirmationInput !== 'CLEAR_TICKER_DATA' || !tickerInput.trim()}
                        className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded text-sm font-medium"
                      >
                        🗑️ Clear Ticker Data
                      </button>
                    </div>

                    {/* Nuclear Option */}
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900">Nuclear Clear</h5>
                      <p className="text-xs text-gray-600">⚠️ Deletes EVERYTHING in cache</p>
                      <input
                        type="text"
                        placeholder="Type: NUCLEAR_CLEAR_EVERYTHING"
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        className="w-full px-3 py-2 border border-red-400 rounded text-sm"
                      />
                      <button
                        onClick={clearEverything}
                        disabled={confirmationInput !== 'NUCLEAR_CLEAR_EVERYTHING'}
                        className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded text-sm font-bold"
                      >
                        ☢️ NUCLEAR CLEAR
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="flex items-start space-x-2">
                      <span className="text-yellow-600 mt-0.5">⚠️</span>
                      <div className="text-sm text-yellow-800">
                        <strong>Warning:</strong> Advanced operations require confirmation codes and will permanently delete cached data. 
                        EODHD market data is expensive to re-fetch and may take significant time to rebuild.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading cached analyses...</span>
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">📭</span>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No cached analyses found</h3>
              <p className="text-gray-600">Run some analyses to see them appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedKeys.size === analyses.length && analyses.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Analysis</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Period</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Investment</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Cached</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Size</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAnalyses.map((analysis) => (
                    <tr key={analysis.key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(analysis.key)}
                          onChange={() => toggleSelection(analysis.key)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {editingKey === analysis.key ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') cancelEditing()
                              }}
                              className="text-sm border border-blue-400 rounded px-2 py-1 min-w-0 flex-1"
                              placeholder="Enter analysis name..."
                              autoFocus
                            />
                            <button
                              onClick={saveEdit}
                              className="text-green-600 hover:text-green-800"
                              title="Save"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-red-600 hover:text-red-800"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 group">
                            <div className="font-medium text-gray-900 min-w-0 flex-1">
                              {analysis.customName || (
                                <span className="text-gray-500 italic">
                                  {generateDefaultName(analysis)}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => startEditing(analysis)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              title="Edit name"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {analysis.tickers.length} tickers
                          </div>
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {analysis.tickers.slice(0, 5).join(', ')}
                            {analysis.tickers.length > 5 && ` +${analysis.tickers.length - 5} more`}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {analysis.startYear} - {analysis.endYear}
                        <div className="text-xs text-gray-500">
                          {analysis.endYear - analysis.startYear + 1} years
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        ${analysis.initialInvestment ? analysis.initialInvestment.toLocaleString() : '0'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(analysis.cachedAt || 'Unknown')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatSize(analysis.size || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => loadAnalysis(analysis)}
                          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                          title="Load this analysis"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Load</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}