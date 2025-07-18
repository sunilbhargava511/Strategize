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

## Known Issues

⚠️ **Equal Weight Buy & Hold Bug**: Currently adds 5 new stocks each year instead of holding initial positions. This inflates the performance metrics. Fix pending.

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
git clone https://github.com/sunilbhargava511/stock-backtesting-tool.git
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

## Performance Results (2010-2024)

| Strategy | Total Return | Annual Return |
|----------|--------------|---------------|
| Equal Weight Rebalanced | 4,998.60% | 32.45% |
| Equal Weight Buy & Hold* | 3,841.85% | 30.03% |
| Market Cap Weighted Rebalanced | 1,676.94% | 22.84% |
| Market Cap Weighted Buy & Hold | 1,658.07% | 22.74% |
| SPY Benchmark | 441.03% | 12.83% |

*Note: Equal Weight Buy & Hold results are inflated due to the known bug

## License

This project is licensed under the MIT License - see the LICENSE file for details.
