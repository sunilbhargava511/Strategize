#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Adding GitHub files to your project ===${NC}"
echo ""

# Check if we're in a directory with server.js (to confirm we're in the right place)
if [ ! -f "server.js" ]; then
    echo -e "${YELLOW}Warning: server.js not found in current directory.${NC}"
    echo "Are you in the right directory?"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 1
    fi
fi

# Create README.md
echo -e "${BLUE}Creating README.md...${NC}"
cat > README.md << 'EOF'
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
EOF

# Create package.json
echo -e "${BLUE}Creating package.json...${NC}"
cat > package.json << 'EOF'
{
  "name": "stock-backtesting-tool",
  "version": "1.0.0",
  "description": "A comprehensive backtesting application for comparing different investment strategies using S&P 500 historical data",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "backtesting",
    "stock-market",
    "investment",
    "sp500",
    "quantitative-finance",
    "trading-strategies"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.2",
    "csv-parser": "^3.0.0",
    "fs": "^0.0.1-security"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOF

# Create .gitignore
echo -e "${BLUE}Creating .gitignore...${NC}"
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/

# OS generated files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Temporary files
tmp/
temp/
EOF

# Create .env.example
echo -e "${BLUE}Creating .env.example...${NC}"
cat > .env.example << 'EOF'
PORT=3001
EOD_API_KEY=your_eod_api_key_here
EOF

# Create MIT License
echo -e "${BLUE}Creating LICENSE...${NC}"
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2024 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

echo ""
echo -e "${GREEN}✅ All GitHub files created!${NC}"
echo ""

# Ask if user wants to update with their info
echo -e "${YELLOW}Would you like to update the files with your information? (y/n)${NC}"
read -p "Answer: " UPDATE_INFO

if [ "$UPDATE_INFO" = "y" ]; then
    echo ""
    read -p "Enter your GitHub username: " GITHUB_USERNAME
    read -p "Enter your name (for package.json and LICENSE): " YOUR_NAME
    
    # Update files with user info
    if [ ! -z "$GITHUB_USERNAME" ]; then
        sed -i.bak "s/yourusername/$GITHUB_USERNAME/g" README.md && rm README.md.bak
    fi
    
    if [ ! -z "$YOUR_NAME" ]; then
        sed -i.bak "s/\[Your Name\]/$YOUR_NAME/g" LICENSE && rm LICENSE.bak
        # Update package.json author field
        sed -i.bak "s/\"author\": \"\"/\"author\": \"$YOUR_NAME\"/g" package.json && rm package.json.bak
    fi
    
    echo -e "${GREEN}✅ Files updated with your information!${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the created files"
echo "2. Install npm dependencies:"
echo -e "   ${YELLOW}npm install${NC}"
echo "3. Create .env file from template:"
echo -e "   ${YELLOW}cp .env.example .env${NC}"
echo "   Then add your API key to .env"
echo "4. Initialize git and push to GitHub:"
echo -e "   ${YELLOW}git init${NC}"
echo -e "   ${YELLOW}git add .${NC}"
echo -e "   ${YELLOW}git commit -m \"Initial commit\"${NC}"
echo -e "   ${YELLOW}git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git${NC}"
echo -e "   ${YELLOW}git push -u origin main${NC}"

echo ""
echo -e "${GREEN}Done! All files added to current directory.${NC}"
