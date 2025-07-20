import { useState, useRef } from 'react'
import Papa from 'papaparse'

interface TickerInputProps {
  tickers: string[]
  onTickersChange: (tickers: string[]) => void
}

export default function TickerInput({ tickers, onTickersChange }: TickerInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateTicker = (ticker: string): boolean => {
    // Basic ticker validation - letters and dots only, 1-6 characters
    return /^[A-Z]{1,6}(\.[A-Z]{1,3})?$/.test(ticker.toUpperCase())
  }

  const processTickerInput = (input: string) => {
    // Split by commas or newlines, clean up whitespace
    const rawTickers = input
      .split(/[,\n\r]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0)

    const validTickers: string[] = []
    const invalidTickers: string[] = []

    rawTickers.forEach(ticker => {
      if (validateTicker(ticker)) {
        if (!validTickers.includes(ticker)) {
          validTickers.push(ticker)
        }
      } else {
        invalidTickers.push(ticker)
      }
    })

    setErrors(invalidTickers.length > 0 ? 
      [`Invalid tickers: ${invalidTickers.join(', ')}`] : [])
    
    onTickersChange(validTickers)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInputValue(value)
    processTickerInput(value)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setErrors(['File too large. Maximum size is 5MB.'])
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please upload a CSV file.'])
      return
    }

    setIsUploading(true)
    setErrors([])

    Papa.parse(file, {
      complete: (results) => {
        try {
          // Extract tickers from first column, skip header if present
          const allRows = results.data as string[][]
          let tickerColumn: string[] = []

          // Try to find ticker column
          allRows.forEach(row => {
            if (row && row[0] && typeof row[0] === 'string') {
              const ticker = row[0].trim().toUpperCase()
              if (ticker && ticker !== 'TICKER' && ticker !== 'SYMBOL') {
                tickerColumn.push(ticker)
              }
            }
          })

          if (tickerColumn.length === 0) {
            setErrors(['No valid tickers found in CSV file.'])
            return
          }

          // Validate and process tickers
          const validTickers: string[] = []
          const invalidTickers: string[] = []

          tickerColumn.forEach(ticker => {
            if (validateTicker(ticker)) {
              if (!validTickers.includes(ticker)) {
                validTickers.push(ticker)
              }
            } else {
              invalidTickers.push(ticker)
            }
          })

          if (invalidTickers.length > 0) {
            setErrors([`Invalid tickers found: ${invalidTickers.slice(0, 10).join(', ')}${invalidTickers.length > 10 ? '...' : ''}`])
          }

          // Update the textarea with the loaded tickers
          const tickerText = validTickers.join('\n')
          setInputValue(tickerText)
          onTickersChange(validTickers)

        } catch (error) {
          setErrors(['Error processing CSV file. Please check the format.'])
        } finally {
          setIsUploading(false)
        }
      },
      error: (error) => {
        setErrors([`Error reading file: ${error.message}`])
        setIsUploading(false)
      }
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const downloadSampleCSV = () => {
    const sampleData = 'TICKER\nAAPL\nMSFT\nGOOGL\nAMZN\nTSLA\nMETA\nNVDA\nNFLX\nCRM\nADBE'
    const blob = new Blob([sampleData], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-tickers.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">📊</span>
        <h2 className="text-2xl font-semibold text-primary-900">
          Input Stock Tickers
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Manual Entry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manual Entry
          </label>
          <textarea
            value={inputValue}
            onChange={handleTextareaChange}
            className="w-full p-4 border-2 border-dashed border-gray-300 
                     rounded-lg focus:border-primary-500 focus:border-solid
                     transition-all duration-200 font-mono text-sm
                     placeholder-gray-400 resize-none"
            placeholder={`Enter stock tickers (one per line or comma-separated)

Example:
AAPL
MSFT
GOOGL`}
            rows={8}
          />
          <div className="mt-2 text-sm text-gray-600">
            Enter stock symbols like AAPL, MSFT, GOOGL. Supports both line-separated and comma-separated formats.
          </div>
        </div>

        {/* CSV Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CSV Upload
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="space-y-4">
              <div className="text-4xl text-gray-400">📁</div>
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400
                           text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isUploading ? 'Uploading...' : 'Choose CSV File'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <div className="text-sm text-gray-600">
                <p>Upload a CSV file with tickers in the first column</p>
                <p>Maximum file size: 5MB</p>
              </div>
              <button
                onClick={downloadSampleCSV}
                className="text-primary-500 hover:text-primary-600 text-sm underline"
              >
                Download Sample CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className="mt-4 space-y-2">
        {tickers.length > 0 && (
          <div className="flex items-center space-x-2 text-success">
            <span>✅</span>
            <span className="font-medium">
              {tickers.length} valid ticker{tickers.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((error, index) => (
              <div key={index} className="flex items-center space-x-2 text-danger">
                <span>❌</span>
                <span className="text-sm">{error}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticker Preview */}
      {tickers.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Loaded Tickers:</h4>
          <div className="flex flex-wrap gap-2">
            {tickers.slice(0, 20).map(ticker => (
              <span key={ticker} className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm">
                {ticker}
              </span>
            ))}
            {tickers.length > 20 && (
              <span className="text-gray-500 text-sm">
                +{tickers.length - 20} more...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}