
// One-time script to recheck all historical weather data
// Run this with: node scripts/recheck-historical-data.js

import { recheckAllHistoricalData } from '../src/utils/recheckHistoricalData.js';
import { checkSunshineUpdate } from '../src/utils/sunshineUpdateCheck.js';

console.log('Starting sunshine requirement update analysis...');

// First check the impact
checkSunshineUpdate()
  .then((result) => {
    if (result.success) {
      console.log('📊 Sunshine Requirement Update Analysis:');
      console.log(`   Old good days (90% sunshine): ${result.oldGoodDays}`);
      console.log(`   New good days (70% sunshine): ${result.newGoodDays}`);
      console.log(`   ✅ NEW GOOD DAYS ADDED: ${result.addedGoodDays}`);
      
      if (result.newGoodDaysList.length > 0) {
        console.log('\nExample new good days:');
        result.newGoodDaysList.forEach(day => {
          console.log(`   ${day.date}: ${day.temperature}°C, ${day.windSpeed}km/h wind, ${day.sunniness}% sun, ${day.rain}mm rain`);
        });
      }
      
      console.log('\nNow updating historical data...');
      return recheckAllHistoricalData();
    } else {
      console.log('❌ Analysis failed:', result.error);
      process.exit(1);
    }
  })
  .then((result) => {
    if (result.success) {
      console.log('✅ Historical data update completed successfully!');
      console.log(`📊 Update Summary: ${result.updated} updated, ${result.correct} already correct, ${result.total} total`);
      console.log(`📈 Changed from bad to good: ${result.changedFromBadToGood}`);
      console.log(`📉 Changed from good to bad: ${result.changedFromGoodToBad}`);
    } else {
      console.log('❌ Historical data update failed:', result.error);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
