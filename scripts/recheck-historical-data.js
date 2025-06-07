
// One-time script to recheck all historical weather data
// Run this with: node scripts/recheck-historical-data.js

import { recheckAllHistoricalData } from '../src/utils/recheckHistoricalData.js';

console.log('Starting historical data recheck script...');

recheckAllHistoricalData()
  .then((result) => {
    if (result.success) {
      console.log('✅ Historical data recheck completed successfully!');
      console.log(`📊 Summary: ${result.updated} updated, ${result.correct} already correct, ${result.total} total`);
    } else {
      console.log('❌ Historical data recheck failed:', result.error);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
