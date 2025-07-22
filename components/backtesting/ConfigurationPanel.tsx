interface Configuration {
  startYear: number
  endYear: number
  initialInvestment: number
  useCache: boolean
  includeDividends: boolean
}

interface ConfigurationPanelProps {
  configuration: Configuration
  onConfigurationChange: (config: Configuration) => void
}

export default function ConfigurationPanel({ configuration, onConfigurationChange }: ConfigurationPanelProps) {
  const currentYear = new Date().getFullYear()
  const minYear = 1990
  const maxYear = currentYear // Can analyze through Jan 1 of current year

  const handleChange = (field: keyof Configuration, value: any) => {
    onConfigurationChange({
      ...configuration,
      [field]: value
    })
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const presetInvestments = [
    { label: '$100K', value: 100000 },
    { label: '$500K', value: 500000 },
    { label: '$1M', value: 1000000 },
    { label: '$5M', value: 5000000 },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">⚙️</span>
        <h2 className="text-2xl font-semibold text-primary-900">
          Configuration
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Time Period */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <span>📅</span>
            <span>Time Period</span>
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Year
              </label>
              <select
                value={configuration.startYear}
                onChange={(e) => handleChange('startYear', parseInt((e.target as HTMLSelectElement).value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Year
              </label>
              <select
                value={configuration.endYear}
                onChange={(e) => handleChange('endYear', parseInt((e.target as HTMLSelectElement).value))}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {Array.from({ length: maxYear - configuration.startYear + 1 }, (_, i) => configuration.startYear + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
              Analysis period: {configuration.endYear - configuration.startYear + 1} years
            </div>
          </div>
        </div>

        {/* Initial Investment */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <span>💰</span>
            <span>Initial Investment</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={configuration.initialInvestment}
                onChange={(e) => handleChange('initialInvestment', parseInt((e.target as HTMLInputElement).value) || 0)}
                min="1000"
                max="100000000"
                step="1000"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {presetInvestments.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => handleChange('initialInvestment', preset.value)}
                  className={`
                    px-3 py-2 rounded text-sm font-medium transition-colors
                    ${configuration.initialInvestment === preset.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="text-sm text-gray-600 bg-green-50 p-2 rounded">
              Starting with: {formatCurrency(configuration.initialInvestment)}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <span>🔧</span>
            <span>Options</span>
          </h3>

          <div className="space-y-4">
            {/* Use Cache Toggle */}
            <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
              <button
                onClick={() => handleChange('useCache', !configuration.useCache)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${configuration.useCache ? 'bg-primary-500' : 'bg-gray-300'}
                `}
              >
                <div className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                  ${configuration.useCache ? 'translate-x-5' : 'translate-x-0'}
                `} />
              </button>
              <div>
                <div className="font-medium text-gray-900">Use Cache</div>
                <div className="text-sm text-gray-600">
                  Speed up analysis with cached data
                </div>
              </div>
            </div>

            {/* Include Dividends Toggle */}
            <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
              <button
                onClick={() => handleChange('includeDividends', !configuration.includeDividends)}
                className={`
                  relative w-11 h-6 rounded-full transition-colors
                  ${configuration.includeDividends ? 'bg-primary-500' : 'bg-gray-300'}
                `}
              >
                <div className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                  ${configuration.includeDividends ? 'translate-x-5' : 'translate-x-0'}
                `} />
              </button>
              <div>
                <div className="font-medium text-gray-900">Include Dividends</div>
                <div className="text-sm text-gray-600">
                  Factor in dividend payments
                </div>
              </div>
            </div>

            {/* Rebalancing Info */}
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <strong>📊 Rebalancing:</strong> Portfolios are rebalanced annually on January 1st to maintain target allocations.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Analysis Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Period:</span>
            <span className="ml-2 font-medium">{configuration.startYear} - {configuration.endYear}</span>
          </div>
          <div>
            <span className="text-gray-600">Investment:</span>
            <span className="ml-2 font-medium">{formatCurrency(configuration.initialInvestment)}</span>
          </div>
          <div>
            <span className="text-gray-600">Options:</span>
            <span className="ml-2 font-medium">
              {configuration.useCache ? '🔄 Cached' : '🔄 Live'} 
              {configuration.includeDividends ? ', 💰 +Dividends' : ', 📈 Price Only'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}