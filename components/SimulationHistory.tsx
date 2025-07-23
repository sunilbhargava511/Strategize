import { useState, useEffect } from 'react'

interface CachedAnalysis {
  key: string
  tickers: string[]
  startYear: number
  endYear: number
  initialInvestment: number
  tickerCount: number
  cachedAt?: string
  expiresAt?: string
  isPermanent: boolean
  size?: number
  customName?: string
}

interface SimulationHistoryProps {
  onLoadAnalysis?: (analysis: CachedAnalysis) => void
}

export default function SimulationHistory({ onLoadAnalysis }: SimulationHistoryProps) {
  const [analyses, setAnalyses] = useState<CachedAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [tempName, setTempName] = useState('')

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/cache-management')
      if (!response.ok) {
        throw new Error('Failed to fetch simulation history')
      }
      
      const data = await response.json()
      setAnalyses(data.analyses || [])
    } catch (err: any) {
      console.error('Error fetching simulation history:', err)
      setError(err.message || 'Failed to load simulation history')
    } finally {
      setLoading(false)
    }
  }

  const handleRename = async (key: string, newName: string) => {
    try {
      const response = await fetch('/api/cache-management', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, customName: newName })
      })

      if (!response.ok) {
        throw new Error('Failed to rename simulation')
      }

      // Update local state
      setAnalyses(prev => prev.map(analysis => 
        analysis.key === key 
          ? { ...analysis, customName: newName }
          : analysis
      ))
      
      setEditingName(null)
    } catch (err: any) {
      console.error('Error renaming simulation:', err)
      alert(`Failed to rename: ${err.message}`)
    }
  }

  const handleDelete = async (keys: string[]) => {
    if (!confirm(`Delete ${keys.length} simulation(s)? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/cache-management', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys })
      })

      if (!response.ok) {
        throw new Error('Failed to delete simulations')
      }

      // Remove from local state
      setAnalyses(prev => prev.filter(analysis => !keys.includes(analysis.key)))
    } catch (err: any) {
      console.error('Error deleting simulations:', err)
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleQuickLoad = async (analysis: CachedAnalysis) => {
    try {
      // Fetch the actual cached data
      const response = await fetch(`/api/cache-management?key=${encodeURIComponent(analysis.key)}`)
      if (!response.ok) {
        throw new Error('Failed to load simulation data')
      }
      
      const data = await response.json()
      
      // Call the parent callback with the analysis and cached data
      if (onLoadAnalysis) {
        onLoadAnalysis({
          ...analysis,
          cachedData: data.data
        })
      }
    } catch (err: any) {
      console.error('Error loading simulation:', err)
      alert(`Failed to load simulation: ${err.message}`)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Unknown') return 'Unknown'
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  const formatTickers = (tickers: string[], maxShow: number = 3) => {
    if (tickers.length <= maxShow) {
      return tickers.join(', ')
    }
    return `${tickers.slice(0, maxShow).join(', ')} +${tickers.length - maxShow} more`
  }

  useEffect(() => {
    fetchAnalyses()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Simulation History</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading simulation history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Simulation History</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchAnalyses}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Simulation History</h3>
            <p className="text-sm text-gray-600">{analyses.length} cached simulations</p>
          </div>
        </div>
        <button
          onClick={fetchAnalyses}
          className="flex items-center space-x-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Simulations Yet</h4>
          <p className="text-gray-600">Run your first analysis to see results here</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {analyses.map((analysis) => (
            <div
              key={analysis.key}
              className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  {editingName === analysis.key ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => {
                        if (tempName.trim()) {
                          handleRename(analysis.key, tempName.trim())
                        } else {
                          setEditingName(null)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (tempName.trim()) {
                            handleRename(analysis.key, tempName.trim())
                          } else {
                            setEditingName(null)
                          }
                        } else if (e.key === 'Escape') {
                          setEditingName(null)
                        }
                      }}
                      className="text-lg font-semibold text-gray-900 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {analysis.customName || `${formatTickers(analysis.tickers)} (${analysis.startYear}-${analysis.endYear})`}
                      </h4>
                      <button
                        onClick={() => {
                          setEditingName(analysis.key)
                          setTempName(analysis.customName || '')
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Edit name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span>{analysis.tickerCount} tickers</span>
                    <span>{analysis.startYear}-{analysis.endYear}</span>
                    <span>${(analysis.initialInvestment / 1000000).toFixed(1)}M</span>
                    <span>Cached {formatDate(analysis.cachedAt)}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatTickers(analysis.tickers, 5)}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleQuickLoad(analysis)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                    title="Quick load this simulation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Load</span>
                  </button>
                  <button
                    onClick={() => handleDelete([analysis.key])}
                    className="flex items-center space-x-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm"
                    title="Delete this simulation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}