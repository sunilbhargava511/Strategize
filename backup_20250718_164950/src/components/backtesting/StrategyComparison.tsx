'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { BacktestResults } from '../../lib/strategies/strategyRunner';
import { formatCurrency, formatPercentage } from '../../lib/utils/portfolioUtils';

interface StrategyComparisonProps {
  results: BacktestResults;
  startYear: number;
  endYear: number;
  initialInvestment: number;
}

const StrategyComparison: React.FC<StrategyComparisonProps> = ({ 
  results, 
  startYear, 
  endYear, 
  initialInvestment 
}) => {
  // Prepare data for line chart (portfolio value over time)
  const lineChartData = React.useMemo(() => {
    const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
    
    return years.map(year => {
      const dataPoint: any = { year };
      
      results.strategies.forEach(strategy => {
        const snapshot = strategy.yearlySnapshots.find(s => 
          new Date(s.date).getFullYear() === year
        );
        dataPoint[strategy.strategy] = snapshot ? snapshot.totalValue : null;
      });
      
      // Add SPY benchmark
      const spyPoint = results.spyBenchmark.data.find(d => 
        new Date(d.date).getFullYear() === year
      );
      if (spyPoint) {
        const spyStartPrice = results.spyBenchmark.data.find(d => 
          new Date(d.date).getFullYear() === startYear
        )?.adjustedPrice || 1;
        const spyShares = initialInvestment / spyStartPrice;
        dataPoint['SPY Benchmark'] = spyShares * spyPoint.adjustedPrice;
      }
      
      return dataPoint;
    }).filter(d => Object.keys(d).length > 1); // Filter out years with no data
  }, [results, startYear, endYear, initialInvestment]);

  // Prepare data for bar chart (final returns comparison)
  const barChartData = React.useMemo(() => {
    const data = results.strategies.map(strategy => ({
      strategy: strategy.strategy.replace(' Annually', '').replace('Weighted', 'Cap'),
      totalReturn: strategy.totalReturn * 100,
      annualizedReturn: strategy.annualizedReturn * 100,
      finalValue: strategy.endValue
    }));
    
    // Add SPY benchmark
    data.push({
      strategy: 'SPY Benchmark',
      totalReturn: results.spyBenchmark.totalReturn * 100,
      annualizedReturn: results.spyBenchmark.annualizedReturn * 100,
      finalValue: results.spyBenchmark.endValue
    });
    
    return data.sort((a, b) => b.finalValue - a.finalValue);
  }, [results]);

  // Strategy colors
  const strategyColors = {
    'Equal Weight Buy & Hold': '#3B82F6',
    'Market Cap Weighted Buy & Hold': '#10B981',
    'Equal Weight Rebalanced Annually': '#8B5CF6',
    'Market Cap Weighted Rebalanced Annually': '#F59E0B',
    'SPY Benchmark': '#EF4444'
  };

  const formatTooltipValue = (value: any, name: string) => {
    if (typeof value === 'number') {
      return [formatCurrency(value), name];
    }
    return [value, name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Year: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${formatCurrency(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Strategy Comparison</h2>
        
        {/* Portfolio Value Over Time */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Value Over Time</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="year" 
                  stroke="#666"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#666"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="line"
                />
                
                {results.strategies.map(strategy => (
                  <Line
                    key={strategy.strategy}
                    type="monotone"
                    dataKey={strategy.strategy}
                    stroke={strategyColors[strategy.strategy as keyof typeof strategyColors] || '#666'}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
                
                <Line
                  type="monotone"
                  dataKey="SPY Benchmark"
                  stroke={strategyColors['SPY Benchmark']}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Returns Comparison Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Total Returns */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Returns Comparison</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="strategy" 
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Total Return']}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Bar 
                    dataKey="totalReturn" 
                    fill="#3B82F6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Annualized Returns */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Annualized Returns Comparison</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="strategy" 
                    stroke="#666"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Annualized Return']}
                    labelStyle={{ color: '#374151' }}
                  />
                  <Bar 
                    dataKey="annualizedReturn" 
                    fill="#10B981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Best Performer */}
            <div className="bg-green-100 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">🏆 Best Performer</h4>
              <p className="text-green-800 font-semibold">{results.summary.bestStrategy}</p>
              <p className="text-sm text-green-700">
                {formatCurrency(Math.max(...results.strategies.map(s => s.endValue)))} final value
              </p>
            </div>

            {/* SPY Outperformers */}
            <div className="bg-blue-100 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">🎯 Beat SPY</h4>
              <p className="text-blue-800 font-semibold">
                {results.summary.spyOutperformers.length} of {results.strategies.length} strategies
              </p>
              <p className="text-sm text-blue-700">
                outperformed the benchmark
              </p>
            </div>

            {/* Range of Returns */}
            <div className="bg-purple-100 border border-purple-200 rounded-lg p-4">
              <h4 className="font-medium text-purple-900 mb-2">📊 Return Range</h4>
              <p className="text-purple-800 font-semibold">
                {formatPercentage(
                  (Math.max(...results.strategies.map(s => s.endValue)) - 
                   Math.min(...results.strategies.map(s => s.endValue))) / 
                  Math.min(...results.strategies.map(s => s.endValue))
                )}
              </p>
              <p className="text-sm text-purple-700">
                difference between best and worst
              </p>
            </div>
          </div>

          {/* Strategy Performance Summary */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Performance Summary</h4>
            <div className="space-y-2 text-sm text-gray-700">
              {results.strategies.map(strategy => {
                const outperformedSpy = strategy.endValue > results.spyBenchmark.endValue;
                const outperformance = ((strategy.endValue - results.spyBenchmark.endValue) / results.spyBenchmark.endValue) * 100;
                
                return (
                  <div key={strategy.strategy} className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="font-medium">{strategy.strategy}</span>
                    <span className={`${outperformedSpy ? 'text-green-600' : 'text-red-600'}`}>
                      {outperformedSpy ? '+' : ''}{outperformance.toFixed(1)}% vs SPY
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Methodology Note */}
          <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">📋 Methodology</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• All strategies start with ${formatCurrency(initialInvestment)} on January 1, {startYear}</li>
              <li>• Rebalanced strategies adjust holdings annually at year-start</li>
              <li>• Buy & hold strategies only add new stocks when they join the index</li>
              <li>• Transaction costs and taxes are not included in calculations</li>
              <li>• Dividends are assumed to be reinvested (using adjusted prices)</li>
              <li>• SPY benchmark assumes buy-and-hold of SPY ETF over the same period</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyComparison;