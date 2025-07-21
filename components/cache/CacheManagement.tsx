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

  const fetchCachedAnalyses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cache-management')
      if (response.ok) {
        const data = await response.json()
        setAnalyses(data.analyses || [])
        setTotalSize(data.totalSizeBytes || 0)
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">💾</span>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Cache Management</h2>
              <p className="text-sm text-gray-600">
                View and manage cached analysis results ({analyses.length} total, {formatSize(totalSize)})
              </p>
            </div>
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

        {/* Advanced Controls */}
        <div className="border-b border-gray-200 bg-red-50">
          <div className="p-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-red-700 hover:text-red-900 font-medium"
            >
              <span className="text-lg">⚠️</span>
              <span>Advanced Cache Controls</span>
              <svg 
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4">
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
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[60vh]">
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Expires</th>
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
                            {analysis.tickerCount} tickers
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
                      <td className="px-4 py-3 text-sm">
                        {analysis.isPermanent ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ♾️ Permanent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⏰ 24h
                          </span>
                        )}
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