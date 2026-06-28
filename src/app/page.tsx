import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getThresholds, getSeasonLabel } from "@/utils/rulesStorage";
import { getScenario, pickQuip } from "@/utils/quips";
import { getTodaysRecord, fetchLiveWeather, upsertWeatherRecord, getTodaysNZTDate } from "@/lib/weather";
import { getActiveSpecialDates, pickPrimarySpecialDate, resolveVerdict } from "@/lib/special-dates";
import { SPECIAL_BACKGROUNDS } from "@/utils/specialBackgrounds";
import WeatherStat from "@/components/WeatherStat";
import VotingButtons from "@/components/VotingButtons";
import ForecastStrip from "@/components/ForecastStrip";
import SpecialDateEffect from "@/components/SpecialDateEffect";

export const revalidate = 3600;

export default async function HomePage() {
  const today = getTodaysNZTDate();
  const [todaysRecord, liveWeather, activeSpecialDates] = await Promise.all([
    getTodaysRecord(),
    fetchLiveWeather(),
    getActiveSpecialDates(today),
  ]);
  const special = pickPrimarySpecialDate(activeSpecialDates);

  // Seed today's row as soon as it's known so voting has something to attach
  // to before the daily cron runs — the cron will overwrite with the final
  // full-day reading later. ON CONFLICT DO UPDATE makes this idempotent.
  const record =
    todaysRecord ??
    (await (async () => {
      await upsertWeatherRecord({
        date: liveWeather.timestamp,
        temperature: liveWeather.temperature,
        wind_speed: liveWeather.windSpeed,
        rain: liveWeather.rain,
        sunniness: liveWeather.sunniness,
      });
      return getTodaysRecord();
    })());

  // Prefer the cron-written record for the verdict when it exists — it
  // captures the full daytime window, whereas the live Open-Meteo fetch may
  // reflect a partially-elapsed day.
  const effectiveWeather = record
    ? { temperature: record.temperature, windSpeed: record.wind_speed, rain: record.rain }
    : { temperature: liveWeather.temperature, windSpeed: liveWeather.windSpeed, rain: liveWeather.rain };

  const weatherDate = new Date(liveWeather.timestamp + "T12:00:00");
  const rules = getThresholds(weatherDate);
  const seasonLabel = getSeasonLabel(weatherDate);
  const isShitsville = seasonLabel === "Shitsville";

  const tempMet = effectiveWeather.temperature >= rules.minTemp;
  const windMet = effectiveWeather.windSpeed < rules.maxWind;
  const rainMet = effectiveWeather.rain <= rules.maxRain;
  const weatherIsGood = tempMet && windMet && rainMet;
  // A non-null verdict_override from an active special date wins over the
  // weather-computed verdict — e.g. a Wellington team winning can force a
  // good day regardless of temperature/wind/rain. WeatherStat below still
  // shows the real per-criterion facts unchanged either way.
  const isGood = resolveVerdict(weatherIsGood, special?.verdict_override ?? null);
  const verdictLine = special?.quip_override ?? pickQuip(getScenario(tempMet, windMet, rainMet));
  const bgClass =
    (special?.background_key && SPECIAL_BACKGROUNDS[special.background_key]) ||
    (isGood
      ? "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100"
      : "bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200");

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${bgClass}`}>
      <SpecialDateEffect effect={special?.effect ?? "none"} />

      {/* Top-right nav */}
      <nav className="flex justify-end px-5 pt-4 gap-5 text-sm font-medium text-gray-500">
        <Link href="/about" className="hover:text-gray-800 transition-colors">Why though?</Link>
        <Link href="/history" className="hover:text-gray-800 transition-colors">The record</Link>
      </nav>

      <div className="flex flex-col items-center justify-center flex-1 px-6 py-6">
        {/* Special-date banner */}
        {special && (special.title || special.link_url) && (
          <p className="text-xs text-gray-500 text-center mb-3">
            {special.title}
            {special.outcome_note && ` — ${special.outcome_note}`}
            {special.link_url && (
              <>
                {" · "}
                <a
                  href={special.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-gray-700"
                >
                  {special.link_label ?? "More"}
                </a>
              </>
            )}
          </p>
        )}

        {/* Season badge */}
        <span
          className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6 ${
            isShitsville ? "bg-slate-700 text-slate-100" : "bg-amber-200 text-amber-800"
          }`}
        >
          {seasonLabel} season
        </span>

        {/* Question */}
        <h1 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-2">
          Can you beat Wellington today?
        </h1>

        {/* Verdict */}
        <p className={`text-[8rem] sm:text-[10rem] leading-none font-black mb-3 ${isGood ? "text-green-600" : "text-red-500"}`}>
          {isGood ? "NO" : "YES"}
        </p>

        {/* Cheeky line — no max-width so quips stay on one line */}
        <p className="text-sm text-gray-500 text-center mb-8 italic whitespace-nowrap">{verdictLine}</p>

        {/* Weather stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-10 mb-6">
          <WeatherStat
            label="Temperature"
            value={`${effectiveWeather.temperature.toFixed(1)}°C`}
            meets={tempMet}
            threshold={`≥ ${rules.minTemp}°C`}
          />
          <WeatherStat
            label="Wind"
            value={`${effectiveWeather.windSpeed.toFixed(1)} km/h`}
            meets={windMet}
            threshold={`< ${rules.maxWind} km/h`}
          />
          <WeatherStat
            label="Rain"
            value={`${effectiveWeather.rain.toFixed(1)} mm`}
            meets={rainMet}
            threshold="0 mm"
          />
        </div>

        {/* Voting */}
        {record && (
          <VotingButtons
            key={record.date}
            date={record.date}
            agreeCount={record.agree_count}
            disagreeCount={record.disagree_count}
          />
        )}

        {/* Forecast */}
        <ForecastStrip forecast={liveWeather.forecast} />

        {/* Attribution */}
        <p className="text-xs text-gray-400 text-center mt-5">
          Updated {format(parseISO(liveWeather.timestamp), "PPP")} ·{" "}
          <a
            href={liveWeather.source}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600 underline underline-offset-2"
          >
            open-meteo.com <ExternalLink className="inline-block w-3 h-3 ml-0.5" />
          </a>
        </p>
      </div>
    </div>
  );
}
