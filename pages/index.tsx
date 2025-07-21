import { useState, useRef } from 'react'
import Head from 'next/head'
import Header from '../components/ui/Header'
import ResultsDisplay from '../components/backtesting/ResultsDisplay'

export default function Home() {
  const [tickers, setTickers] = useState<string>('AAPL, MSFT, GOOGL, AMZN, TSLA')
  const [detectedTickers, setDetectedTickers] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'])
  const [configuration, setConfiguration] = useState({
    startYear: 2010,
    endYear: 2024,
    initialInvestment: 1000000,
    useCache: true
  })
  const [isRunning, setIsRunning] = useState(false)
  const [currentProgress, setCurrentProgress] = useState<{phase: string, detail: string, progress?: number}>({
    phase: '',
    detail: '',
    progress: 0
  })
  const [results, setResults] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTickers(value)
    
    // Parse and validate tickers
    const tickerArray = value.split(',').map(t => t.trim().toUpperCase()).filter(t => t)
    setDetectedTickers(tickerArray)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      let uploadedTickers: string[] = []

      // Handle different file formats
      if (file.name.endsWith('.csv')) {
        // Parse CSV - handle both comma and newline separated
        uploadedTickers = text.split(/[,\n\r]/)
          .map(ticker => ticker.trim().replace(/['"]/g, '').toUpperCase())
          .filter(ticker => ticker && /^[A-Z]{1,5}(\.US)?$/.test(ticker))
      } else if (file.name.endsWith('.txt')) {
        // Parse TXT - handle both comma and newline separated
        uploadedTickers = text.split(/[,\n\r\t]/)
          .map(ticker => ticker.trim().toUpperCase())
          .filter(ticker => ticker && /^[A-Z]{1,5}(\.US)?$/.test(ticker))
      }

      if (uploadedTickers.length > 0) {
        const tickerString = uploadedTickers.join(', ')
        setTickers(tickerString)
        setDetectedTickers(uploadedTickers)
        alert(`Successfully loaded ${uploadedTickers.length} tickers from file`)
      } else {
        alert('No valid tickers found in file. Please ensure the file contains valid stock symbols.')
      }
    }
    reader.readAsText(file)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleExportResults = () => {
    if (!results) {
      alert('No results to export. Please run an analysis first.')
      return
    }

    // Create a comprehensive JSON export
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        analysis: 'Portfolio Strategy Backtesting Results'
      },
      parameters: {
        tickers: detectedTickers,
        startYear: configuration.startYear,
        endYear: configuration.endYear,
        initialInvestment: configuration.initialInvestment,
        analysisDate: new Date().toISOString()
      },
      results: results
    }

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `portfolio-analysis-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRunAnalysis = async () => {
    if (detectedTickers.length === 0) {
      alert('Please enter at least one stock ticker')
      return
    }

    // Scroll to top to show progress
    window.scrollTo({ top: 0, behavior: 'smooth' })

    setIsRunning(true)
    setResults(null)
    setShowResults(false)
    setCurrentProgress({
      phase: 'Starting Analysis',
      detail: `Initializing analysis for ${detectedTickers.length} tickers (${configuration.startYear}-${configuration.endYear})...`,
      progress: 5
    })

    try {
      // More descriptive progress updates based on portfolio size
      const isLargePortfolio = detectedTickers.length > 25
      const isMediumPortfolio = detectedTickers.length > 10
      
      const progressUpdates = [
        { 
          phase: 'Validating Tickers', 
          detail: `Verifying ${detectedTickers.length} ticker symbols against EODHD exchange data...`, 
          progress: 15 
        },
        { 
          phase: 'Fetching Market Data', 
          detail: isLargePortfolio 
            ? `Retrieving ${(configuration.endYear - configuration.startYear) * detectedTickers.length}+ data points (this may take a few minutes for large portfolios)...`
            : `Loading historical prices and market cap data for ${detectedTickers.length} tickers...`, 
          progress: 35 
        },
        { 
          phase: 'Calculating Strategies', 
          detail: isLargePortfolio 
            ? `Processing 5 investment strategies across ${detectedTickers.length} tickers (Equal Weight, Market Cap, Rebalanced versions, SPY Benchmark)...`
            : `Running strategy calculations: Equal Weight, Market Cap, Rebalanced, SPY Benchmark...`, 
          progress: 70 
        },
        { 
          phase: 'Finalizing Results', 
          detail: `Preparing comprehensive analysis package with performance metrics, cache statistics, and timing data...`, 
          progress: 90 
        }
      ];

      let updateIndex = 0;
      // Adjust timing based on portfolio size
      const updateInterval = isLargePortfolio ? 8000 : isMediumPortfolio ? 5000 : 3000
      const progressInterval = setInterval(() => {
        if (updateIndex < progressUpdates.length) {
          setCurrentProgress(progressUpdates[updateIndex]);
          updateIndex++;
        }
      }, updateInterval);

      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: detectedTickers,
          startYear: configuration.startYear,
          endYear: configuration.endYear,
          initialInvestment: configuration.initialInvestment,
          bypass_cache: !configuration.useCache
        })
      })

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      
      // Show completion summary with cache and timing stats
      const cacheStats = data.cacheStats || { hits: 0, misses: 0, total: 0 }
      const timings = data.timings || {}
      const hitRate = cacheStats.total > 0 ? Math.round((cacheStats.hits / cacheStats.total) * 100) : 0
      
      setCurrentProgress({
        phase: 'Analysis Complete',
        detail: `✅ Processed ${data.parameters?.tickerCount || detectedTickers.length} tickers in ${timings.total ? (timings.total/1000).toFixed(1) : '?'}s | Cache: ${hitRate}% hit rate (${cacheStats.hits}/${cacheStats.total}) | Ready!`,
        progress: 100
      })

      setResults(data)
      setShowResults(true)
    } catch (error) {
      console.error('Analysis error:', error)
      setCurrentProgress({
        phase: 'Error',
        detail: 'Analysis failed. Please try again.',
        progress: 0
      })
      setTimeout(() => alert('Analysis failed. Please try again.'), 100)
    } finally {
      setIsRunning(false)
      // Clear progress after a short delay
      setTimeout(() => setCurrentProgress({ phase: '', detail: '', progress: 0 }), 2000)
    }
  }

  return (
    <>
      <Head>
        <title>Strategize Pro - Advanced Portfolio Strategy Analysis</title>
        <meta name="description" content="Professional stock backtesting and strategy analysis tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Strategize Pro</h1>
                  <p className="text-sm text-gray-600">Advanced Portfolio Strategy Analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button className="text-gray-600 hover:text-gray-900">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
                <button className="text-gray-600 hover:text-gray-900">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className={`grid gap-8 transition-all duration-300 ${leftPanelCollapsed ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Left Column - Setup */}
            <div className={`space-y-6 transition-all duration-300 ${leftPanelCollapsed ? 'hidden' : 'block'}`}>
              {/* Setup & Configuration Card */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Setup & Configuration</h2>
                </div>

                {/* Stock Tickers Input */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">Stock Tickers Input</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={tickers}
                      onChange={handleTickerChange}
                      placeholder="Enter tickers separated by commas..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">or upload from file</span>
                      <button
                        onClick={handleUploadClick}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>Upload CSV/TXT</span>
                      </button>
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  
                  {detectedTickers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Detected Tickers ({detectedTickers.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {detectedTickers.map((ticker, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {ticker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Configuration Card */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Analysis Configuration</h2>
                </div>

                <div className="space-y-6">
                  {/* Year Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Start Year</span>
                      </label>
                      <input
                        type="number"
                        value={configuration.startYear}
                        onChange={(e) => setConfiguration({...configuration, startYear: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                        <span>End Year</span>
                      </label>
                      <input
                        type="number"
                        value={configuration.endYear}
                        onChange={(e) => setConfiguration({...configuration, endYear: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Initial Investment */}
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                      <span className="text-lg">💰</span>
                      <span>Initial Investment</span>
                    </label>
                    <input
                      type="number"
                      value={configuration.initialInvestment}
                      onChange={(e) => setConfiguration({...configuration, initialInvestment: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Cache Control */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Cache Control</h4>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={configuration.useCache}
                          onChange={(e) => setConfiguration({...configuration, useCache: e.target.checked})}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Use Cache (faster analysis)</span>
                      </label>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="text-sm">View Cache</span>
                        </button>
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="text-sm">Download Cache</span>
                        </button>
                        <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-sm">Clear Cache</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready to Analyze Card */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-sm p-8 text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Ready to Analyze?</h3>
                <button
                  onClick={handleRunAnalysis}
                  disabled={isRunning || detectedTickers.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 
                           disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-8 
                           rounded-xl transition-all transform hover:scale-105 active:scale-95
                           flex items-center justify-center space-x-3 text-lg shadow-lg"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>Running Analysis...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Run Strategy Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6 relative">
              {/* Collapse Toggle Button */}
              <button
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                className="absolute top-2 left-2 z-10 flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm"
              >
                <svg className={`w-4 h-4 transition-transform ${leftPanelCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>{leftPanelCollapsed ? 'Show Setup' : 'Hide Setup'}</span>
              </button>
              
              <div className="bg-white rounded-2xl shadow-sm p-6 min-h-[600px] flex items-center justify-center">
                {!showResults ? (
                  <div className="text-center space-y-4">
                    {isRunning && currentProgress.phase ? (
                      // Progress Display
                      <div className="w-full max-w-md mx-auto space-y-6">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                        
                        <div className="space-y-3">
                          <h3 className="text-xl font-semibold text-gray-900">{currentProgress.phase}</h3>
                          <p className="text-gray-600">{currentProgress.detail}</p>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${currentProgress.progress || 0}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>Progress</span>
                            <span>{currentProgress.progress || 0}%</span>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400 mt-4">
                          {detectedTickers.length > 25 ? (
                            <p>⚡ Large portfolio detected - this may take longer than usual</p>
                          ) : (
                            <p>🚀 Analyzing your portfolio...</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Default Empty State
                      <div className="space-y-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">Results</h3>
                          <p className="text-gray-600">Run analysis to see strategy performance</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    {/* Export Controls */}
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <h3 className="text-xl font-semibold text-gray-900">
                        Analysis Results {leftPanelCollapsed && <span className="text-sm font-normal text-gray-500">(Full Screen)</span>}
                      </h3>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handleExportResults}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Export JSON</span>
                        </button>
                        <button
                          onClick={() => {
                            // Trigger Excel download from ResultsDisplay component
                            const excelButton = document.querySelector('[data-excel-download]') as HTMLButtonElement;
                            if (excelButton) {
                              excelButton.click();
                            } else {
                              alert('Excel export is available in the results overview section below.');
                            }
                          }}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-sm font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Export Excel</span>
                        </button>
                      </div>
                    </div>
                    
                    <ResultsDisplay results={results} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}