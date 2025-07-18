#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Migrating Express.js to Vercel Serverless Functions ===${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ] && [ ! -f "package.json" ]; then
    echo -e "${RED}Error: No server.js or package.json found.${NC}"
    echo "Are you in the right directory?"
    exit 1
fi

# Backup important files
echo -e "${BLUE}Creating backup...${NC}"
mkdir -p backup_$(date +%Y%m%d_%H%M%S)
cp -r src backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp server.js backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
cp package.json backup_$(date +%Y%m%d_%H%M%S)/
echo -e "${GREEN}✓ Backup created${NC}"

# Create new directory structure
echo -e "${BLUE}Creating Vercel structure...${NC}"
mkdir -p api
mkdir -p api/cache
mkdir -p public

# Create API endpoints
echo -e "${BLUE}Creating serverless functions...${NC}"

# Create api/backtest.js
cat > api/backtest.js << 'EOF'
// api/backtest.js
const { runEqualWeightBuyHold } = require('../src/lib/strategies/equalWeightBuyHold');
const { runMarketCapBuyHold } = require('../src/lib/strategies/marketCapBuyHold');
const { runEqualWeightRebalanced } = require('../src/lib/strategies/equalWeightRebalanced');
const { runMarketCapRebalanced } = require('../src/lib/strategies/marketCapRebalanced');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      startYear = 2010, 
      endYear = 2024, 
      initialInvestment = 1000000 
    } = req.body;

    console.log('Starting backtest:', { startYear, endYear, initialInvestment });

    // Run all strategies
    const [equalWeightBH, marketCapBH, equalWeightReb, marketCapReb] = await Promise.all([
      runEqualWeightBuyHold(startYear, endYear, initialInvestment),
      runMarketCapBuyHold(startYear, endYear, initialInvestment),
      runEqualWeightRebalanced(startYear, endYear, initialInvestment),
      runMarketCapRebalanced(startYear, endYear, initialInvestment)
    ]);

    const results = {
      equalWeightBuyHold: equalWeightBH,
      marketCapBuyHold: marketCapBH,
      equalWeightRebalanced: equalWeightReb,
      marketCapRebalanced: marketCapReb,
      parameters: { startYear, endYear, initialInvestment }
    };

    res.status(200).json(results);
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ 
      error: 'Backtest failed', 
      message: error.message 
    });
  }
};
EOF

# Create api/market-cap.js
cat > api/market-cap.js << 'EOF'
// api/market-cap.js
const axios = require('axios');
const cache = require('../cache/upstashCache');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticker, date } = req.query;
  
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker parameter is required' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    // Check cache first
    const cached = await cache.get(ticker, targetDate);
    if (cached) {
      return res.json({
        ticker,
        date: targetDate,
        price: cached.price,
        shares_outstanding: cached.sharesOutstanding,
        market_cap: cached.marketCap,
        market_cap_billions: (cached.marketCap / 1_000_000_000).toFixed(2),
        formatted_market_cap: `$${cached.marketCap.toLocaleString()}`,
        source: 'cache'
      });
    }

    // Fetch from EOD API
    const apiKey = process.env.EOD_API_KEY;
    const url = `https://eodhistoricaldata.com/api/eod/${ticker}.US`;
    
    const response = await axios.get(url, {
      params: {
        api_token: apiKey,
        from: targetDate,
        to: targetDate,
        fmt: 'json'
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.status(404).json({ 
        error: `No price data found for ${ticker} on ${targetDate}` 
      });
    }

    const priceData = response.data[0];
    const adjustedPrice = priceData.adjusted_close || priceData.close;

    // Get fundamentals
    const fundamentalsUrl = `https://eodhistoricaldata.com/api/fundamentals/${ticker}.US`;
    const fundResponse = await axios.get(fundamentalsUrl, {
      params: { api_token: apiKey }
    });

    const sharesOutstanding = fundResponse.data?.SharesStats?.SharesOutstanding || 
                            fundResponse.data?.outstandingShares?.raw || 
                            0;
    
    const marketCap = adjustedPrice * sharesOutstanding;

    // Cache the result
    await cache.set(ticker, targetDate, {
      price: adjustedPrice,
      sharesOutstanding,
      marketCap
    });

    res.json({
      ticker,
      date: targetDate,
      price: adjustedPrice,
      shares_outstanding: sharesOutstanding,
      market_cap: marketCap,
      market_cap_billions: (marketCap / 1_000_000_000).toFixed(2),
      formatted_market_cap: `$${marketCap.toLocaleString()}`,
      source: 'api'
    });

  } catch (error) {
    console.error('Error fetching market cap:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch market cap data',
      message: error.message 
    });
  }
};
EOF

# Create api/health.js
cat > api/health.js << 'EOF'
// api/health.js
const cache = require('../cache/upstashCache');

module.exports = async (req, res) => {
  const stats = cache.getStats();
  
  res.json({ 
    status: 'ok',
    cache: stats,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    endpoints: [
      '/api/health',
      '/api/backtest',
      '/api/market-cap',
      '/api/cache/stats'
    ]
  });
};
EOF

# Create api/cache/stats.js
cat > api/cache/stats.js << 'EOF'
// api/cache/stats.js
const cache = require('../../cache/upstashCache');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const stats = cache.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      message: error.message 
    });
  }
};
EOF

echo -e "${GREEN}✓ API endpoints created${NC}"

# Create or update vercel.json
echo -e "${BLUE}Creating vercel.json...${NC}"
cat > vercel.json << 'EOF'
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "maxDuration": 60
    },
    "api/cache/*.js": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/public/$1"
    }
  ]
}
EOF

# Check if there are static files in current directory and move them
echo -e "${BLUE}Moving static files to public directory...${NC}"

# Move HTML files
if ls *.html 1> /dev/null 2>&1; then
    mv *.html public/
    echo -e "${GREEN}✓ Moved HTML files${NC}"
fi

# Move CSS files
if ls *.css 1> /dev/null 2>&1; then
    mv *.css public/
    echo -e "${GREEN}✓ Moved CSS files${NC}"
fi

# Move client-side JS files (but not server.js)
for file in *.js; do
    if [[ "$file" != "server.js" ]] && [[ "$file" != "migrate-to-vercel.sh" ]]; then
        if [[ -f "$file" ]]; then
            mv "$file" public/
            echo -e "${GREEN}✓ Moved $file${NC}"
        fi
    fi
done

# If there's a public folder in the Express app, move its contents
if [ -d "public" ] && [ "$(ls -A public)" ]; then
    echo -e "${YELLOW}Note: public directory already exists with content${NC}"
fi

# Create a simple index.html if none exists
if [ ! -f "public/index.html" ]; then
    echo -e "${BLUE}Creating default index.html...${NC}"
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Backtesting Tool</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        button { padding: 10px 20px; margin: 10px 0; cursor: pointer; }
        .result { margin-top: 20px; padding: 10px; background: #f0f0f0; border-radius: 5px; }
        .error { color: red; }
        .success { color: green; }
    </style>
</head>
<body>
    <h1>Stock Backtesting Tool</h1>
    
    <div>
        <h2>API Health Check</h2>
        <button onclick="checkHealth()">Check API Status</button>
        <div id="health-result"></div>
    </div>
    
    <div>
        <h2>Run Backtest</h2>
        <button onclick="runBacktest()">Run Backtest (2010-2024)</button>
        <div id="backtest-result"></div>
    </div>

    <script>
        async function checkHealth() {
            const resultDiv = document.getElementById('health-result');
            resultDiv.innerHTML = 'Checking...';
            
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                resultDiv.innerHTML = `<div class="success">API Status: ${data.status}<br>Environment: ${data.environment}</div>`;
            } catch (error) {
                resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        }

        async function runBacktest() {
            const resultDiv = document.getElementById('backtest-result');
            resultDiv.innerHTML = 'Running backtest... This may take a minute...';
            
            try {
                const response = await fetch('/api/backtest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startYear: 2010,
                        endYear: 2024,
                        initialInvestment: 1000000
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = '<div class="success">Backtest completed! Check console for results.</div>';
                    console.log('Backtest Results:', data);
                } else {
                    resultDiv.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                }
            } catch (error) {
                resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        }
    </script>
</body>
</html>
EOF
    echo -e "${GREEN}✓ Created default index.html${NC}"
fi

# Update .gitignore
echo -e "${BLUE}Updating .gitignore...${NC}"
if ! grep -q "^# Vercel" .gitignore 2>/dev/null; then
    echo -e "\n# Vercel\n.vercel/\n.env*.local" >> .gitignore
fi

# Clean up Next.js files if they exist
echo -e "${BLUE}Cleaning up Next.js files...${NC}"
if [ -d "src/app" ] || [ -d "src/components" ]; then
    echo -e "${YELLOW}Found Next.js directories. Removing...${NC}"
    rm -rf src/app 2>/dev/null || true
    rm -rf src/components 2>/dev/null || true
    rm -rf src/types 2>/dev/null || true
    rm -f tsconfig.json 2>/dev/null || true
    rm -f next.config.js 2>/dev/null || true
    rm -f next-env.d.ts 2>/dev/null || true
    echo -e "${GREEN}✓ Cleaned up Next.js files${NC}"
fi

# Offer to remove server.js
echo ""
echo -e "${YELLOW}The old server.js file is no longer needed for Vercel deployment.${NC}"
read -p "Would you like to remove server.js? (y/n): " REMOVE_SERVER

if [ "$REMOVE_SERVER" = "y" ]; then
    rm server.js
    echo -e "${GREEN}✓ Removed server.js${NC}"
else
    echo -e "${BLUE}Kept server.js (you can remove it later)${NC}"
fi

# Final instructions
echo ""
echo -e "${GREEN}=== Migration Complete! ===${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the created files in the /api directory"
echo "2. Test locally with: ${YELLOW}vercel dev${NC}"
echo "3. Deploy to Vercel: ${YELLOW}vercel --prod${NC}"
echo ""
echo -e "${BLUE}Your API endpoints are now:${NC}"
echo "  • GET  /api/health"
echo "  • POST /api/backtest"
echo "  • GET  /api/market-cap?ticker=AAPL&date=2024-01-15"
echo "  • GET  /api/cache/stats"
echo ""
echo -e "${BLUE}Important notes:${NC}"
echo "  • Your strategies in src/lib/strategies/ are preserved"
echo "  • Your cache implementation is preserved"
echo "  • Environment variables remain the same"
echo "  • API URLs remain the same (no frontend changes needed)"
echo ""
echo -e "${GREEN}✨ Your app is now ready for Vercel serverless deployment!${NC}"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Note: Vercel CLI not found. Install it with:${NC}"
    echo "  npm i -g vercel"
fi
