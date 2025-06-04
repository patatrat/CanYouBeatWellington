
// One-time script to populate historical weather data
// Run this with: node scripts/populate-historical-data.js

import { populateHistoricalWeatherData } from '../src/utils/populateHistoricalData.js';

console.log('Starting historical data population script...');

populateHistoricalWeatherData()
  .then((result) => {
    if (result.success) {
      console.log('✅ Historical data population completed successfully!');
      console.log(`📊 Summary: ${result.inserted} inserted, ${result.updated} updated, ${result.total} total`);
    } else {
      console.log('❌ Historical data population failed:', result.error);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
