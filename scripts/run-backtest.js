#!/usr/bin/env node

/**
 * Portfolio Backtesting Command Line Tool
 * 
 * Usage:
 *   npm run backtest
 *   node scripts/run-backtest.js --start=2010 --end=2024 --amount=1000000
 *   node scripts/run-backtest.js --config=config.json
 */

const fs = require('fs');
const path = require('path');

// Color output for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader() {
  console.log('\n' + '='.repeat(60));
  colorLog('cyan', '🚀 PORTFOLIO BACKTESTING COMMAND LINE TOOL');
  console.log('='.repeat(60));
}

function printUsage() {
  console.log('\nUsage:');
  console.log('  npm run backtest');
  console.log('  node scripts/run-backtest.js [options]');
  console.log('\nOptions:');
  console.log('  --start=YEAR       Start year (default: 2010)');
  console.log('  --end=YEAR         End year (default: 2024)');
  console.log('  --amount=AMOUNT    Initial investment (default: 1000000)');
  console.log('  --strategies=LIST  Comma-separated strategy list');
  console.log('  --config=FILE      JSON configuration file');
  console.log('  --output=DIR       Output directory (default: ./output)');
  console.log('  --help, -h         Show this help message');
  console.log('\nStrategies:');
  console.log('  equalWeightBuyHold       Equal weight buy & hold');
  console.log('  marketCapBuyHold         Market cap weighted buy & hold');
  console.log('  equalWeightRebalanced    Equal weight rebalanced annually');
  console.log('  marketCapRebalanced      Market cap weighted rebalanced annually');
  console.log('\nExamples:');
  console.log('  npm run backtest');
  console.log('  node scripts/run-backtest.js --start=2015 --end=2023');
  console.log('  node scripts/run-backtest.js --amount=500000 --strategies=equalWeightBuyHold,marketCapBuyHold');
  console.log('  node scripts/run-backtest.js --config=my-config.json');
}

function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    startYear: 2010,
    endYear: 2024,
    initialInvestment: 1000000,
    strategies: ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced'],
    outputDir: './output',
    configFile: null
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('--start=')) {
      config.startYear = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--end=')) {
      config.endYear = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--amount=')) {
      config.initialInvestment = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--strategies=')) {
      config.strategies = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--output=')) {
      config.outputDir = arg.split('=')[1];
    } else if (arg.startsWith('--config=')) {
      config.configFile = arg.split('=')[1];
    }
  }

  return config;
}

function loadConfigFile(filename) {
  try {
    const configPath = path.resolve(filename);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    colorLog('red', `❌ Error loading configuration file: ${error.message}`);
    process.exit(1);
  }
}

function validateConfig(config) {
  const errors = [];

  if (config.startYear < 1996 || config.startYear > 2025) {
    errors.push('Start year must be between 1996 and 2025');
  }

  if (config.endYear < 1996 || config.endYear > 2025) {
    errors.push('End year must be between 1996 and 2025');
  }

  if (config.startYear >= config.endYear) {
    errors.push('Start year must be before end year');
  }

  if (config.initialInvestment <= 0) {
    errors.push('Initial investment must be positive');
  }

  const validStrategies = ['equalWeightBuyHold', 'marketCapBuyHold', 'equalWeightRebalanced', 'marketCapRebalanced'];
  const invalidStrategies = config.strategies.filter(s => !validStrategies.includes(s));
  if (invalidStrategies.length > 0) {
    errors.push(`Invalid strategies: ${invalidStrategies.join(', ')}`);
  }

  if (errors.length > 0) {
    colorLog('red', '❌ Configuration errors:');
    errors.forEach(error => console.log(`  • ${error}`));
    process.exit(1);
  }
}

function loadStockData() {
  try {
    const csvPath = path.join(process.cwd(), 'data', 'sp500-tickers.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error('S&P 500 data file not found. Please run the setup script first.');
    }

    // Simple CSV parsing for Node.js environment
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    const stocks = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        ticker: values[0],
        startDate: values[1],
        endDate: values[2] || null
      };
    });

    return stocks;
  } catch (error) {
    colorLog('red', `❌ Error loading stock data: ${error.message}`);
    process.exit(1);
  }
}

async function runBacktest(config) {
  try {
    colorLog('blue', '📊 Initializing backtest...');
    console.log(`📅 Period: ${config.startYear} - ${config.endYear}`);
    console.log(`💰 Initial Investment: $${config.initialInvestment.toLocaleString()}`);
    console.log(`🎯 Strategies: ${config.strategies.join(', ')}`);

    // Load stock data
    colorLog('yellow', '📈 Loading S&P 500 historical data...');
    const stocks = loadStockData();
    console.log(`✅ Loaded ${stocks.length} stocks`);

    // Check if API server is running
    const serverUrl = 'http://localhost:3000';
    
    try {
      const response = await fetch(`${serverUrl}/api/market-cap?ticker=AAPL&date=2024-01-02`);
      if (!response.ok) {
        throw new Error('API not responding correctly');
      }
    } catch (error) {
      colorLog('red', '❌ Cannot connect to the development server');
      console.log('Please start the development server first:');
      console.log('  npm run dev');
      console.log('Then run this script again.');
      process.exit(1);
    }

    // Prepare backtest configuration
    const backtestConfig = {
      stocks,
      startYear: config.startYear,
      endYear: config.endYear,
      initialInvestment: config.initialInvestment,
      strategies: config.strategies
    };

    colorLog('blue', '🚀 Starting backtest execution...');
    
    // Call the API
    const response = await fetch(`${serverUrl}/api/backtesting/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backtestConfig)
    });

    if (!response.ok) {
      throw new Error(`Backtest API failed: ${response.status} ${response.statusText}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    let buffer = '';
    let results = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'progress') {
              const { current, total, step } = data.progress;
              const percent = total > 0 ? Math.round((current / total) * 100) : 0;
              console.log(`⏳ [${percent}%] ${step}`);
            } else if (data.type === 'results') {
              results = data.results;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (e) {
            // Ignore non-JSON lines
          }
        }
      }
    }

    if (!results) {
      throw new Error('No results received from backtest');
    }

    // Display results
    displayResults(results, config);

    // Save results to file
    await saveResults(results, config);

    colorLog('green', '✅ Backtest completed successfully!');

  } catch (error) {
    colorLog('red', `❌ Backtest failed: ${error.message}`);
    process.exit(1);
  }
}

function displayResults(results, config) {
  console.log('\n' + '='.repeat(60));
  colorLog('green', '📊 BACKTEST RESULTS');
  console.log('='.repeat(60));

  // Summary table
  console.log('\nStrategy Performance:');
  console.log('-'.repeat(80));
  console.log('Strategy'.padEnd(35) + 'Total Return'.padEnd(15) + 'Annual Return'.padEnd(15) + 'Final Value');
  console.log('-'.repeat(80));

  results.strategies.forEach(strategy => {
    const totalRet = `${(strategy.totalReturn * 100).toFixed(2)}%`;
    const annualRet = `${(strategy.annualizedReturn * 100).toFixed(2)}%`;
    const finalVal = `$${strategy.endValue.toLocaleString()}`;
    
    console.log(
      strategy.strategy.padEnd(35) + 
      totalRet.padEnd(15) + 
      annualRet.padEnd(15) + 
      finalVal
    );
  });

  // SPY Benchmark
  const spyTotalRet = `${(results.spyBenchmark.totalReturn * 100).toFixed(2)}%`;
  const spyAnnualRet = `${(results.spyBenchmark.annualizedReturn * 100).toFixed(2)}%`;
  const spyFinalVal = `$${results.spyBenchmark.endValue.toLocaleString()}`;
  
  console.log('-'.repeat(80));
  console.log(
    'SPY Benchmark'.padEnd(35) + 
    spyTotalRet.padEnd(15) + 
    spyAnnualRet.padEnd(15) + 
    spyFinalVal
  );

  console.log('\n📈 Key Insights:');
  console.log(`🏆 Best Strategy: ${results.summary.bestStrategy}`);
  console.log(`📉 Worst Strategy: ${results.summary.worstStrategy}`);
  console.log(`🎯 Strategies beating SPY: ${results.summary.spyOutperformers.length}/${results.strategies.length}`);
  if (results.summary.spyOutperformers.length > 0) {
    console.log(`   ${results.summary.spyOutperformers.join(', ')}`);
  }
  console.log(`⏱️  Execution Time: ${(results.summary.executionTime / 1000).toFixed(1)} seconds`);
}

async function saveResults(results, config) {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    // Save JSON results
    const timestamp = new Date().toISOString().split('T')[0];
    const jsonFilename = `backtest_${config.startYear}_${config.endYear}_${timestamp}.json`;
    const jsonPath = path.join(config.outputDir, jsonFilename);
    
    const outputData = {
      config,
      results,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(outputData, null, 2));
    colorLog('blue', `💾 Results saved to: ${jsonPath}`);

    // Generate Excel file via API
    try {
      console.log('📊 Generating Excel report...');
      
      const response = await fetch('http://localhost:3000/api/excel-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategies: results.strategies,
          spyData: results.spyBenchmark.data,
          startYear: config.startYear,
          endYear: config.endYear,
          initialInvestment: config.initialInvestment
        })
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const excelFilename = `backtest_${config.startYear}_${config.endYear}_${timestamp}.xlsx`;
        const excelPath = path.join(config.outputDir, excelFilename);
        
        fs.writeFileSync(excelPath, Buffer.from(buffer));
        colorLog('green', `📈 Excel report saved to: ${excelPath}`);
      } else {
        console.log('⚠️  Excel export failed, but JSON results are available');
      }
    } catch (error) {
      console.log('⚠️  Excel export failed, but JSON results are available');
    }

  } catch (error) {
    colorLog('yellow', `⚠️  Warning: Could not save results to file: ${error.message}`);
  }
}

// Main execution
async function main() {
  printHeader();
  
  try {
    let config = parseArguments();
    
    // Load config file if specified
    if (config.configFile) {
      const fileConfig = loadConfigFile(config.configFile);
      config = { ...config, ...fileConfig };
    }
    
    // Validate configuration
    validateConfig(config);
    
    // Run the backtest
    await runBacktest(config);
    
  } catch (error) {
    colorLog('red', `❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  colorLog('red', '❌ Unhandled Promise Rejection:');
  console.error(reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  colorLog('red', '❌ Uncaught Exception:');
  console.error(error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  runBacktest,
  parseArguments,
  validateConfig,
  loadStockData,
  displayResults,
  saveResults
};
