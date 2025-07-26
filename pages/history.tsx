import { useState, useEffect } from 'react'
import Head from 'next/head'
import ResultsDisplay from '../components/backtesting/ResultsDisplay'

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
  cachedData?: any
  winningStrategy?: {
    name: string
    finalValue: number
  }
  worstStrategy?: {
    name: string
    finalValue: number
  }
}

export default function HistoryBrowser() {
  const [analyses, setAnalyses] = useState<CachedAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<CachedAnalysis | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)

  const fetchAnalyses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/simulation-history')
      if (!response.ok) {
        throw new Error('Failed to fetch simulation history')
      }
      
      const data = await response.json()
      // Get last 6 simulations
      setAnalyses((data.analyses || []).slice(0, 6))
    } catch (err: any) {
      console.error('Error fetching simulation history:', err)
      setError(err.message || 'Failed to load simulation history')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadAnalysis = async (analysis: CachedAnalysis) => {
    try {
      setLoadingResults(true)
      
      // Fetch the actual cached data
      const response = await fetch(`/api/cache-management?key=${encodeURIComponent(analysis.key)}`)
      if (!response.ok) {
        throw new Error('Failed to load simulation data')
      }
      
      const data = await response.json()
      
      // Set the selected analysis with cached data
      setSelectedAnalysis({
        ...analysis,
        cachedData: data.data
      })
    } catch (err: any) {
      console.error('Error loading simulation:', err)
      alert(`Failed to load simulation: ${err.message}`)
    } finally {
      setLoadingResults(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Unknown') return 'Unknown'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: '2-digit',
        timeZone: 'America/Los_Angeles'
      }) + ' ' + date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
        timeZoneName: 'short'
      })
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

  const getStrategyPerformanceData = (analysis: CachedAnalysis) => {
    if (!analysis.winningStrategy || !analysis.worstStrategy) return null

    // Calculate ANNUALIZED returns from final values vs initial investment
    const initialInvestment = analysis.initialInvestment
    const years = analysis.endYear - analysis.startYear
    
    // Annualized return formula: (finalValue/initialValue)^(1/years) - 1
    const winnerAnnualizedReturn = years > 0 
      ? (Math.pow(analysis.winningStrategy.finalValue / initialInvestment, 1 / years) - 1) * 100
      : ((analysis.winningStrategy.finalValue - initialInvestment) / initialInvestment) * 100
      
    const loserAnnualizedReturn = years > 0
      ? (Math.pow(analysis.worstStrategy.finalValue / initialInvestment, 1 / years) - 1) * 100
      : ((analysis.worstStrategy.finalValue - initialInvestment) / initialInvestment) * 100
    
    // Get SPY return from strategyPerformance
    let spyAnnualizedReturn = null
    if ((analysis as any).strategyPerformance?.spyBenchmark) {
      // Use pre-calculated annualized return if available (new simulations)
      if ((analysis as any).strategyPerformance.spyBenchmark.annualizedReturn !== undefined) {
        spyAnnualizedReturn = (analysis as any).strategyPerformance.spyBenchmark.annualizedReturn * 100
      } else if ((analysis as any).strategyPerformance.spyBenchmark.finalValue) {
        // Calculate from final value for existing simulations
        spyAnnualizedReturn = years > 0
          ? (Math.pow((analysis as any).strategyPerformance.spyBenchmark.finalValue / initialInvestment, 1 / years) - 1) * 100
          : (((analysis as any).strategyPerformance.spyBenchmark.finalValue - initialInvestment) / initialInvestment) * 100
      }
    }

    return {
      winner: {
        name: analysis.winningStrategy.name,
        return: winnerAnnualizedReturn
      },
      loser: {
        name: analysis.worstStrategy.name,
        return: loserAnnualizedReturn
      },
      spy: spyAnnualizedReturn !== null ? {
        name: 'SPY',
        return: spyAnnualizedReturn
      } : null
    }
  }

  const getStrategyShortName = (name: string) => {
    const nameMap: Record<string, string> = {
      'Equal Weight Buy & Hold': 'EQW-BH',
      'Market Cap Buy & Hold': 'MCW-BH', 
      'Equal Weight Rebalanced': 'EQW-R',
      'Market Cap Rebalanced': 'MCW-R',
      'SPY Benchmark': 'SPY'
    }
    return nameMap[name] || name.substring(0, 6)
  }

  useEffect(() => {
    fetchAnalyses()
  }, [])

  if (loading) {
    return (
      <>
        <Head>
          <title>History Browser - Portfolio Backtesting</title>
        </Head>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading simulation history...</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Head>
          <title>History Browser - Portfolio Backtesting</title>
        </Head>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchAnalyses}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>History Browser - Portfolio Backtesting</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Simulation History Browser</h1>
                <p className="text-gray-600">Last {analyses.length} simulations</p>
              </div>
              <button
                onClick={fetchAnalyses}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Grid of last 6 simulations */}
          {analyses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Simulations Yet</h3>
              <p className="text-gray-600">Run your first analysis to see results here</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {analyses.map((analysis) => {
                  const performanceData = getStrategyPerformanceData(analysis)
                  const isSelected = selectedAnalysis?.key === analysis.key
                  
                  return (
                    <div
                      key={analysis.key}
                      onClick={() => handleLoadAnalysis(analysis)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Line 1: Name */}
                      <div className="mb-2">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {analysis.customName || `${formatTickers(analysis.tickers)} (${analysis.startYear}-${analysis.endYear})`}
                        </h4>
                      </div>

                      {/* Line 2: Date and Period */}
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Date:</span> {formatDate(analysis.cachedAt)} | <span className="font-medium">Period:</span> {analysis.startYear}-{analysis.endYear} ({analysis.endYear - analysis.startYear} years)
                      </div>

                      {/* Line 3: Performance with color coding */}
                      {performanceData && (
                        <div className="text-xs flex items-center justify-between">
                          <span className="text-green-600 font-medium">
                            {getStrategyShortName(performanceData.winner.name)}: {performanceData.winner.return.toFixed(2)}%
                          </span>
                          <span className="text-red-600 font-medium">
                            {getStrategyShortName(performanceData.loser.name)}: {performanceData.loser.return.toFixed(2)}%
                          </span>
                          {performanceData.spy && (
                            <span className="text-blue-600 font-medium">
                              SPY: {performanceData.spy.return.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      )}
                      
                      {isSelected && (
                        <div className="mt-2 text-xs text-blue-600 font-medium">
                          ✓ Selected
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Results Panel */}
          {selectedAnalysis && (
            <div className="bg-white rounded-xl shadow-sm">
              {loadingResults ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600">Loading simulation results...</p>
                </div>
              ) : selectedAnalysis.cachedData ? (
                <div className="p-6">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedAnalysis.customName || `${formatTickers(selectedAnalysis.tickers)} Analysis`}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedAnalysis.startYear}-{selectedAnalysis.endYear} • {selectedAnalysis.tickerCount} securities
                    </p>
                  </div>
                  <ResultsDisplay 
                    results={selectedAnalysis.cachedData}
                    simulationName={selectedAnalysis.customName || `${formatTickers(selectedAnalysis.tickers)} Analysis`}
                  />
                </div>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-600">No results data available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}