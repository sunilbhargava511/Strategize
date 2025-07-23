// extract-tickers.js
// Extract and deduplicate tickers from CSV files

const fs = require('fs');

const files = [
  "/Users/sunilbhargava/Desktop/Desktop - Sunils MacBook 2022/Envest/Scored/First 100.csv",
  "/Users/sunilbhargava/Desktop/Desktop - Sunils MacBook 2022/Envest/Scored/Second 100.csv", 
  "/Users/sunilbhargava/Desktop/Desktop - Sunils MacBook 2022/Envest/Scored/S&P500ALL.csv"
];

const allTickers = new Set();

console.log('📊 Extracting tickers from CSV files...');

for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    console.log(`\n📄 Processing: ${file.split('/').pop()}`);
    
    for (const line of lines) {
      let ticker = line.trim();
      
      // Remove BOM character if present
      ticker = ticker.replace(/^\ufeff/, '');
      
      // Skip empty lines
      if (!ticker) continue;
      
      // Handle problem tickers
      if (ticker === 'BRK.B') {
        ticker = 'BRK-B.US';
        console.log(`   ➜ Converted BRK.B → BRK-B.US`);
      } else if (ticker === 'BF.B') {
        ticker = 'BF-B.US';
        console.log(`   ➜ Converted BF.B → BF-B.US`);
      }
      
      // Add to set (automatically deduplicates)
      if (ticker && ticker.length > 0) {
        const wasNew = !allTickers.has(ticker);
        allTickers.add(ticker);
        
        if (!wasNew) {
          console.log(`   🔄 Duplicate found: ${ticker}`);
        }
      }
    }
    
    console.log(`   ✅ Found ${lines.filter(l => l.trim()).length} tickers in file`);
    
  } catch (error) {
    console.error(`❌ Error reading ${file}:`, error.message);
  }
}

const tickerArray = Array.from(allTickers).sort();

console.log(`\n🎉 Final Results:`);
console.log(`   Total unique tickers: ${tickerArray.length}`);
console.log(`   Converted problem tickers: BRK.B → BRK-B.US, BF.B → BF-B.US`);

// Write to file for easy access
const outputFile = 'tickers-list.json';
fs.writeFileSync(outputFile, JSON.stringify({
  tickers: tickerArray,
  count: tickerArray.length,
  extractedAt: new Date().toISOString(),
  problemTickersConverted: {
    'BRK.B': 'BRK-B.US',
    'BF.B': 'BF-B.US'
  }
}, null, 2));

console.log(`\n💾 Saved to: ${outputFile}`);

// Show first 20 tickers as preview
console.log(`\n📋 First 20 tickers:`);
tickerArray.slice(0, 20).forEach((ticker, i) => {
  console.log(`   ${(i + 1).toString().padStart(2)}: ${ticker}`);
});

if (tickerArray.length > 20) {
  console.log(`   ... and ${tickerArray.length - 20} more`);
}