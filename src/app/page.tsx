import Link from 'next/link';
import { TrendingUp, BarChart3, DollarSign, Target } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <TrendingUp className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Portfolio Backtesting</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Compare investment strategies using historical S&P 500 data. Test equal weight vs market cap weighted approaches, 
            and buy & hold vs rebalanced strategies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Four Strategies</h3>
            <p className="text-sm text-gray-600">Equal weight & market cap weighted, both buy & hold and rebalanced</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <Target className="h-8 w-8 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">SPY Benchmark</h3>
            <p className="text-sm text-gray-600">Compare all strategies against SPY ETF performance</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Historical Data</h3>
            <p className="text-sm text-gray-600">Uses real S&P 500 constituent data from 1996-2025</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <TrendingUp className="h-8 w-8 text-orange-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Excel Reports</h3>
            <p className="text-sm text-gray-600">Download comprehensive Excel reports with detailed analytics</p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/backtesting"
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium shadow-lg"
          >
            <TrendingUp className="h-6 w-6" />
            Start Backtesting
          </Link>
        </div>

        <div className="mt-16 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Strategies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Buy & Hold Strategies</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• <strong>Equal Weight Buy & Hold:</strong> Start equal, add new stocks proportionally</p>
                <p>• <strong>Market Cap Buy & Hold:</strong> Weight by market cap, add by market cap</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Rebalanced Strategies</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• <strong>Equal Weight Rebalanced:</strong> Annual rebalancing to equal weights</p>
                <p>• <strong>Market Cap Rebalanced:</strong> Annual rebalancing to market cap weights</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
