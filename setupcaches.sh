#!/bin/bash

# setup-cache-system.sh
# Script to set up the cache system for the portfolio backtesting app

echo "🚀 Setting up Cache System for Portfolio Backtesting App"
echo "======================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Create directories
echo "📁 Creating directory structure..."
mkdir -p src/lib/cache
mkdir -p src/scripts
mkdir -p src/app/api/cache/export
mkdir -p src/app/api/cache/import
mkdir -p cache
mkdir -p temp

# Create .gitignore entries
echo "📝 Updating .gitignore..."
if ! grep -q "# Cache directory" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Cache directory" >> .gitignore
    echo "cache/" >> .gitignore
    echo "temp/" >> .gitignore
    echo "" >> .gitignore
    echo "# Exported cache files" >> .gitignore
    echo "*.csv" >> .gitignore
    echo "*.xlsx" >> .gitignore
    echo "cache_export_*" >> .gitignore
fi

# Create placeholder files with instructions
echo "📄 Creating placeholder files..."

# Create historicalDataCache.ts placeholder
cat > src/lib/cache/historicalDataCache.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Historical Data Cache Manager"
// This file should contain the HistoricalDataCache class implementation

throw new Error('Please replace this file content with the Historical Data Cache Manager artifact');
EOF

# Create enhancedCacheManager.ts placeholder
cat > src/lib/cache/enhancedCacheManager.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Enhanced Cache Manager with Export/Import"
// This file should contain the EnhancedCacheManager class implementation

throw new Error('Please replace this file content with the Enhanced Cache Manager artifact');
EOF

# Create cache API route placeholders
cat > src/app/api/cache/export/route.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the first part of artifact: "Cache Export/Import API Routes"
// This file should contain the export API route

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Please replace this file with the cache export route from the artifact' }, { status: 501 });
}
EOF

cat > src/app/api/cache/import/route.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the second part of artifact: "Cache Export/Import API Routes"
// This file should contain the import API route

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Please replace this file with the cache import route from the artifact' }, { status: 501 });
}
EOF

# Create script placeholders
cat > src/scripts/warmCache.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Cache Warming Script"
// This script pre-populates the cache with historical data

console.error('Please replace this file content with the Cache Warming Script artifact');
process.exit(1);
EOF

cat > src/scripts/cacheStats.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Cache Statistics Script"
// This script displays cache statistics

console.error('Please replace this file content with the Cache Statistics Script artifact');
process.exit(1);
EOF

cat > src/scripts/verifyCacheSetup.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Cache System Verification Script"
// This script verifies the cache system setup

console.error('Please replace this file content with the Cache System Verification Script artifact');
process.exit(1);
EOF

cat > src/scripts/testEqualWeightBugFix.ts << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Equal Weight Buy Hold Bug Fix Test"
// This script tests the bug fix in the Equal Weight Buy & Hold strategy

console.error('Please replace this file content with the Equal Weight Buy Hold Bug Fix Test artifact');
process.exit(1);
EOF

# Create CacheControl component placeholder
cat > src/components/backtesting/CacheControl.tsx << 'EOF'
// PLACEHOLDER FILE - Replace this content with the artifact: "Cache Control Component"
// This component provides UI controls for the cache system

import React from 'react';

const CacheControl: React.FC<any> = () => {
  return <div>Please replace this file content with the Cache Control Component artifact</div>;
};

export default CacheControl;
EOF

# Create a checklist file
cat > CACHE_SETUP_CHECKLIST.md << 'EOF'
# Cache System Setup Checklist

## ✅ Automated Steps (Completed by Script)

- [x] Created directory structure
- [x] Updated .gitignore
- [x] Created placeholder files

## 📋 Manual Steps Required

### 1. Replace Placeholder Files with Artifact Content

Replace the content of these files with their corresponding artifacts:

- [ ] `src/lib/cache/historicalDataCache.ts` → "Historical Data Cache Manager"
- [ ] `src/lib/cache/enhancedCacheManager.ts` → "Enhanced Cache Manager with Export/Import"
- [ ] `src/app/api/cache/export/route.ts` → "Cache Export/Import API Routes" (first part)
- [ ] `src/app/api/cache/import/route.ts` → "Cache Export/Import API Routes" (second part)
- [ ] `src/scripts/warmCache.ts` → "Cache Warming Script"
- [ ] `src/scripts/cacheStats.ts` → "Cache Statistics Script"
- [ ] `src/scripts/verifyCacheSetup.ts` → "Cache System Verification Script"
- [ ] `src/scripts/testEqualWeightBugFix.ts` → "Equal Weight Buy Hold Bug Fix Test"
- [ ] `src/components/backtesting/CacheControl.tsx` → "Cache Control Component"

### 2. Replace Entire Files

- [ ] Replace entire content of `src/app/api/backtesting/route.ts` with "Updated Backtesting Route with Cache"
- [ ] Replace entire content of `src/lib/strategies/equalWeightBuyHold.ts` with "Fixed Equal Weight Buy & Hold Strategy"

### 3. Update Existing Files

#### `src/components/backtesting/BacktestForm.tsx`
- [ ] Add import: `import CacheControl from './CacheControl';`
- [ ] Add state: `const [useCache, setUseCache] = useState(true);`
- [ ] Add component after strategy selection: `<CacheControl onCacheToggle={setUseCache} className="mb-6" />`
- [ ] Add `useCache: useCache` to the `fullConfig` object

#### `package.json`
- [ ] Update scripts section to include:
  ```json
  "warm-cache": "ts-node src/scripts/warmCache.ts",
  "cache-stats": "ts-node src/scripts/cacheStats.ts",
  "clear-cache": "rm -rf ./cache && echo 'Cache cleared'",
  "verify-cache": "ts-node src/scripts/verifyCacheSetup.ts",
  "test-bug-fix": "ts-node src/scripts/testEqualWeightBugFix.ts",
  ```

#### `.env.local`
- [ ] Ensure this line exists: `EODHD_API_TOKEN=your_actual_api_token_here`

### 4. Final Steps

- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run verify-cache` to verify setup
- [ ] Run `npm run test-bug-fix` to test the bug fix
- [ ] (Optional) Run `npm run warm-cache` to pre-populate cache

## 🎉 Setup Complete!

Once all steps are checked, your cache system will be fully operational.
EOF

# Create a file list for reference
cat > CREATED_FILES.txt << 'EOF'
Files created by setup script:
==============================

Directories:
- src/lib/cache/
- src/scripts/
- src/app/api/cache/export/
- src/app/api/cache/import/
- cache/
- temp/

Placeholder Files (need artifact content):
- src/lib/cache/historicalDataCache.ts
- src/lib/cache/enhancedCacheManager.ts
- src/app/api/cache/export/route.ts
- src/app/api/cache/import/route.ts
- src/scripts/warmCache.ts
- src/scripts/cacheStats.ts
- src/scripts/verifyCacheSetup.ts
- src/scripts/testEqualWeightBugFix.ts
- src/components/backtesting/CacheControl.tsx

Reference Files:
- CACHE_SETUP_CHECKLIST.md
- CREATED_FILES.txt

Updated Files:
- .gitignore (added cache entries)
EOF

echo ""
echo "✅ Setup script completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Review CACHE_SETUP_CHECKLIST.md for manual steps"
echo "2. Replace placeholder files with artifact content"
echo "3. Update existing files as specified in the checklist"
echo "4. Run 'npm run verify-cache' after completing manual steps"
echo ""
echo "📁 Created files are listed in CREATED_FILES.txt"
echo ""
echo "⚠️  IMPORTANT: All placeholder files contain error messages and will"
echo "   fail if run without replacing their content with the artifacts!"
echo ""
echo "Good luck with your cache system setup! 🚀"