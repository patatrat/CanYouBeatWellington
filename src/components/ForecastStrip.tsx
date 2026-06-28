import { getThresholds } from "@/utils/rulesStorage";
import { pickForecastSummary } from "@/utils/quips";
import type { ForecastDay } from "@/lib/weather";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ForecastStripProps {
  forecast: ForecastDay[];
}

const ForecastStrip = ({ forecast }: ForecastStripProps) => {
  if (!forecast?.length) return null;

  const days = forecast.map((day) => {
    const date = new Date(day.date + "T12:00:00"); // noon to avoid DST edge cases
    const { minTemp, maxWind, maxRain } = getThresholds(date);
    const tempMet = day.temperature >= minTemp;
    const windMet = day.windSpeed < maxWind;
    const rainMet = day.rain <= maxRain;
    const good = tempMet && windMet && rainMet;

    const failures = [
      !tempMet && `${day.temperature.toFixed(0)}° (need ${minTemp}°)`,
      !windMet && `${day.windSpeed.toFixed(0)} km/h wind`,
      !rainMet && `${day.rain.toFixed(1)} mm rain`,
    ].filter((failure): failure is string => Boolean(failure));

    return {
      dayName: DAY_NAMES[date.getDay()],
      temp: day.temperature.toFixed(0),
      good,
      failures,
    };
  });

  const summaryQuip = pickForecastSummary(days.filter((d) => d.good).length);

  return (
    <div className="w-full max-w-sm mt-6">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 text-center mb-3">
        Next {days.length} days
      </p>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((day, i) => (
          <div
            key={i}
            className={`flex flex-col items-center rounded-lg py-2 px-1 text-center transition-colors ${
              day.good ? "bg-green-100/70 text-green-800" : "bg-gray-200/60 text-gray-500"
            }`}
            title={day.good ? "Good day!" : `Fails: ${day.failures.join(", ")}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide leading-none mb-1">
              {day.dayName}
            </span>
            <span className={`text-base font-black leading-none ${day.good ? "text-green-600" : "text-gray-400"}`}>
              {day.good ? "✓" : "✗"}
            </span>
            <span className="text-[10px] mt-1 leading-none">{day.temp}°</span>
          </div>
        ))}
      </div>

      {summaryQuip && <p className="text-xs text-gray-400 text-center mt-2 italic">{summaryQuip}</p>}
    </div>
  );
};

export default ForecastStrip;
