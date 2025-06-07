
import { supabase } from '../integrations/supabase/client';

const isGoodDayOld = (temperature, windSpeed, sunniness, rain) => {
  const minTemp = 18;
  const maxWind = 20;
  const minSunniness = 90; // Old requirement
  const maxRain = 0;
  
  return temperature >= minTemp && 
         windSpeed < maxWind && 
         sunniness >= minSunniness && 
         rain <= maxRain;
};

const isGoodDayNew = (temperature, windSpeed, sunniness, rain) => {
  const minTemp = 18;
  const maxWind = 20;
  const minSunniness = 70; // New requirement
  const maxRain = 0;
  
  return temperature >= minTemp && 
         windSpeed < maxWind && 
         sunniness >= minSunniness && 
         rain <= maxRain;
};

export const checkSunshineUpdate = async () => {
  console.log('Checking sunshine requirement update impact...');
  
  try {
    // Fetch all historical records
    const { data: records, error: fetchError } = await supabase
      .from('daily_weather_records')
      .select('*')
      .order('date', { ascending: true });
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`Analyzing ${records.length} records...`);
    
    let newGoodDays = 0;
    let totalGoodDaysOld = 0;
    let totalGoodDaysNew = 0;
    const newGoodDaysList = [];
    
    for (const record of records) {
      const wasGoodDayOld = isGoodDayOld(
        record.temperature,
        record.wind_speed,
        record.sunniness,
        record.rain
      );
      
      const isGoodDayNewRule = isGoodDayNew(
        record.temperature,
        record.wind_speed,
        record.sunniness,
        record.rain
      );
      
      if (wasGoodDayOld) totalGoodDaysOld++;
      if (isGoodDayNewRule) totalGoodDaysNew++;
      
      // If it's good with new rules but wasn't with old rules
      if (isGoodDayNewRule && !wasGoodDayOld) {
        newGoodDays++;
        newGoodDaysList.push({
          date: record.date,
          temperature: record.temperature,
          windSpeed: record.wind_speed,
          sunniness: record.sunniness,
          rain: record.rain
        });
      }
    }
    
    console.log(`Analysis complete!`);
    console.log(`Good days with 90% sunshine requirement: ${totalGoodDaysOld}`);
    console.log(`Good days with 70% sunshine requirement: ${totalGoodDaysNew}`);
    console.log(`New good days added: ${newGoodDays}`);
    
    return {
      success: true,
      oldGoodDays: totalGoodDaysOld,
      newGoodDays: totalGoodDaysNew,
      addedGoodDays: newGoodDays,
      newGoodDaysList: newGoodDaysList.slice(0, 10) // Show first 10 examples
    };
    
  } catch (error) {
    console.error('Error checking sunshine update impact:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
