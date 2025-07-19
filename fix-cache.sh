#!/bin/bash

# Fix cache module for Vercel deployment

echo "Fixing cache module for deployment..."

# Create cache directory if it doesn't exist
mkdir -p cache

# Create the cache module
cat > cache/upstashCache.js << 'EOF'
// cache/upstashCache.js
// Simple in-memory cache implementation as a fallback

class InMemoryCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }

  // Create a unique key from ticker and date
  createKey(ticker, date) {
    return `${ticker}:${date}`;
  }

  // Set a value in cache
  async set(ticker, date, data) {
    try {
      const key = this.createKey(ticker, date);
      this.cache.set(key, {
        ...data,
        cachedAt: new Date().toISOString()
      });
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Get a value from cache
  async get(ticker, date) {
    try {
      const key = this.createKey(ticker, date);
      const data = this.cache.get(key);
      
      if (data) {
        this.stats.hits++;
        return data;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Get from memory (same as get for in-memory cache)
  getFromMemory(ticker, date) {
    const key = this.createKey(ticker, date);
    return this.cache.get(key);
  }

  // Batch set operation
  async batchSet(items) {
    const results = [];
    for (const item of items) {
      const success = await this.set(item.ticker, item.date, item);
      results.push(success);
    }
    return results;
  }

  // Batch get operation
  async batchGet(requests) {
    const results = new Map();
    for (const req of requests) {
      const data = await this.get(req.ticker, req.date);
      if (data) {
        results.set(this.createKey(req.ticker, req.date), data);
      }
    }
    return results;
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      totalKeys: this.cache.size,
      memorySize: this.cache.size,
      hitRate: this.stats.hits > 0 ? 
        (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%' : '0%',
      status: 'in-memory',
      type: 'fallback'
    };
  }

  // Clear cache
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0
    };
  }
}

// Export singleton instance
const cacheInstance = new InMemoryCache();

module.exports = cacheInstance;
EOF

echo "✓ Created cache/upstashCache.js"

# Create simple test endpoint
cat > api/test.js << 'EOF'
// api/test.js - Simple test endpoint
module.exports = async (req, res) => {
  res.json({
    status: 'ok',
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
};
EOF

echo "✓ Created api/test.js"

# Update vercel.json to include cache directory
cat > vercel.json << 'EOF'
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "includeFiles": "cache/**"
    },
    "api/cache/*.js": {
      "includeFiles": "cache/**"
    }
  }
}
EOF

echo "✓ Updated vercel.json"

echo ""
echo "Next steps:"
echo "1. Add and commit changes:"
echo "   git add -A"
echo "   git commit -m 'Add cache module for deployment'"
echo "   git push"
echo ""
echo "2. The deployment should now work with these endpoints:"
echo "   - /api/test (simple test)"
echo "   - /api/health"
echo "   - /api/backtest"
echo "   - /api/market-cap"
echo "   - /api/cache/stats"