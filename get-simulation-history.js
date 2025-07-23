// Quick script to get simulation history without using broken cache stats

async function getSimulationHistory() {
  try {
    const response = await fetch('https://portfolio-backtesting-app.vercel.app/api/cache-management');
    const data = await response.json();
    
    console.log('Total cached analyses:', data.analyses?.length || 0);
    console.log('Cache statistics:', data.cacheStatistics);
    
    if (data.analyses && data.analyses.length > 0) {
      console.log('\nCached Simulations:');
      data.analyses.forEach((analysis, index) => {
        console.log(`\n${index + 1}. ${analysis.tickers.join(', ')}`);
        console.log(`   Period: ${analysis.startYear}-${analysis.endYear}`);
        console.log(`   Investment: $${analysis.initialInvestment.toLocaleString()}`);
        console.log(`   Cached: ${new Date(analysis.cachedAt).toLocaleString()}`);
        console.log(`   Key: ${analysis.key}`);
      });
    } else {
      console.log('\nNo cached simulations found.');
      console.log('This could mean:');
      console.log('1. No backtests have been run yet');
      console.log('2. Cache stats are broken (showing 0 backtests)');
      console.log('3. Cache was recently cleared');
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching simulation history:', error);
  }
}

// Run it
getSimulationHistory();