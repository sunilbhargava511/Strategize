interface StrategySelectionProps {
  selectedStrategies: string[]
  onSelectionChange: (strategies: string[]) => void
}

interface Strategy {
  id: string
  name: string
  icon: string
  description: string
  implemented: boolean
}

const strategies: Strategy[] = [
  {
    id: 'marketCapWeighted',
    name: 'Market Cap Weighted',
    icon: '📈',
    description: 'Traditional index approach weighted by company size',
    implemented: true
  },
  {
    id: 'equalWeighted',
    name: 'Equal Weighted',
    icon: '⚖️',
    description: 'Each stock gets the same allocation regardless of size',
    implemented: true
  },
  {
    id: 'momentumBased',
    name: 'Momentum Based',
    icon: '🎯',
    description: 'Weights based on recent performance metrics',
    implemented: false
  },
  {
    id: 'valueFocused',
    name: 'Value Focused',
    icon: '💎',
    description: 'Allocation based on fundamental value metrics',
    implemented: false
  }
]

export default function StrategySelection({ selectedStrategies, onSelectionChange }: StrategySelectionProps) {
  const handleStrategyToggle = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId)
    if (!strategy?.implemented) return

    if (selectedStrategies.includes(strategyId)) {
      onSelectionChange(selectedStrategies.filter(id => id !== strategyId))
    } else {
      onSelectionChange([...selectedStrategies, strategyId])
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">📊</span>
        <h2 className="text-2xl font-semibold text-primary-900">
          Investment Strategies
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {strategies.map((strategy) => {
          const isSelected = selectedStrategies.includes(strategy.id)
          const isImplemented = strategy.implemented

          return (
            <div
              key={strategy.id}
              onClick={() => handleStrategyToggle(strategy.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
                ${isImplemented 
                  ? isSelected
                    ? 'border-primary-500 bg-primary-50 shadow-md'
                    : 'border-gray-200 hover:border-primary-300 hover:shadow-sm'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                }
              `}
            >
              {/* Strategy Icon and Title */}
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">{strategy.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 leading-tight">
                    {strategy.name}
                  </h3>
                  {!isImplemented && (
                    <span className="text-xs text-gray-500 font-medium">
                      Coming Soon
                    </span>
                  )}
                </div>
                {isImplemented && (
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center
                    ${isSelected 
                      ? 'bg-primary-500 border-primary-500' 
                      : 'border-gray-300'
                    }
                  `}>
                    {isSelected && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </div>
                )}
              </div>

              {/* Strategy Description */}
              <p className="text-sm text-gray-600 leading-relaxed">
                {strategy.description}
              </p>

              {/* Coming Soon Overlay */}
              {!isImplemented && (
                <div className="absolute inset-0 bg-white bg-opacity-70 rounded-lg flex items-center justify-center">
                  <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selection Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Selected Strategies</h4>
            <p className="text-sm text-gray-600">
              {selectedStrategies.length > 0 
                ? `${selectedStrategies.length} strategy${selectedStrategies.length !== 1 ? 'ies' : ''} selected for comparison`
                : 'No strategies selected'
              }
            </p>
          </div>
          {selectedStrategies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedStrategies.map(strategyId => {
                const strategy = strategies.find(s => s.id === strategyId)
                return strategy ? (
                  <span key={strategyId} className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm">
                    {strategy.icon} {strategy.name}
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          💡 <strong>Tip:</strong> Select multiple strategies to compare their performance side-by-side. 
          Each strategy will be backtested with the same stocks and time period for fair comparison.
        </p>
      </div>
    </div>
  )
}