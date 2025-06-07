
import { supabase } from '../integrations/supabase/client';

const isGoodDay = (temperature, windSpeed, sunniness, rain) => {
  const minTemp = 18;
  const maxWind = 20;
  const minSunniness = 90;
  const maxRain = 0;
  
  return temperature >= minTemp && 
         windSpeed < maxWind && 
         sunniness >= minSunniness && 
         rain <= maxRain;
};

export const recheckAllHistoricalData = async () => {
  console.log('Starting historical data recheck...');
  
  try {
    // Fetch all historical records
    const { data: records, error: fetchError } = await supabase
      .from('daily_weather_records')
      .select('*')
      .order('date', { ascending: true });
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`Found ${records.length} records to recheck`);
    
    let updatedCount = 0;
    let correctCount = 0;
    let changedFromGoodToBad = 0;
    let changedFromBadToGood = 0;
    const changes = [];
    
    // Process records in batches to avoid overwhelming the database
    const batchSize = 50;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        const shouldBeGoodDay = isGoodDay(
          record.temperature,
          record.wind_speed,
          record.sunniness,
          record.rain
        );
        
        if (record.is_good_day !== shouldBeGoodDay) {
          // Update the record
          const { error: updateError } = await supabase
            .from('daily_weather_records')
            .update({ is_good_day: shouldBeGoodDay })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`Error updating record ${record.date}:`, updateError);
          } else {
            updatedCount++;
            
            if (record.is_good_day && !shouldBeGoodDay) {
              changedFromGoodToBad++;
            } else if (!record.is_good_day && shouldBeGoodDay) {
              changedFromBadToGood++;
            }
            
            changes.push({
              date: record.date,
              from: record.is_good_day,
              to: shouldBeGoodDay,
              temperature: record.temperature,
              windSpeed: record.wind_speed,
              sunniness: record.sunniness,
              rain: record.rain
            });
            
            console.log(`Updated ${record.date}: ${record.is_good_day} -> ${shouldBeGoodDay}`);
          }
        } else {
          correctCount++;
        }
      }
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
    }
    
    console.log(`Recheck complete!`);
    console.log(`Records updated: ${updatedCount}`);
    console.log(`Records already correct: ${correctCount}`);
    console.log(`Total processed: ${updatedCount + correctCount}`);
    console.log(`Changed from good to bad: ${changedFromGoodToBad}`);
    console.log(`Changed from bad to good: ${changedFromBadToGood}`);
    
    return {
      success: true,
      updated: updatedCount,
      correct: correctCount,
      total: updatedCount + correctCount,
      changedFromGoodToBad,
      changedFromBadToGood,
      changes: changes.slice(0, 10) // Only return first 10 changes for display
    };
    
  } catch (error) {
    console.error('Error rechecking historical data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
