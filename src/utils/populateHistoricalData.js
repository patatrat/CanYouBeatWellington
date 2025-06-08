
import { supabase } from '../integrations/supabase/client';

const calculateSunniness = (weatherCode) => {
  if (weatherCode <= 3) return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

const calculateDaytimeRain = (hourlyPrecipitation, dayIndex) => {
  // Each day has 24 hours, so we need to slice the correct 24-hour period
  const startHour = dayIndex * 24 + 6; // 6 AM
  const endHour = dayIndex * 24 + 18; // 6 PM
  const daytimeRain = hourlyPrecipitation.slice(startHour, endHour).reduce((sum, rain) => sum + (rain || 0), 0);
  return daytimeRain;
};

const isGoodDay = (temperature, windSpeed, rain) => {
  const minTemp = 18;
  const maxWind = 20;
  const maxRain = 0;
  
  return temperature >= minTemp && 
         windSpeed < maxWind && 
         rain <= maxRain;
  // Removed sunniness requirement entirely
};

export const populateHistoricalWeatherData = async () => {
  console.log('Starting historical weather data population...');
  
  // Calculate date range for the last year
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  console.log(`Fetching data from ${startDateStr} to ${endDateStr}`);
  
  try {
    // Fetch historical weather data from Open-Meteo API
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=-41.2866&longitude=174.7756&start_date=${startDateStr}&end_date=${endDateStr}&daily=weather_code,temperature_2m_max,wind_speed_10m_max&hourly=precipitation&timezone=Pacific%2FAuckland`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Received data for ${data.daily.time.length} days`);
    
    // Process each day's data
    const records = [];
    for (let i = 0; i < data.daily.time.length; i++) {
      const date = data.daily.time[i];
      const temperature = data.daily.temperature_2m_max[i];
      const windSpeed = data.daily.wind_speed_10m_max[i];
      const sunniness = calculateSunniness(data.daily.weather_code[i]);
      const rain = calculateDaytimeRain(data.hourly.precipitation, i);
      
      const record = {
        date,
        temperature,
        wind_speed: windSpeed,
        sunniness,
        rain,
        is_good_day: isGoodDay(temperature, windSpeed, rain)
      };
      
      records.push(record);
    }
    
    console.log(`Processed ${records.length} weather records`);
    console.log(`Good days found: ${records.filter(r => r.is_good_day).length}`);
    
    // Insert records into database in batches
    const batchSize = 100;
    let inserted = 0;
    let updated = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      for (const record of batch) {
        // Check if record already exists
        const { data: existingRecord, error: fetchError } = await supabase
          .from('daily_weather_records')
          .select('id')
          .eq('date', record.date)
          .maybeSingle();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error checking for existing record:', fetchError);
          continue;
        }
        
        if (existingRecord) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('daily_weather_records')
            .update({
              temperature: record.temperature,
              wind_speed: record.wind_speed,
              sunniness: record.sunniness,
              rain: record.rain,
              is_good_day: record.is_good_day
            })
            .eq('date', record.date);
          
          if (updateError) {
            console.error('Error updating record:', updateError);
          } else {
            updated++;
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('daily_weather_records')
            .insert(record);
          
          if (insertError) {
            console.error('Error inserting record:', insertError);
          } else {
            inserted++;
          }
        }
      }
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
    }
    
    console.log(`Historical data population complete!`);
    console.log(`Records inserted: ${inserted}`);
    console.log(`Records updated: ${updated}`);
    console.log(`Total processed: ${inserted + updated}`);
    
    return {
      success: true,
      inserted,
      updated,
      total: inserted + updated
    };
    
  } catch (error) {
    console.error('Error populating historical weather data:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Uncomment the line below and run this file to populate the database
// populateHistoricalWeatherData();
