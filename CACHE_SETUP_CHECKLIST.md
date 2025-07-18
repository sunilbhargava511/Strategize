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
