#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Portfolio Backtesting App Setup...\n');

let allGood = true;
let warnings = [];
let errors = [];

// Check required directories
const requiredDirs = [
  'src/components/backtesting',
  'src/lib/strategies',
  'src/lib/utils',
  'src/app/api/backtesting',
  'src/app/api/spy-data',
  'src/app/api/excel-export',
  'src/types',
  'data',
  'output',
  'scripts'
];

console.log('📁 Checking directories...');
requiredDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${dir}`);
  } else {
    console.log(`  ❌ ${dir}`);
    errors.push(`Missing directory: ${dir}`);
    allGood = false;
  }
});

// Check required files
const requiredFiles = [
  'package.json',
  '.env.local',
  'src/types/backtesting.ts',
  'data/start-of-year-dates.csv',
  'data/sp500-tickers.csv'
];

console.log('\n📄 Checking essential files...');
requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    errors.push(`Missing file: ${file}`);
    allGood = false;
  }
});

// Check implementation files (these should have real content, not just TODO comments)
const implementationFiles = [
  'src/lib/utils/dateUtils.ts',
  'src/lib/utils/portfolioUtils.ts',
  'src/lib/utils/excelExport.ts',
  'src/lib/strategies/equalWeightBuyHold.ts',
  'src/lib/strategies/marketCapBuyHold.ts',
  'src/lib/strategies/equalWeightRebalanced.ts',
  'src/lib/strategies/marketCapRebalanced.ts',
  'src/lib/strategies/strategyRunner.ts',
  'src/components/backtesting/BacktestForm.tsx',
  'src/components/backtesting/ResultsDisplay.tsx',
  'src/components/backtesting/StrategyComparison.tsx',
  'src/app/api/backtesting/route.ts',
  'src/app/api/spy-data/route.ts',
  'src/app/api/excel-export/route.ts',
  'src/app/backtesting/page.tsx'
];

console.log('\n🔧 Checking implementation files...');
implementationFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('TODO: Add content from artifacts') || content.length < 100) {
      console.log(`  ⚠️  ${file} (needs implementation)`);
      warnings.push(`File needs implementation: ${file}`);
    } else {
      console.log(`  ✅ ${file}`);
    }
  } else {
    console.log(`  ❌ ${file}`);
    errors.push(`Missing file: ${file}`);
    allGood = false;
  }
});

// Check package.json dependencies
console.log('\n📦 Checking dependencies...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = ['xlsx', 'lodash', 'date-fns', '@types/lodash'];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep}`);
    } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      console.log(`  ✅ ${dep} (dev)`);
    } else {
      console.log(`  ❌ ${dep}`);
      warnings.push(`Missing dependency: ${dep}`);
    }
  });
}

// Check environment variables
console.log('\n🔐 Checking environment configuration...');
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('EODHD_API_TOKEN=your_eodhd_api_token_here')) {
    console.log('  ⚠️  EODHD_API_TOKEN needs to be set');
    warnings.push('Update EODHD_API_TOKEN in .env.local');
  } else if (envContent.includes('EODHD_API_TOKEN=')) {
    console.log('  ✅ EODHD_API_TOKEN configured');
  } else {
    console.log('  ❌ EODHD_API_TOKEN missing');
    errors.push('EODHD_API_TOKEN not found in .env.local');
  }
} else {
  console.log('  ❌ .env.local missing');
  errors.push('.env.local file not found');
  allGood = false;
}

// Check data files content
console.log('\n📊 Checking data files...');
const dataChecks = [
  { file: 'data/start-of-year-dates.csv', shouldContain: 'FirstTuesday,1/2/96' },
  { file: 'data/sp500-tickers.csv', shouldContain: 'ticker,start_date,end_date' }
];

dataChecks.forEach(check => {
  const filePath = path.join(process.cwd(), check.file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(check.shouldContain)) {
      console.log(`  ✅ ${check.file} (valid format)`);
    } else {
      console.log(`  ⚠️  ${check.file} (unexpected format)`);
      warnings.push(`${check.file} may have wrong format`);
    }
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📋 SETUP SUMMARY');
console.log('='.repeat(50));

if (allGood && warnings.length === 0) {
  console.log('🎉 Perfect! Everything is set up correctly.');
  console.log('🚀 Ready to run: npm run dev');
} else if (allGood && warnings.length > 0) {
  console.log('✅ Basic setup complete, but some items need attention:');
  warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
  console.log('\n🚀 You can still run: npm run dev');
} else {
  console.log('❌ Setup incomplete. Please fix the following errors:');
  errors.forEach(error => console.log(`  ❌ ${error}`));
  console.log('\n🔧 Run the setup script again after fixing errors.');
}

if (warnings.length > 0) {
  console.log('\n📝 To fix warnings:');
  console.log('1. Run: npm install (for missing dependencies)');
  console.log('2. Update .env.local with your EODHD API token');
  console.log('3. Copy content from artifacts to implementation files');
}

console.log('\n🔗 Next steps:');
console.log('• Visit: http://localhost:3000/backtesting');
console.log('• Check existing market cap fetcher: http://localhost:3000');
console.log('• Run backtests and generate Excel reports');

process.exit(allGood ? 0 : 1);