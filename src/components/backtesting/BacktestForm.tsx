'use client';

import React, { useState, useRef } from 'react';
import { Upload, Download, Play, Pause, Square, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface BacktestResults {
  strategies: Array<{
    strategy: string;
    endValue: number;
    totalReturn: number;
    annualizedReturn: number;
  }>;
  summary: {
    bestStrategy: string;
    spyOutperformers: string[];
    executionTime: number;
  };
}

interface BacktestFormProps {
  onResults?: (results: BacktestResults) => void;
}

const BacktestForm: React.FC<BacktestFormProps> = ({ onResults }) => {
  const [config, setConfig] = useState({
    startYear: 2010,
    endYear: 2024,
    initialInvestment: 1000000,
    strategies: ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced']
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, step: '' });
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [error, setError] = useState<string>('');
  const [stocksInput, setStocksInput] = useState<string>('');
  const [customStocks, setCustomStocks] = useState<string>('AAPL\nMSFT\nGOOGL\nAMZN\nTSLA');

  const abortControllerRef = useRef<AbortController | null>(null);

  const strategyOptions = [
    { id: 'equalWeightBuyHold', name: 'Equal Weight Buy & Hold', description: 'Equal weights, no rebalancing' },
    { id: 'marketCapBuyHold', name: 'Market Cap Buy & Hold', description: 'Market cap weights, no rebalancing' },
    { id: 'equalWeightRebalanced', name: 'Equal Weight Rebalanced', description: 'Annual equal weight rebalancing' },
    { id: 'marketCapRebalanced', name: 'Market Cap Rebalanced', description: 'Annual market cap rebalancing' }
  ];

  const handleStrategyChange = (strategyId: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      strategies: checked 
        ? [...prev.strategies, strategyId]
        : prev.strategies.filter(s => s !== strategyId)
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setStocksInput(content);
    };
    reader.readAsText(file);
  };

  const runBacktest = async () => {
    setError('');
    setIsRunning(true);
    setIsPaused(false);
    setResults(null);
    
    try {
      // Parse stocks input
      let stocks;
      if (stocksInput.includes(',')) {
        // CSV format or comma-separated
        const lines = stocksInput.trim().split('\n');
        if (lines[0].toLowerCase().includes('ticker')) {
          // Has header
          stocks = lines.slice(1).map(line => {
            const [ticker, startDate, endDate] = line.split(',').map(s => s.trim());
            return { ticker, startDate, endDate: endDate || null };
          });
        } else {
          // Just tickers
          stocks = stocksInput.split(',').map(ticker => ({
            ticker: ticker.trim(),
            startDate: `${config.startYear}-01-01`,
            endDate: null
          }));
        }
      } else if (customStocks) {
        // Use custom stocks
        stocks = customStocks.split('\n').map(ticker => ({
          ticker: ticker.trim(),
          startDate: `${config.startYear}-01-01`, 
          endDate: null
        })).filter(s => s.ticker);
      } else {
        // Use SP500 data
        setProgress({ current: 1, total: 10, step: 'Loading S&P 500 stock data...' });
        const response = await fetch('/api/backtesting?action=sp500-stocks');
        const sp500Data = await response.json();
        stocks = sp500Data.stocks;
      }

      if (!stocks || stocks.length === 0) {
        throw new Error('No stocks provided for backtesting');
      }

      setProgress({ current: 2, total: 10, step: `Initializing backtest with ${stocks.length} stocks...` });

      const fullConfig = {
        stocks,
        startYear: config.startYear,
        endYear: config.endYear,
        initialInvestment: config.initialInvestment,
        strategies: config.strategies
      };

      // Start backtest - FIXED: Call /api/backtesting instead of /api/backtesting/run
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/backtesting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullConfig),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Backtest failed: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Process streaming data
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'progress') {
                setProgress(data.progress);
              } else if (data.type === 'results') {
                setResults(data.results);
                onResults?.(data.results);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.log('Non-JSON line:', line);
            }
          }
        }
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Backtest was cancelled');
      } else {
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    } finally {
      setIsRunning(false);
      setIsPaused(false);
      setProgress({ current: 0, total: 0, step: '' });
    }
  };

  const pauseBacktest = () => {
    setIsPaused(true);
  };

  const stopBacktest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    setIsPaused(false);
  };

  const downloadResults = async () => {
    if (!results) return;

    try {
      const response = await fetch('/api/excel-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategies: results.strategies,
          spyData: [],
          startYear: config.startYear,
          endYear: config.endYear,
          initialInvestment: config.initialInvestment
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_backtest_${config.startYear}_${config.endYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-lg">📊</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Backtesting</h1>
        </div>

        {/* Configuration Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Time Period */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Time Period</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.startYear}
                  onChange={(e) => setConfig(prev => ({ ...prev, startYear: parseInt(e.target.value) }))}
                >
                  {Array.from({ length: 30 }, (_, i) => 1996 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={config.endYear}
                  onChange={(e) => setConfig(prev => ({ ...prev, endYear: parseInt(e.target.value) }))}
                >
                  {Array.from({ length: 30 }, (_, i) => 1996 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Investment Amount */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Investment Amount</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial Investment</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={config.initialInvestment}
                onChange={(e) => setConfig(prev => ({ ...prev, initialInvestment: parseInt(e.target.value) }))}
                min="1000"
                step="1000"
              />
              <p className="text-sm text-gray-500 mt-1">
                ${config.initialInvestment.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategies to Test</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategyOptions.map(strategy => (
              <label key={strategy.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={config.strategies.includes(strategy.id)}
                  onChange={(e) => handleStrategyChange(strategy.id, e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{strategy.name}</div>
                  <div className="text-sm text-gray-500">{strategy.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Stock Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Universe</h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="stockSource"
                  value="sp500"
                  checked={!stocksInput && !customStocks}
                  onChange={() => { setStocksInput(''); setCustomStocks(''); }}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span>S&P 500 Historical Constituents</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="stockSource"
                  value="custom"
                  checked={!!customStocks}
                  onChange={() => setCustomStocks('AAPL\nMSFT\nGOOGL\nAMZN\nTSLA')}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span>Custom Stock List</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="stockSource"
                  value="upload"
                  checked={!!stocksInput}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span>Upload CSV</span>
              </label>
            </div>

            {customStocks !== '' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock Tickers (one per line)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={6}
                  value={customStocks}
                  onChange={(e) => setCustomStocks(e.target.value)}
                  placeholder="AAPL&#10;MSFT&#10;GOOGL&#10;AMZN&#10;TSLA"
                />
              </div>
            )}

            {stocksInput === '' && customStocks === '' && (
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-gray-400" />
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-4 mb-6">
          {!isRunning ? (
            <button
              onClick={runBacktest}
              disabled={!config.strategies?.length}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              <Play className="h-5 w-5" />
              Run Backtest
            </button>
          ) : (
            <>
              <button
                onClick={pauseBacktest}
                disabled={isPaused}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400"
              >
                <Pause className="h-5 w-5" />
                Pause
              </button>
              <button
                onClick={stopBacktest}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Square className="h-5 w-5" />
                Stop
              </button>
            </>
          )}

          {results && (
            <button
              onClick={downloadResults}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-5 w-5" />
              Download Excel
            </button>
          )}
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <span className="font-medium text-blue-900">Running Backtest...</span>
            </div>
            {progress.total > 0 && (
              <>
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-blue-700">
                  {progress.step} ({progress.current}/{progress.total})
                </p>
              </>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">Error</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Results Preview */}
        {results && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Backtest Complete!</span>
            </div>
            <div className="text-sm text-green-700">
              <p>✅ {results.strategies.length} strategies completed</p>
              <p>📊 Best strategy: {results.summary.bestStrategy}</p>
              <p>🎯 Strategies beating SPY: {results.summary.spyOutperformers.length}</p>
              <p className="mt-2 font-medium">Download the Excel file for detailed results and analysis.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BacktestForm;