'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar, Award, Target, BarChart3 } from 'lucide-react';
import { BacktestResults } from '../../lib/strategies/strategyRunner';
import { formatCurrency, formatPercentage } from '../../lib/utils/portfolioUtils';

interface ResultsDisplayProps {
  results: BacktestResults;
  startYear: number;
  endYear: number;
  initialInvestment: number;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ 
  results, 
  startYear, 
  endYear, 
  initialInvestment 
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<string>(results.strategies[0]?.strategy || '');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'holdings'>('summary');

  const selectedStrategyData = results.strategies.find(s => s.strategy === selectedStrategy);
  const years = endYear - startYear;

  // Calculate additional metrics
  const calculateSharpeRatio = (strategy: any) => {
    // Simplified Sharpe ratio calculation (assuming 2% risk-free rate)
    const riskFreeRate = 0.02;
    const excessReturn = strategy.annualizedReturn - riskFreeRate;
    // For simplicity, using a rough volatility estimate
    const volatility = Math.sqrt(Math.abs(strategy.totalReturn / years));
    return volatility > 0 ? excessReturn / volatility : 0;
  };

  const getPerformanceIcon = (value: number, benchmark: number) => {
    if (value > benchmark) {
      return <TrendingUp className="h-5 w-5 text-green-600" />;
    } else {
      return <TrendingDown className="h-5 w-5 text-red-600" />;
    }
  };

  const getPerformanceColor = (value: number, benchmark: number) => {
    return value > benchmark ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header Summary */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Backtesting Results</h2>
            <p className="text-gray-600">
              {startYear} - {endYear} • {formatCurrency(initialInvestment)} Initial Investment
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            {years} years • {results.strategies.length} strategies
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Best Strategy */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Best Strategy</span>
            </div>
            <p className="font-bold text-lg text-green-900">{results.summary.bestStrategy}</p>
            <p className="text-sm text-green-700">
              {formatCurrency(Math.max(...results.strategies.map(s => s.endValue)))}
            </p>
          </div>

          {/* SPY Benchmark */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">SPY Benchmark</span>
            </div>
            <p className="font-bold text-lg text-blue-900">
              {formatPercentage(results.spyBenchmark.totalReturn)}
            </p>
            <p className="text-sm text-blue-700">
              {formatCurrency(results.spyBenchmark.endValue)}
            </p>
          </div>

          {/* Outperformers */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">Beat SPY</span>
            </div>
            <p className="font-bold text-lg text-purple-900">
              {results.summary.spyOutperformers.length}/{results.strategies.length}
            </p>
            <p className="text-sm text-purple-700">strategies</p>
          </div>

          {/* Execution Time */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Execution</span>
            </div>
            <p className="font-bold text-lg text-gray-900">
              {(results.summary.executionTime / 1000).toFixed(1)}s
            </p>
            <p className="text-sm text-gray-700">processing time</p>
          </div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {['summary', 'detailed', 'holdings'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Summary View */}
        {viewMode === 'summary' && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Strategy Performance Summary</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Strategy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Return
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Annual Return
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      vs SPY
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sharpe Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.strategies.map((strategy, index) => (
                    <tr 
                      key={strategy.strategy}
                      className={`hover:bg-gray-50 cursor-pointer ${
                        selectedStrategy === strategy.strategy ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedStrategy(strategy.strategy)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{strategy.strategy}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">
                          {formatCurrency(strategy.endValue)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-medium ${
                          strategy.totalReturn > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(strategy.totalReturn)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`font-medium ${
                          strategy.annualizedReturn > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(strategy.annualizedReturn)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-1 ${
                          getPerformanceColor(strategy.endValue, results.spyBenchmark.endValue)
                        }`}>
                          {getPerformanceIcon(strategy.endValue, results.spyBenchmark.endValue)}
                          <span className="font-medium">
                            {strategy.endValue > results.spyBenchmark.endValue ? '+' : ''}
                            {formatPercentage(
                              (strategy.endValue - results.spyBenchmark.endValue) / results.spyBenchmark.endValue
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 font-medium">
                          {calculateSharpeRatio(strategy).toFixed(2)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {/* SPY Benchmark Row */}
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-blue-900">SPY Benchmark</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-blue-900">
                        {formatCurrency(results.spyBenchmark.endValue)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-blue-900">
                        {formatPercentage(results.spyBenchmark.totalReturn)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-blue-900">
                        {formatPercentage(results.spyBenchmark.annualizedReturn)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-blue-700">—</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-blue-900 font-bold">
                        {calculateSharpeRatio(results.spyBenchmark).toFixed(2)}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed View */}
        {viewMode === 'detailed' && selectedStrategyData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {selectedStrategyData.strategy} - Detailed Analysis
              </h3>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {results.strategies.map(strategy => (
                  <option key={strategy.strategy} value={strategy.strategy}>
                    {strategy.strategy}
                  </option>
                ))}
              </select>
            </div>

            {/* Year-by-Year Performance */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Year-by-Year Performance</h4>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Portfolio Value</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Holdings</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cash</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">YoY Return</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedStrategyData.yearlySnapshots.map((snapshot, index) => {
                      const prevSnapshot = selectedStrategyData.yearlySnapshots[index - 1];
                      const yoyReturn = prevSnapshot 
                        ? (snapshot.totalValue - prevSnapshot.totalValue) / prevSnapshot.totalValue
                        : 0;
                      
                      return (
                        <tr key={snapshot.date} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {new Date(snapshot.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(snapshot.totalValue)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {snapshot.holdings.length} stocks
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(snapshot.cash)}
                          </td>
                          <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${
                            yoyReturn >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {index > 0 ? formatPercentage(yoyReturn) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Holdings View */}
        {viewMode === 'holdings' && selectedStrategyData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                {selectedStrategyData.strategy} - Holdings Breakdown
              </h3>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {results.strategies.map(strategy => (
                  <option key={strategy.strategy} value={strategy.strategy}>
                    {strategy.strategy}
                  </option>
                ))}
              </select>
            </div>

            {/* Final Holdings */}
            {selectedStrategyData.yearlySnapshots.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">
                  Final Holdings ({selectedStrategyData.yearlySnapshots[selectedStrategyData.yearlySnapshots.length - 1].date})
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticker</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shares</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedStrategyData.yearlySnapshots[selectedStrategyData.yearlySnapshots.length - 1].holdings
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 20) // Show top 20 holdings
                        .map((holding, index) => (
                          <tr key={holding.ticker} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {holding.ticker}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {holding.shares.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(holding.value)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${Math.min(holding.weight * 100, 100)}%` }}
                                  ></div>
                                </div>
                                {formatPercentage(holding.weight)}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                
                {selectedStrategyData.yearlySnapshots[selectedStrategyData.yearlySnapshots.length - 1].holdings.length > 20 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing top 20 of {selectedStrategyData.yearlySnapshots[selectedStrategyData.yearlySnapshots.length - 1].holdings.length} holdings
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;