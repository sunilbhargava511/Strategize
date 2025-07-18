'use client';

import React, { useState } from 'react';
import { Metadata } from 'next';
import BacktestForm from '../../components/backtesting/BacktestForm';
import ResultsDisplay from '../../components/backtesting/ResultsDisplay';
import StrategyComparison from '../../components/backtesting/StrategyComparison';
import { BacktestResults } from '../../lib/strategies/strategyRunner';
import { TrendingUp, BarChart3, PieChart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Note: This would be in a layout.tsx or exported from page.tsx in App Router
// export const metadata: Metadata = {
//   title: 'Portfolio Backtesting | Investment Strategy Analysis',
//   description: 'Backtest portfolio strategies with historical S&P 500 data. Compare equal weight, market cap weighted, buy & hold, and rebalanced approaches.',
//   keywords: 'portfolio backtesting, investment strategy, S&P 500, equal weight, market cap weighted, rebalancing',
// };

export default function BacktestingPage() {
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'results' | 'comparison'>('form');
  const [backtestConfig, setBacktestConfig] = useState<{
    startYear: number;
    endYear: number;
    initialInvestment: number;
  }>({
    startYear: 2010,
    endYear: 2024,
    initialInvestment: 1000000
  });

  const handleResults = (newResults: BacktestResults) => {
    setResults(newResults);
    setActiveTab('results');
  };

  const resetBacktest = () => {
    setResults(null);
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Market Cap Fetcher</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Portfolio Backtesting</h1>
                  <p className="text-sm text-gray-600">
                    Compare investment strategies with historical S&P 500 data
                  </p>
                </div>
              </div>
            </div>
            
            {results && (
              <button
                onClick={resetBacktest}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                New Backtest
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {results && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('form')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'form'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Configuration
                </div>
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'results'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Results
                </div>
              </button>
              <button
                onClick={() => setActiveTab('comparison')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'comparison'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  Comparison
                </div>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pb-12">
        {/* Configuration Tab or Main Form */}
        {(activeTab === 'form' || !results) && (
          <BacktestForm 
            onResults={handleResults}
          />
        )}

        {/* Results Tab */}
        {activeTab === 'results' && results && (
          <ResultsDisplay
            results={results}
            startYear={backtestConfig.startYear}
            endYear={backtestConfig.endYear}
            initialInvestment={backtestConfig.initialInvestment}
          />
        )}

        {/* Comparison Tab */}
        {activeTab === 'comparison' && results && (
          <StrategyComparison
            results={results}
            startYear={backtestConfig.startYear}
            endYear={backtestConfig.endYear}
            initialInvestment={backtestConfig.initialInvestment}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">About Portfolio Backtesting</h3>
              <p className="text-sm text-gray-600">
                This tool allows you to backtest different portfolio strategies using historical 
                S&P 500 constituent data. Compare equal weight vs market cap weighted approaches, 
                and buy & hold vs rebalanced strategies.
              </p>
            </div>

            {/* Features */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Four distinct investment strategies</li>
                <li>• Historical S&P 500 constituent data</li>
                <li>• SPY benchmark comparison</li>
                <li>• Excel export with detailed analytics</li>
                <li>• Interactive charts and visualizations</li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Important Disclaimer</h3>
              <p className="text-sm text-gray-600">
                This backtesting tool is for educational and research purposes only. 
                Past performance does not guarantee future results. Transaction costs, 
                taxes, and other factors are not included in these calculations.
              </p>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-500">
              Portfolio Backtesting Tool • Built with historical financial data • 
              {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Loading component for the page
 */
export function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading Portfolio Backtesting</h2>
        <p className="text-gray-600">Initializing backtesting environment...</p>
      </div>
    </div>
  );
}

/**
 * Error component for the page
 */
export function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">
          There was an error loading the backtesting page. Please try again.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Market Cap Fetcher
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}