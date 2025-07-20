import { useState, useRef } from 'react'
import Head from 'next/head'
import TickerInput from '../components/backtesting/TickerInput'
import StrategySelection from '../components/backtesting/StrategySelection'
import ConfigurationPanel from '../components/backtesting/ConfigurationPanel'
import ResultsDisplay from '../components/backtesting/ResultsDisplay'
import Header from '../components/ui/Header'

export default function Home() {
  const [tickers, setTickers] = useState<string[]>([])
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['marketCapWeighted', 'equalWeighted'])
  const [configuration, setConfiguration] = useState({
    startYear: 2010,
    endYear: 2024,
    initialInvestment: 1000000,
    useCache: true,
    includeDividends: true
  })
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [progress, setProgress] = useState(0)

  const handleRunAnalysis = async () => {
    if (tickers.length === 0) {
      alert('Please enter at least one stock ticker')
      return
    }

    setIsRunning(true)
    setProgress(0)
    setResults(null)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers,
          strategies: selectedStrategies,
          ...configuration
        })
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Analysis failed. Please try again.')
    } finally {
      setIsRunning(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  return (
    <>
      <Head>
        <title>Stock Strategy Analysis Tool</title>
        <meta name="description" content="Professional stock backtesting and strategy analysis tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="space-y-8">
            {/* Ticker Input Section */}
            <TickerInput 
              tickers={tickers}
              onTickersChange={setTickers}
            />

            {/* Strategy Selection */}
            <StrategySelection
              selectedStrategies={selectedStrategies}
              onSelectionChange={setSelectedStrategies}
            />

            {/* Configuration Panel */}
            <ConfigurationPanel
              configuration={configuration}
              onConfigurationChange={setConfiguration}
            />

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={handleRunAnalysis}
                  disabled={isRunning || tickers.length === 0}
                  className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 
                           text-white font-semibold py-3 px-8 rounded-lg transition-colors
                           flex items-center space-x-2 min-w-[200px] justify-center"
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Running Analysis...</span>
                    </>
                  ) : (
                    <>
                      <span>▶️</span>
                      <span>Run Analysis</span>
                    </>
                  )}
                </button>

                <button
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold 
                           py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <span>📥</span>
                  <span>Load Cache File</span>
                </button>
              </div>

              {/* Progress Bar */}
              {isRunning && (
                <div className="mt-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Analyzing strategies... {progress}%
                  </p>
                </div>
              )}
            </div>

            {/* Results Display */}
            {results && (
              <ResultsDisplay results={results} />
            )}

            {/* Cache Information */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-2xl">💾</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-yellow-800">
                    Historical Data Cache
                  </h3>
                  <p className="text-yellow-700 mt-1">
                    The tool automatically creates a cache file containing historical price, 
                    market cap, and shares outstanding data for all processed stocks. This cache:
                  </p>
                  <ul className="list-disc list-inside text-yellow-700 mt-2 space-y-1">
                    <li>Speeds up subsequent analyses</li>
                    <li>Reduces API calls to data providers</li>
                    <li>Can be exported and shared between analyses</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}