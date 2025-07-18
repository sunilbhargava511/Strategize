# Stock Market Backtesting Tool

A comprehensive backtesting application that compares different investment strategies using historical S&P 500 data.

## Features

- **Multiple Strategy Support**:
  - Equal Weight Buy & Hold
  - Market Cap Weighted Buy & Hold
  - Equal Weight Rebalanced Annually
  - Market Cap Weighted Rebalanced Annually
  - SPY Benchmark comparison

- **Real-time Market Data**: Fetches current and historical data via EOD Historical Data API
- **Interactive Dashboard**: Real-time strategy comparison and visualization
- **Performance Metrics**: Total return, annualized return, and detailed year-by-year analysis
- **Caching System**: Built-in cache to reduce API calls and improve performance
- **Comprehensive Testing**: Includes test scripts to verify strategy implementations

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **Data Source**: EOD Historical Data API
- **Charts**: Chart.js

## Prerequisites

- Node.js (v14 or higher)
- NPM or Yarn
- EOD Historical Data API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/stock-backtesting-tool.git
cd stock-backtesting-tool
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=3001
EOD_API_KEY=your_api_key_here
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3001
```

3. Click "Run Backtest" to execute all strategies

## Testing

### Verify Strategy Implementations
```bash
# Test the Equal Weight Buy & Hold bug fix
npm run test-bug-fix

# Check cache statistics
npm run cache-stats

# Verify cache setup
npm run verify-cache
```

## Performance Results (2010-2024)*

| Strategy | Total Return | Annual Return |
|----------|--------------|---------------|
| Equal Weight Rebalanced | 4,998.60% | 32.45% |
| Market Cap Weighted Rebalanced | 1,676.94% | 22.84% |
| Market Cap Weighted Buy & Hold | 1,658.07% | 22.74% |
| Equal Weight Buy & Hold | 1,245.32% | 20.15% |
| SPY Benchmark | 441.03% | 12.83% |

*Note: Results are based on historical S&P 500 data and include dividends. Past performance does not guarantee future results.

## Strategy Descriptions

### Equal Weight Buy & Hold
- Initially invests equal amounts in all available stocks
- When new stocks join the index, allocates equal weight to them
- Reduces existing holdings proportionally to make room for new stocks
- No periodic rebalancing - positions grow/shrink with market movements

### Market Cap Weighted Buy & Hold
- Initially invests proportional to market capitalization
- New stocks are added with market cap weighting
- No periodic rebalancing

### Equal Weight Rebalanced
- Rebalances to equal weights across all stocks annually
- Provides consistent diversification

### Market Cap Weighted Rebalanced
- Rebalances to market cap weights annually
- Tracks index methodology more closely

## Recent Updates

- ✅ Fixed Equal Weight Buy & Hold strategy bug that was incorrectly adding duplicate stocks
- ✅ Added comprehensive caching system to reduce API calls
- ✅ Added test scripts for strategy verification
- ✅ Improved error handling and progress tracking

## API Documentation

### Backtesting Endpoint
```
POST /api/backtest
Content-Type: application/json

{
  "startYear": 2010,
  "endYear": 2024,
  "initialInvestment": 1000000,
  "strategies": ["equalWeightBuyHold", "marketCapBuyHold"]
}
```

### Market Cap Endpoint
```
GET /api/market-cap?ticker=AAPL&date=2024-01-15
```

## Scripts

```bash
npm start              # Start the server
npm run dev           # Start with nodemon for development
npm run backtest      # Run command-line backtest
npm run warm-cache    # Pre-populate cache with historical data
npm run cache-stats   # Display cache statistics
npm run clear-cache   # Clear the cache
npm run verify-cache  # Verify cache system setup
npm run test-bug-fix  # Test Equal Weight Buy & Hold fix
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- EOD Historical Data for providing reliable market data
- Chart.js for visualization capabilities
- The open-source community for various dependencies

## Disclaimer

This tool is for educational and research purposes only. It should not be considered as financial advice. Always consult with a qualified financial advisor before making investment decisions.