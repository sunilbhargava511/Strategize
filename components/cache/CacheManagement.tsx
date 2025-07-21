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
}

interface CacheManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CacheManagement({ isOpen, onClose }: CacheManagementProps) {
  const [analyses, setAnalyses] = useState<CachedAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [totalSize, setTotalSize] = useState(0)
  const [sortBy, setSortBy] = useState<'date' | 'tickers' | 'period'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Analysis</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Period</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Investment</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Cached</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Expires</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Size</th>
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
                        ${analysis.initialInvestment.toLocaleString()}
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