import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import Header from '../components/ui/Header'
import ResultsDisplay from '../components/backtesting/ResultsDisplay'
import CacheManagement from '../components/CacheManagement'
import SimulationHistory from '../components/SimulationHistory'
import BatchJobManager from '../components/BatchJobManager'

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
  const [showCacheManagement, setShowCacheManagement] = useState(false)
  const [showBatchJobManager, setShowBatchJobManager] = useState(false)
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settingsDropdownRef = useRef<HTMLDivElement>(null)
  
  
  // Simulation name state
  const [simulationName, setSimulationName] = useState('')
  const [isEditingSimulationName, setIsEditingSimulationName] = useState(false)
  const [isSimulationNameManuallySet, setIsSimulationNameManuallySet] = useState(false)
  
  // Share state
  const [isSharing, setIsSharing] = useState(false)

  const handleShareResults = async () => {
    if (!results) return

    setIsSharing(true)
    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          simulationName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create shareable link')
      }

      const data = await response.json()
      
      if (data.success) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.shareUrl)
        alert(`Shareable link copied to clipboard!\n\nLink: ${data.shareUrl}\n\nExpires in: ${data.expiresIn}`)
      } else {
        throw new Error(data.message || 'Failed to create shareable link')
      }
    } catch (error: any) {
      console.error('Error creating shareable link:', error)
      alert(`Failed to create shareable link: ${error.message}`)
    } finally {
      setIsSharing(false)
    }
  }

  // Generate default simulation name based on configuration
  const generateDefaultSimulationName = () => {
    const tickerCount = detectedTickers.length
    const description = tickerCount <= 5 ? detectedTickers.join(', ') : `${tickerCount} tickers`
    return `${description} ${configuration.startYear}-${configuration.endYear}`
  }

  // Update simulation name when configuration changes (only if not manually set)
  useEffect(() => {
    if (!isSimulationNameManuallySet && (!simulationName || simulationName === generateDefaultSimulationName())) {
      setSimulationName(generateDefaultSimulationName())
    }
  }, [detectedTickers, configuration.startYear, configuration.endYear, isSimulationNameManuallySet])

  // Handle click outside settings dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false)
      }
    }

    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettingsDropdown])

  const handleLoadCachedAnalysis = async (cachedAnalysis: any) => {
    console.log('Loading cached analysis:', cachedAnalysis)
    
    // Populate the form with cached analysis parameters
    const tickerString = cachedAnalysis.tickers.join(', ')
    setTickers(tickerString)
    setDetectedTickers(cachedAnalysis.tickers)
    setConfiguration({
      startYear: cachedAnalysis.startYear,
      endYear: cachedAnalysis.endYear,
      initialInvestment: cachedAnalysis.initialInvestment,
      useCache: true
    })
    
    // Set simulation name from cached analysis
    if (cachedAnalysis.customName) {
      setSimulationName(cachedAnalysis.customName)
      setIsSimulationNameManuallySet(true)
    } else {
      // Reset to auto-generation if no custom name
      setIsSimulationNameManuallySet(false)
    }

    // If we have the cached data, load it directly into results
    if (cachedAnalysis.cachedData) {
      // Auto-expand results panel to full screen for better viewing experience
      setLeftPanelCollapsed(true)
      
      setResults(cachedAnalysis.cachedData)
      setShowResults(true)
      
      // Show success message
      const name = cachedAnalysis.customName || `Analysis from ${cachedAnalysis.startYear}-${cachedAnalysis.endYear}`
      setCurrentProgress({
        phase: 'Loaded from Cache',
        detail: `Successfully loaded "${name}" with ${cachedAnalysis.tickers.length} tickers`,
        progress: 100
      })
      
      // Clear progress after delay
      setTimeout(() => setCurrentProgress({ phase: '', detail: '', progress: 0 }), 3000)
    }
  }

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

      // Store the filename without extension
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "")
      setUploadedFileName(fileNameWithoutExt)
      // Set simulation name to uploaded filename
      setSimulationName(fileNameWithoutExt)
      setIsSimulationNameManuallySet(true)
      
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

    // Check for very large portfolios and warn user
    if (detectedTickers.length > 75) {
      const proceed = confirm(
        `⚠️ Large Portfolio Warning\n\n` +
        `You're analyzing ${detectedTickers.length} tickers, which may take a very long time or timeout.\n\n` +
        `Recommendations:\n` +
        `• For best results, keep portfolios under 50 tickers\n` +
        `• Consider splitting into smaller batches\n` +
        `• Analysis may timeout after 10 minutes on Vercel\n\n` +
        `Do you want to proceed anyway?`
      )
      if (!proceed) return
    }

    // Auto-expand results panel to full screen for better viewing experience
    setLeftPanelCollapsed(true)

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

      // All portfolios now use the main backtest endpoint
      // The comprehensive pre-fetching fixes allow handling of large portfolios
      const apiEndpoint = '/api/backtest'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: detectedTickers,
          startYear: configuration.startYear,
          endYear: configuration.endYear,
          initialInvestment: configuration.initialInvestment,
          bypass_cache: !configuration.useCache,
          customName: simulationName || uploadedFileName
        })
      })

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.message || 'Analysis failed')
      }

      const data = await response.json()
      
      // Handle batch processing response (202 status)
      if (response.status === 202 && data.status === 'batch_required') {
        setCurrentProgress({
          phase: 'Batch Processing Required',
          detail: `Portfolio too large (${data.totalTickers} tickers). Requires ${data.batchCount} batches, estimated ${data.estimatedTime}. Please reduce to under 75 tickers for optimal performance.`,
          progress: 0
        })
        
        setTimeout(() => {
          alert(
            `🚧 Large Portfolio Notice\n\n` +
            `Your ${data.totalTickers}-ticker portfolio requires batch processing:\n\n` +
            `• Would need ${data.batchCount} separate batches\n` +
            `• Estimated time: ${data.estimatedTime}\n` +
            `• Recommendation: Reduce to under 75 tickers\n\n` +
            `Please consider splitting your portfolio into smaller analyses for better performance.`
          )
        }, 1000)
        
        return
      }
      
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
      // Ensure results panel is expanded when showing results
      setLeftPanelCollapsed(true)
      setShowResults(true)
    } catch (error: any) {
      console.error('Analysis error:', error)
      const errorMessage = error.message || 'Analysis failed. Please try again.'
      setCurrentProgress({
        phase: 'Error',
        detail: errorMessage,
        progress: 0
      })
      setTimeout(() => alert(errorMessage), 100)
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
                <div className="w-12 h-12 flex items-center justify-center">
                  <img 
                    src="/yoda-logo.svg" 
                    alt="Yoda Financial Advisor Logo" 
                    className="w-12 h-12"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Strategize Pro</h1>
                  <p className="text-sm text-gray-600">Advanced Portfolio Strategy Analysis</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {/* Settings Dropdown */}
                <div className="relative" ref={settingsDropdownRef}>
                  <button 
                    onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Settings"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showSettingsDropdown && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <button
                        onClick={() => {
                          setShowCacheManagement(true)
                          setShowSettingsDropdown(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        <div>
                          <div className="font-medium text-gray-900">Cache Management</div>
                          <div className="text-sm text-gray-500">Manage cached data and storage</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowBatchJobManager(true)
                          setShowSettingsDropdown(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                        <div>
                          <div className="font-medium text-gray-900">Batch Job Manager</div>
                          <div className="text-sm text-gray-500">Monitor background processes</div>
                        </div>
                      </button>
                      
                      <hr className="my-2 border-gray-200" />
                      
                      <div className="px-4 py-2">
                        <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">System</div>
                        <div className="text-sm text-gray-600">Version 1.0.0</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className={`grid gap-8 transition-all duration-300 ${leftPanelCollapsed ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Left Column - Setup */}
            <div className={`space-y-6 transition-all duration-300 ${leftPanelCollapsed ? 'hidden' : 'block'}`}>
              {/* Setup & Configuration Card - Fidelity Style */}
              <div className="bg-white border border-gray-200 shadow-sm">
                {/* Fidelity-style Header */}
                <div className="bg-gradient-to-r from-green-700 to-green-800 text-white px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-green-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h2 className="text-xl font-semibold tracking-wide">Portfolio Setup</h2>
                  </div>
                </div>
                
                <div className="p-6">

                {/* Stock Tickers Input - Fidelity Style */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Securities Selection</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stock Symbols</label>
                      <input
                        type="text"
                        value={tickers}
                        onChange={handleTickerChange}
                        placeholder="Enter stock symbols separated by commas (e.g., AAPL, MSFT, GOOGL)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-mono"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                      <span className="text-sm text-gray-600 font-medium">Import from File</span>
                      <button
                        onClick={handleUploadClick}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md transition-colors text-sm font-medium shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>Upload File</span>
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
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-green-800">
                          {detectedTickers.length} securities ready for analysis
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Analysis Configuration Card - Fidelity Style */}
              <div className="bg-white border border-gray-200 shadow-sm">
                {/* Fidelity-style Header */}
                <div className="bg-gradient-to-r from-green-700 to-green-800 text-white px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-green-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h2 className="text-xl font-semibold tracking-wide">Analysis Parameters</h2>
                  </div>
                </div>
                
                <div className="p-6">

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Investment Period & Amount</h3>
                  
                  {/* Configuration Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
                      <input
                        type="number"
                        value={configuration.startYear}
                        onChange={(e) => setConfiguration({...configuration, startYear: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Year</label>
                      <input
                        type="number"
                        value={configuration.endYear}
                        onChange={(e) => setConfiguration({...configuration, endYear: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Initial Investment</label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={configuration.initialInvestment}
                          onChange={(e) => setConfiguration({...configuration, initialInvestment: parseInt(e.target.value)})}
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                </div>
                </div>
              </div>

              {/* Run Analysis Button */}
              <div className="text-center">
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isRunning || detectedTickers.length === 0}
                      className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 text-white font-semibold py-4 px-8 
                               rounded-md transition-all flex items-center justify-center space-x-3 text-lg shadow-sm"
                    >
                      {isRunning ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          <span>Analyzing Portfolio...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Run Analysis</span>
                        </>
                      )}
                    </button>
              </div>

              {/* Simulation History */}
              <SimulationHistory onLoadAnalysis={handleLoadCachedAnalysis} />


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
              
              <div className={`bg-white rounded-2xl shadow-sm ${leftPanelCollapsed ? 'p-8' : 'p-6'} min-h-[600px] flex items-center justify-center`}>
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
                  <div className={`w-full ${leftPanelCollapsed ? 'space-y-6' : 'space-y-4'}`}>
                    {/* Export Controls */}
                    <div className={`flex items-center justify-between pb-4 border-b border-gray-200 ${leftPanelCollapsed ? 'mb-6' : ''}`}>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          Analysis Results
                        </h3>
                        {isEditingSimulationName ? (
                          <input
                            type="text"
                            value={simulationName}
                            onChange={(e) => {
                              setSimulationName(e.target.value)
                              setIsSimulationNameManuallySet(true)
                            }}
                            onBlur={() => setIsEditingSimulationName(false)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setIsEditingSimulationName(false)
                                setIsSimulationNameManuallySet(true)
                              }
                              if (e.key === 'Escape') {
                                setSimulationName(generateDefaultSimulationName())
                                setIsSimulationNameManuallySet(false)
                                setIsEditingSimulationName(false)
                              }
                            }}
                            className="text-lg font-medium text-gray-600 bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => setIsEditingSimulationName(true)}
                            className="text-lg font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                            title="Click to edit simulation name"
                          >
                            ({simulationName})
                          </button>
                        )}
                        {leftPanelCollapsed && <span className="text-sm font-normal text-gray-500">(Full Screen)</span>}
                      </div>
                      {/* Fidelity-style Action Bar */}
                      <div className={`flex items-center space-x-2 ${leftPanelCollapsed ? 'flex-wrap gap-2' : ''}`}>
                        <button
                          onClick={handleExportResults}
                          className="flex items-center space-x-2 px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-md transition-colors text-sm font-medium shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Export JSON</span>
                        </button>
                        <button
                          onClick={handleShareResults}
                          disabled={isSharing}
                          className="flex items-center space-x-2 px-3 py-2 bg-white border border-green-700 text-green-700 hover:bg-green-50 rounded-md transition-colors text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                          <span>{isSharing ? 'Creating Link...' : 'Share'}</span>
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
                          className="flex items-center space-x-2 px-3 py-2 bg-white border border-green-700 text-green-700 hover:bg-green-50 rounded-md transition-colors text-sm font-medium shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Excel</span>
                        </button>
                      </div>
                    </div>
                    
                    <ResultsDisplay results={results} simulationName={simulationName} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Cache Management Modal */}
      <CacheManagement 
        isOpen={showCacheManagement} 
        onClose={() => setShowCacheManagement(false)}
      />

      {/* Batch Job Manager Modal */}
      <BatchJobManager 
        isOpen={showBatchJobManager} 
        onClose={() => setShowBatchJobManager(false)}
      />
    </>
  )
}