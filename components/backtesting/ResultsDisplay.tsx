import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface ResultsDisplayProps {
  results: any
  simulationName?: string
}

export default function ResultsDisplay({ results, simulationName }: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [sortBy, setSortBy] = useState<'ticker' | 'gains'>('gains')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  if (!results) return null

  // Check if ticker is an ETF
  const isETF = (ticker: string): boolean => {
    const etfTickers = new Set([
      'SPY', 'SPY.US',
      'QQQ', 'QQQ.US', 
      'IWM', 'IWM.US',
      'VTI', 'VTI.US',
      'VOO', 'VOO.US',
      'VEA', 'VEA.US',
      'VWO', 'VWO.US',
      'BND', 'BND.US',
      'VNQ', 'VNQ.US'
    ])
    return etfTickers.has(ticker.toUpperCase())
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Generate chart data for performance comparison
  const generateChartData = () => {
    try {
      const chartData: any[] = []
      const startYear = results.parameters?.startYear || 2010
      const endYear = results.parameters?.endYear || 2024
      const initialInvestment = results.parameters?.initialInvestment || 1000000

      for (let year = startYear; year <= endYear; year++) {
        const dataPoint: any = { year: year.toString() }
        
        strategies.forEach(strategy => {
          const data = results[strategy.key]
          if (data?.yearlyHoldings?.[year]) {
            // Calculate portfolio value for this year
            let totalValue = 0
            Object.values(data.yearlyHoldings[year]).forEach((holding: any) => {
              totalValue += holding.value || 0
            })
            dataPoint[strategy.key] = totalValue
          } else if (year === startYear && data) {
            dataPoint[strategy.key] = initialInvestment
          }
        })
        
        chartData.push(dataPoint)
      }
      
      return chartData
    } catch (error) {
      console.error('Error generating chart data:', error)
      return []
    }
  }

  // Get top performing strategy
  const getTopPerformer = () => {
    let topStrategy = strategies[0]
    let topReturn = results[topStrategy.key]?.totalReturn || -Infinity
    
    strategies.forEach(strategy => {
      const strategyReturn = results[strategy.key]?.totalReturn || -Infinity
      if (strategyReturn > topReturn) {
        topReturn = strategyReturn
        topStrategy = strategy
      }
    })
    
    return topStrategy.key
  }

  // Generate last year data for strategy tables
  const generateLastYearData = (strategyKey: string) => {
    const data = results[strategyKey]
    if (!data?.yearlyHoldings) return []
    
    const endYear = results.parameters?.endYear || 2024
    const startYear = endYear - 1
    
    const endYearHoldings = data.yearlyHoldings[endYear] || {}
    const startYearHoldings = data.yearlyHoldings[startYear] || {}
    
    const tickerData: any[] = []
    const allTickers = new Set([
      ...Object.keys(endYearHoldings),
      ...Object.keys(startYearHoldings)
    ])
    
    allTickers.forEach(ticker => {
      const startValue = startYearHoldings[ticker]?.value || 0
      const endValue = endYearHoldings[ticker]?.value || 0
      const gain = endValue - startValue
      const gainPercent = startValue > 0 ? (gain / startValue) * 100 : 0
      
      if (endValue > 0 || startValue > 0) { // Only include tickers with positions
        tickerData.push({
          ticker,
          startValue,
          endValue,
          gain,
          gainPercent
        })
      }
    })
    
    return tickerData
  }

  const handleExcelDownload = async () => {
    try {
      // Determine if cache was bypassed based on results metadata
      const bypassCache = results.from_cache === false || results.message?.includes('real');
      
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          results
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Portfolio Simulation Results-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download results. Please try again.');
    }
  }

  const handlePDFExport = async () => {
    try {
      // Get the overview section element
      const overviewElement = document.getElementById('overview-content');
      if (!overviewElement) {
        alert('Overview content not found. Please make sure you are on the Overview tab.');
        return;
      }

      // Temporarily expand the element to its full height to capture all content
      const originalHeight = overviewElement.style.height;
      const originalMaxHeight = overviewElement.style.maxHeight;
      const originalOverflow = overviewElement.style.overflow;
      
      // Set styles to capture full content
      overviewElement.style.height = 'auto';
      overviewElement.style.maxHeight = 'none';
      overviewElement.style.overflow = 'visible';
      
      // Wait for layout to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create canvas from the overview section with improved settings
      const canvas = await html2canvas(overviewElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        height: overviewElement.scrollHeight, // Capture full scroll height
        width: overviewElement.scrollWidth,   // Capture full scroll width
        scrollX: 0,
        scrollY: 0,
        windowWidth: overviewElement.scrollWidth,
        windowHeight: overviewElement.scrollHeight
      });

      // Restore original styles
      overviewElement.style.height = originalHeight;
      overviewElement.style.maxHeight = originalMaxHeight;
      overviewElement.style.overflow = originalOverflow;

      // Create PDF with better handling
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // A4 dimensions in mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      
      // Calculate image dimensions to fit page width
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let yPosition = margin;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      // Add title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(simulationName || 'Portfolio Analysis', margin, yPosition);
      yPosition += 15;
      remainingHeight += 15;

      // Add the image, splitting across pages if necessary
      while (remainingHeight > 0) {
        const pageContentHeight = contentHeight - (yPosition - margin);
        const sliceHeight = Math.min(remainingHeight, pageContentHeight * (canvas.height / imgHeight));
        
        // Calculate the portion of the image to show on this page
        const imgSliceHeight = (sliceHeight / canvas.height) * imgHeight;
        
        if (sliceHeight > 0) {
          // Create a temporary canvas for this slice
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = canvas.width;
          tempCanvas.height = sliceHeight;
          
          // Draw the slice
          tempCtx?.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          
          // Add to PDF
          const tempImgData = tempCanvas.toDataURL('image/png');
          pdf.addImage(tempImgData, 'PNG', margin, yPosition, imgWidth, imgSliceHeight);
        }
        
        remainingHeight -= sliceHeight;
        sourceY += sliceHeight;
        
        // Add new page if there's more content
        if (remainingHeight > 0) {
          pdf.addPage();
          yPosition = margin;
        }
      }

      // Download the PDF
      const fileName = `${simulationName || 'Portfolio_Analysis'}_Overview.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    }
  }

  const strategies = [
    { key: 'equalWeightBuyHold', name: 'Equal Weight Buy & Hold', icon: '⚖️' },
    { key: 'marketCapBuyHold', name: 'Market Cap Buy & Hold', icon: '📈' },
    { key: 'equalWeightRebalanced', name: 'Equal Weight Rebalanced', icon: '🔄' },
    { key: 'marketCapRebalanced', name: 'Market Cap Rebalanced', icon: '📊' },
    { key: 'spyBenchmark', name: 'SPY Benchmark', icon: '🏛️' },
  ]

  // Map strategy keys to their chart line colors
  const getStrategyColor = (strategyKey: string) => {
    const colorMap: { [key: string]: string } = {
      'equalWeightBuyHold': 'text-green-600',     // #16a34a
      'marketCapBuyHold': 'text-blue-600',        // #2563eb
      'equalWeightRebalanced': 'text-purple-500', // #8b5cf6
      'marketCapRebalanced': 'text-orange-500',   // #f59e0b
      'spyBenchmark': 'text-red-600',            // #dc2626
    }
    return colorMap[strategyKey] || 'text-gray-900'
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'holdings', name: 'Holdings', icon: '📋' },
    { id: 'details', name: 'Analysis Details', icon: '⚙️' },
    { id: 'equalWeightBuyHold', name: 'Equal Weight B&H', icon: '⚖️' },
    { id: 'marketCapBuyHold', name: 'Market Cap B&H', icon: '📈' },
    { id: 'equalWeightRebalanced', name: 'Equal Weight Rebal.', icon: '🔄' },
    { id: 'marketCapRebalanced', name: 'Market Cap Rebal.', icon: '📊' },
    { id: 'spyBenchmark', name: 'SPY Benchmark', icon: '🏛️' },
  ]

  const renderAnalysisDetailsView = () => {
    const cacheStats = results.cacheStats || { hits: 0, misses: 0, total: 0 }
    const timings = results.timings || {}
    const parameters = results.parameters || {}
    
    const hitRate = cacheStats.total > 0 ? ((cacheStats.hits / cacheStats.total) * 100).toFixed(1) : '0.0'
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <span className="text-3xl">⚙️</span>
          <h3 className="text-2xl font-semibold text-primary-900">Analysis Details</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Cache Statistics */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>💾</span>
              <span>Cache Performance</span>
            </h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-gray-700">Cache Hit Rate</span>
                <span className="font-semibold text-green-700">{hitRate}%</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{cacheStats.hits}</div>
                  <div className="text-sm text-gray-600">Cache Hits</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">{cacheStats.misses}</div>
                  <div className="text-sm text-gray-600">Cache Misses</div>
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{cacheStats.total}</div>
                <div className="text-sm text-gray-600">Total Operations</div>
              </div>
              
              <div className="text-xs text-gray-500 mt-4">
                Higher cache hit rates indicate better performance and reduced API calls to EODHD.
              </div>
            </div>
          </div>

          {/* Timing Breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>⏱️</span>
              <span>Performance Timing</span>
            </h4>
            
            <div className="space-y-3">
              {timings.validation && (
                <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                  <span className="text-gray-700">Ticker Validation</span>
                  <span className="font-semibold text-purple-700">{(timings.validation / 1000).toFixed(1)}s</span>
                </div>
              )}
              
              {timings.strategies && (
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                  <span className="text-gray-700">Strategy Calculations</span>
                  <span className="font-semibold text-blue-700">{(timings.strategies / 1000).toFixed(1)}s</span>
                </div>
              )}
              
              {timings.finalization && (
                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                  <span className="text-gray-700">Results Finalization</span>
                  <span className="font-semibold text-green-700">{(timings.finalization / 1000).toFixed(1)}s</span>
                </div>
              )}
              
              {timings.total && (
                <div className="flex justify-between items-center p-3 bg-gray-800 text-white rounded-lg font-semibold">
                  <span>Total Analysis Time</span>
                  <span>{(timings.total / 1000).toFixed(1)}s</span>
                </div>
              )}
              
              {parameters.tickerCount && timings.total && (
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-sm text-gray-600">Processing Efficiency</div>
                  <div className="font-semibold text-yellow-700">
                    {(parameters.tickerCount / (timings.total / 1000)).toFixed(1)} tickers/second
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Parameters */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>📋</span>
              <span>Analysis Parameters</span>
            </h4>
            
            <div className="space-y-3">
              {parameters.tickerCount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tickers Processed</span>
                  <span className="font-semibold">{parameters.tickerCount}</span>
                </div>
              )}
              
              {parameters.originalTickerCount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Tickers</span>
                  <span className="font-semibold">{parameters.originalTickerCount}</span>
                </div>
              )}
              
              {parameters.startYear && parameters.endYear && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Analysis Period</span>
                  <span className="font-semibold">{parameters.startYear} - {parameters.endYear}</span>
                </div>
              )}
              
              {parameters.initialInvestment && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Initial Investment</span>
                  <span className="font-semibold">{formatCurrency(parameters.initialInvestment)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Used</span>
                <span className="font-semibold">{results.from_cache ? 'Yes' : 'No'}</span>
              </div>
              
              {results.historicalData && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Sources</span>
                  <span className="font-semibold">{Object.keys(results.historicalData).length} tickers</span>
                </div>
              )}
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>🔧</span>
              <span>System Information</span>
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Data Provider</span>
                <span className="font-semibold">EODHD Financial API</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Calculation Engine</span>
                <span className="font-semibold">Vercel Serverless</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Provider</span>
                <span className="font-semibold">Upstash Redis</span>
              </div>
              
              {results.message && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-800">{results.message}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderHoldingsView = () => {
    if (!results.parameters) return <div>No portfolio data available</div>

    const startYear = results.parameters.startYear
    const endYear = results.parameters.endYear
    const tickers = results.parameters.tickers || []

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">📋</span>
          <h3 className="text-2xl font-semibold text-primary-900">Portfolio Holdings</h3>
        </div>

        {/* Portfolio Composition Summary */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-4">Portfolio Composition</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Total Stocks:</span>
              <span className="ml-2 font-medium">{tickers.length}</span>
            </div>
            <div>
              <span className="text-blue-700">Investment Period:</span>
              <span className="ml-2 font-medium">{startYear} - {endYear}</span>
            </div>
            <div>
              <span className="text-blue-700">Initial Investment:</span>
              <span className="ml-2 font-medium">{formatCurrency(results.parameters.initialInvestment || 1000000)}</span>
            </div>
          </div>
        </div>

        {/* Stock List */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Stock Tickers</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {tickers.map((ticker: string) => (
              <div key={ticker} className="bg-white px-3 py-2 rounded border text-center font-mono font-medium">
                {ticker}
              </div>
            ))}
          </div>
        </div>

        {/* Price and Market Cap History */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Historical Price & Market Cap Data</h4>
          <div className="bg-white border rounded-lg p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-3 font-semibold">Ticker</th>
                    {(() => {
                      // Get all years from any strategy's holdings
                      const allYears = new Set<number>()
                      strategies.forEach(strategy => {
                        const data = results[strategy.key]
                        if (data?.yearlyHoldings) {
                          Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                        }
                      })
                      return Array.from(allYears).sort().map(year => (
                        <th key={year} className="text-center p-3 font-semibold">{year}</th>
                      ))
                    })()}
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-600">
                    <th className="text-left p-2">Price / Market Cap</th>
                    {(() => {
                      const allYears = new Set<number>()
                      strategies.forEach(strategy => {
                        const data = results[strategy.key]
                        if (data?.yearlyHoldings) {
                          Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                        }
                      })
                      return Array.from(allYears).sort().map(year => (
                        <th key={year} className="text-center p-2">Price / MCap (B) / Shares Out.</th>
                      ))
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get all unique tickers from all strategies and years
                    const allTickers = new Set<string>()
                    strategies.forEach(strategy => {
                      const data = results[strategy.key]
                      if (data?.yearlyHoldings) {
                        Object.values(data.yearlyHoldings).forEach((yearData: any) => {
                          Object.keys(yearData).forEach(ticker => allTickers.add(ticker))
                        })
                      }
                    })
                    
                    // Get all years
                    const allYears = new Set<number>()
                    strategies.forEach(strategy => {
                      const data = results[strategy.key]
                      if (data?.yearlyHoldings) {
                        Object.keys(data.yearlyHoldings).forEach(year => allYears.add(Number(year)))
                      }
                    })
                    const sortedYears = Array.from(allYears).sort()
                    
                    return Array.from(allTickers).sort().map(ticker => (
                      <tr key={ticker} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-mono font-medium">{ticker}</td>
                        {sortedYears.map(year => {
                          // Find data for this ticker in this year from any strategy
                          let priceData = null
                          for (const strategy of strategies) {
                            const data = results[strategy.key]
                            if (data?.yearlyHoldings?.[year]?.[ticker]) {
                              priceData = data.yearlyHoldings[year][ticker]
                              break
                            }
                          }
                          
                          return (
                            <td key={year} className="p-3 text-center text-xs">
                              {priceData ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-blue-600">
                                    ${priceData.price.toFixed(2)}
                                  </div>
                                  <div className="text-gray-600">
                                    {/* Show market cap for stocks, ETF label for ETFs */}
                                    {isETF(ticker) ? (
                                      <span className="text-purple-600 font-medium">ETF</span>
                                    ) : (
                                      priceData.marketCap ? `$${(priceData.marketCap / 1000000000).toFixed(1)}B` : '—'
                                    )}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {/* Show shares outstanding for stocks, Index Fund for ETFs */}
                                    {isETF(ticker) ? (
                                      <span className="text-purple-500">Index Fund</span>
                                    ) : (
                                      priceData.sharesOutstanding ? `${(priceData.sharesOutstanding / 1000000).toFixed(0)}M` : '—'
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-400">—</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Price, market cap, and shares outstanding data from historical records. Shows: Stock Price / Market Cap (Billions) / Shares Outstanding (Millions). ETFs show "ETF" and "Index Fund" labels instead of market cap/shares data.
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderStrategyDetail = (strategyKey: string, strategyName: string, icon: string) => {
    const data = results[strategyKey]
    if (!data) return <div>No data available for this strategy</div>

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{icon}</span>
          <h3 className="text-2xl font-semibold text-primary-900">{strategyName}</h3>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Return</div>
            <div className={`text-2xl font-bold ${data.totalReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(data.totalReturn)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Annualized Return</div>
            <div className={`text-2xl font-bold ${data.annualizedReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(data.annualizedReturn)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">Final Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(data.finalValue)}
            </div>
          </div>
        </div>

        {/* Strategy Details */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 mb-4">Strategy Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Initial Investment:</span>
              <span className="ml-2 font-medium">{formatCurrency(results.parameters?.initialInvestment || 1000000)}</span>
            </div>
            <div>
              <span className="text-blue-700">Investment Period:</span>
              <span className="ml-2 font-medium">{results.parameters?.startYear} - {results.parameters?.endYear}</span>
            </div>
            <div>
              <span className="text-blue-700">Total Gain/Loss:</span>
              <span className={`ml-2 font-medium ${(data.finalValue - (results.parameters?.initialInvestment || 1000000)) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.finalValue - (results.parameters?.initialInvestment || 1000000))}
              </span>
            </div>
            <div>
              <span className="text-blue-700">Duration:</span>
              <span className="ml-2 font-medium">{(results.parameters?.endYear || 2024) - (results.parameters?.startYear || 2010)} years</span>
            </div>
          </div>
        </div>

        {/* Yearly Holdings Breakdown */}
        {data.yearlyHoldings && Object.keys(data.yearlyHoldings).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">
                Yearly Holdings Breakdown - Final Value: {formatCurrency(data.finalValue)}
              </h4>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === 'ticker') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy('ticker')
                      setSortOrder('asc')
                    }
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sortBy === 'ticker' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Ticker {sortBy === 'ticker' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'gains') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy('gains')
                      setSortOrder('desc')
                    }
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sortBy === 'gains' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Gains {sortBy === 'gains' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
            
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b-2 border-gray-300">
                    <th className="sticky left-0 bg-white text-left p-3 font-semibold border-r border-gray-200 z-20">Ticker</th>
                    {Object.keys(data.yearlyHoldings).sort().map(year => (
                      <th key={year} className="text-center p-3 font-semibold min-w-[120px]">{year}</th>
                    ))}
                    <th className="text-center p-3 font-semibold text-green-700 min-w-[120px]">Absolute Gain</th>
                    <th className="text-center p-3 font-semibold text-green-700 min-w-[140px]">Cumulative %</th>
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-600">
                    <th className="sticky left-0 bg-white text-left p-2 border-r border-gray-200 z-20">Stock Symbol</th>
                    {Object.keys(data.yearlyHoldings).sort().map(year => (
                      <th key={year} className="text-center p-2">Weight / Shares / Value</th>
                    ))}
                    <th className="text-center p-2 text-green-600">Final - Initial</th>
                    <th className="text-center p-2 text-green-600">Running Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get all unique tickers from all years
                    const allTickers = new Set<string>()
                    Object.values(data.yearlyHoldings).forEach((yearData: any) => {
                      Object.keys(yearData).forEach(ticker => allTickers.add(ticker))
                    })
                    
                    // Calculate gains for each ticker
                    const tickerGains = Array.from(allTickers).map(ticker => {
                      const years = Object.keys(data.yearlyHoldings).sort()
                      const firstYear = years[0]
                      const lastYear = years[years.length - 1]
                      
                      const initialValue = data.yearlyHoldings[firstYear]?.[ticker]?.value || 0
                      const finalValue = data.yearlyHoldings[lastYear]?.[ticker]?.value || 0
                      const absoluteGain = finalValue - initialValue
                      
                      return { ticker, absoluteGain, initialValue, finalValue }
                    })
                    
                    // Calculate total portfolio gain
                    const totalPortfolioGain = data.finalValue - (results.parameters?.initialInvestment || 1000000)
                    
                    // Sort based on current sort settings
                    if (sortBy === 'ticker') {
                      tickerGains.sort((a, b) => {
                        const comparison = a.ticker.localeCompare(b.ticker)
                        return sortOrder === 'asc' ? comparison : -comparison
                      })
                    } else {
                      tickerGains.sort((a, b) => {
                        const comparison = a.absoluteGain - b.absoluteGain
                        return sortOrder === 'asc' ? comparison : -comparison
                      })
                    }
                    
                    // Calculate cumulative percentages
                    let cumulativePercentage = 0
                    
                    return tickerGains.map(({ ticker, absoluteGain }, index) => {
                      const individualPercentage = totalPortfolioGain !== 0 ? (absoluteGain / totalPortfolioGain) * 100 : 0
                      cumulativePercentage += individualPercentage
                      
                      return (
                        <tr key={ticker} className="border-b border-gray-100 hover:bg-white">
                          <td className="sticky left-0 bg-white p-3 font-mono font-medium border-r border-gray-200 z-10">{ticker}</td>
                          {Object.keys(data.yearlyHoldings).sort().map(year => {
                            const holding = data.yearlyHoldings[year]?.[ticker]
                            return (
                              <td key={year} className="p-3 text-center text-xs">
                                {holding ? (
                                  <div className="space-y-1">
                                    <div className="font-medium text-blue-600">
                                      {(holding.weight * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-gray-600">
                                      {holding.shares ? Math.round(holding.shares).toLocaleString() : '0'}
                                    </div>
                                    <div className="text-gray-800 font-medium">
                                      {formatCurrency(holding.value)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-gray-400">—</div>
                                )}
                              </td>
                            )
                          })}
                          <td className="p-3 text-center">
                            <div className={`font-medium ${absoluteGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {absoluteGain >= 0 ? '+' : ''}{formatCurrency(absoluteGain)}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className={`font-medium ${cumulativePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {totalPortfolioGain !== 0 ? `${cumulativePercentage.toFixed(1)}%` : '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Ticker column and header row are frozen for easy navigation. Cumulative % shows running total of gains contribution.
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 shadow-sm">
      {/* Fidelity-style Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-wide">
              Portfolio Analysis
            </h2>
            {simulationName && (
              <p className="text-green-100 text-sm mt-1">{simulationName}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-green-100 text-xs uppercase tracking-wide">Performance Summary</p>
            <p className="text-white font-mono text-lg">
              {results.parameters?.startYear} - {results.parameters?.endYear}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Fidelity Style */}
      <div className="bg-gray-50 border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700 bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <div id="overview-content" className="bg-white">
          {/* Top Performance Cards - Fidelity Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50 border-b">
            {(() => {
              const topStrategy = strategies.reduce((best, current) => {
                const currentData = results[current.key]
                const bestData = results[best.key]
                return currentData?.totalReturn > bestData?.totalReturn ? current : best
              })
              const topData = results[topStrategy.key]
              
              return (
                <>
                  <div className="bg-white p-4 border-l-4 border-green-600 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Best Performer</p>
                    <p className="text-sm font-medium text-gray-900">{topStrategy.name}</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {formatPercentage(topData.totalReturn)}
                    </p>
                  </div>
                  
                  <div className="bg-white p-4 border-l-4 border-blue-600 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Portfolio Value</p>
                    <p className="text-sm text-gray-600">Initial: {formatCurrency(results.parameters?.initialInvestment || 0)}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatCurrency(topData.finalValue)}
                    </p>
                  </div>
                  
                  <div className="bg-white p-4 border-l-4 border-purple-600 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Time Period</p>
                    <p className="text-sm text-gray-600">{results.parameters?.endYear - results.parameters?.startYear + 1} Years</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">
                      {formatPercentage(topData.annualizedReturn)}
                    </p>
                    <p className="text-xs text-gray-500">Annualized</p>
                  </div>
                </>
              )
            })()}
          </div>

          {/* Strategy Comparison Table - Fidelity Style */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Strategy Performance Comparison
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium">Strategy</th>
                    <th className="text-right py-3 px-2 font-medium">Total Return</th>
                    <th className="text-right py-3 px-2 font-medium">Annual Return</th>
                    <th className="text-right py-3 px-2 font-medium">Final Value</th>
                    <th className="text-right py-3 px-2 font-medium">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((strategy, index) => {
                    const data = results[strategy.key]
                    if (!data) return null
                    
                    const gain = data.finalValue - (results.parameters?.initialInvestment || 0)
                    const isTop = getTopPerformer() === strategy.key

                    return (
                      <tr key={strategy.key} className={`border-b border-gray-100 hover:bg-gray-50 ${isTop ? 'bg-green-50' : ''}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center">
                            {isTop && <div className="w-2 h-8 bg-green-600 rounded-r mr-2"></div>}
                            <div>
                              <p className={`font-medium text-sm ${getStrategyColor(strategy.key)}`}>{strategy.name}</p>
                              <p className="text-xs text-gray-500">{strategy.icon}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-mono font-semibold ${data.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.totalReturn >= 0 ? '+' : ''}{formatPercentage(data.totalReturn)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-mono ${data.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.annualizedReturn >= 0 ? '+' : ''}{formatPercentage(data.annualizedReturn)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-semibold text-gray-900">
                          {formatCurrency(data.finalValue)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`font-mono font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gain >= 0 ? '+' : ''}{formatCurrency(gain)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Performance Chart - Fidelity Style */}
          <div className="border-t border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                Portfolio Performance Over Time
              </h3>
              
              <div className="h-80 bg-gray-50 rounded p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generateChartData()}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="year" 
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                      stroke="#6b7280"
                      fontSize={11}
                      tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(year) => `Year: ${year}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />
                    
                    {/* Strategy Lines - Fidelity Colors */}
                    <Line 
                      type="monotone" 
                      dataKey="equalWeightBuyHold" 
                      stroke="#16a34a" 
                      strokeWidth={getTopPerformer() === 'equalWeightBuyHold' ? 3 : 2}
                      name="Equal Weight Buy & Hold" 
                      dot={{ r: 3, fill: '#16a34a' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="marketCapBuyHold" 
                      stroke="#2563eb" 
                      strokeWidth={getTopPerformer() === 'marketCapBuyHold' ? 3 : 2}
                      name="Market Cap Buy & Hold" 
                      dot={{ r: 3, fill: '#2563eb' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="equalWeightRebalanced" 
                      stroke="#8b5cf6" 
                      strokeWidth={getTopPerformer() === 'equalWeightRebalanced' ? 3 : 2}
                      name="Equal Weight Rebalanced" 
                      dot={{ r: 3, fill: '#8b5cf6' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="marketCapRebalanced" 
                      stroke="#f59e0b" 
                      strokeWidth={getTopPerformer() === 'marketCapRebalanced' ? 3 : 2}
                      name="Market Cap Rebalanced" 
                      dot={{ r: 3, fill: '#f59e0b' }}
                      activeDot={{ r: 5 }}
                    />
                    
                    {/* SPY Benchmark - Dashed line */}
                    <Line 
                      type="monotone" 
                      dataKey="spyBenchmark" 
                      stroke="#dc2626" 
                      strokeWidth={2}
                      name="SPY Benchmark" 
                      dot={{ r: 3, fill: '#dc2626' }}
                      activeDot={{ r: 5 }}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Chart Legend */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-red-600" style={{ borderTop: '2px dashed #dc2626' }}></div>
                  <span>SPY Benchmark</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-gray-600"></div>
                  <span>Top performer shown with thicker line</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Statistics Section - Fidelity Style */}
          <div className="border-t border-gray-200 bg-gray-50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Key Performance Metrics
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const params = results.parameters || {}
                const years = (params.endYear - params.startYear) || 1
                const topData = results[getTopPerformer()]
                
                return (
                  <>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{params.tickerCount || 0}</p>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Securities</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{years}</p>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Years</p>
                    </div>
                    
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${topData?.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {topData ? formatPercentage(topData.totalReturn) : '—'}
                      </p>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Best Total Return</p>
                    </div>
                    
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${topData?.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {topData ? formatPercentage(topData.annualizedReturn) : '—'}
                      </p>
                      <p className="text-xs text-gray-600 uppercase tracking-wide">Annualized</p>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Export Options - Fidelity Style */}
          <div className="border-t border-gray-200 bg-gray-50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Export & Reports
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={handleExcelDownload}
                data-excel-download
                className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Excel Report</div>
                  <div className="text-sm text-gray-600">Download comprehensive analysis (.xlsx)</div>
                </div>
              </button>
              
              <button 
                onClick={handlePDFExport}
                className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">PDF Overview</div>
                  <div className="text-sm text-gray-600">Export overview tables as PDF document</div>
                </div>
              </button>
              
              <button className="flex items-center space-x-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Performance Metrics</div>
                  <div className="text-sm text-gray-600">Returns, volatility, Sharpe ratios</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'holdings' ? (
        // Holdings View
        renderHoldingsView()
      ) : activeTab === 'details' ? (
        // Analysis Details View
        renderAnalysisDetailsView()
      ) : (
        // Individual Strategy Detail Views
        <div>
          {activeTab === 'equalWeightBuyHold' && renderStrategyDetail('equalWeightBuyHold', 'Equal Weight Buy & Hold', '⚖️')}
          {activeTab === 'marketCapBuyHold' && renderStrategyDetail('marketCapBuyHold', 'Market Cap Buy & Hold', '📈')}
          {activeTab === 'equalWeightRebalanced' && renderStrategyDetail('equalWeightRebalanced', 'Equal Weight Rebalanced', '🔄')}
          {activeTab === 'marketCapRebalanced' && renderStrategyDetail('marketCapRebalanced', 'Market Cap Rebalanced', '📊')}
          {activeTab === 'spyBenchmark' && renderStrategyDetail('spyBenchmark', 'SPY Benchmark', '🏛️')}
        </div>
      )}
    </div>
  )
}