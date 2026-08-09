import { ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getThresholds, getSeasonLabel, isGoodWeatherDay } from "@/utils/rulesStorage";
import { getScenario, pickQuip, pickSeverityQuip, isGreatDay, pickGreatDayQuip } from "@/utils/quips";
import { getTodaysRecord, fetchLiveWeather, upsertWeatherRecord, getTodaysNZTDate } from "@/lib/weather";
import { getActiveSpecialDates, pickPrimarySpecialDate, resolveVerdict, getSpecialDayQuip } from "@/lib/special-dates";
import { SPECIAL_BACKGROUNDS } from "@/utils/specialBackgrounds";
import WeatherStat from "@/components/WeatherStat";
import VotingButtons from "@/components/VotingButtons";
import ForecastStrip from "@/components/ForecastStrip";
import SpecialDateEffect from "@/components/SpecialDateEffect";
import SiteNav from "@/components/SiteNav";

// Short enough that the window where a cached page straddles NZ midnight
// (showing yesterday's date/verdict) stays small — the underlying fetches
// are cheap, and fetchLiveWeather has its own 1-hour fetch cache anyway.
export const revalidate = 600;

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
        feels_like: liveWeather.feelsLike,
        snowfall: liveWeather.snowfall,
        sunniness: liveWeather.sunniness,
      });
      return getTodaysRecord();
    })());

  // Prefer the cron-written record for the verdict when it exists — it
  // captures the full daytime window, whereas the live Open-Meteo fetch may
  // reflect a partially-elapsed day. feels_like/snowfall are nullable on
  // older rows (added after the column existed) — 0 is a safe fallback for
  // both, since it just means "no snow" / "no extra chill" gets assumed.
  const effectiveWeather = record
    ? {
        temperature: record.temperature,
        windSpeed: record.wind_speed,
        rain: record.rain,
        feelsLike: record.feels_like ?? 0,
        snowfall: record.snowfall ?? 0,
      }
    : {
        temperature: liveWeather.temperature,
        windSpeed: liveWeather.windSpeed,
        rain: liveWeather.rain,
        feelsLike: liveWeather.feelsLike,
        snowfall: liveWeather.snowfall,
      };

  const weatherDate = new Date(liveWeather.timestamp + "T12:00:00");
  const rules = getThresholds(weatherDate);
  const seasonLabel = getSeasonLabel(weatherDate);
  const isShitsville = seasonLabel === "Shitsville";

  const tempMet = effectiveWeather.temperature >= rules.minTemp;
  const windMet = effectiveWeather.windSpeed < rules.maxWind;
  const rainMet = effectiveWeather.rain <= rules.maxRain;
  const weatherIsGood = isGoodWeatherDay(effectiveWeather, weatherDate);
  // A non-null verdict_override from an active special date wins over the
  // weather-computed verdict — e.g. a Wellington team winning can force a
  // good day regardless of temperature/wind/rain. WeatherStat below still
  // shows the real per-criterion facts unchanged either way.
  const isGood = resolveVerdict(weatherIsGood, special?.verdict_override ?? null);
  // Precedence: a special date's fixed quip_override always wins (sporting
  // results etc, where the weather is beside the point); then an extreme
  // wind/rain reading; then a special date's own scenario-specific line
  // (e.g. Christmas Day's rainy-day quip), if it has one for today's
  // scenario; then a day that clears the good-day bar by a wide margin gets
  // its own celebratory line; otherwise the standard scenario quip.
  const verdictLine =
    special?.quip_override ??
    pickSeverityQuip(effectiveWeather) ??
    (special ? getSpecialDayQuip(special, effectiveWeather, rules) : null) ??
    (isGreatDay(effectiveWeather, rules.minTemp) ? pickGreatDayQuip() : null) ??
    pickQuip(getScenario(tempMet, windMet, rainMet));
  const specialBg = special?.background_key ? SPECIAL_BACKGROUNDS[special.background_key] : undefined;
  // Dark special backgrounds (matariki, rugby) need light text — the default
  // grays below are designed for the light gradients and vanish on near-black.
  const onDark = specialBg?.dark ?? false;
  const bgClass =
    specialBg?.className ||
    (isGood
      ? "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100"
      : "bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200");
  const mutedText = onDark ? "text-slate-300" : "text-gray-500";
  const faintText = onDark ? "text-slate-400" : "text-gray-400";
  const mutedHover = onDark ? "hover:text-white" : "hover:text-gray-800";

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${bgClass}`}>
      <SpecialDateEffect effect={special?.effect ?? "none"} />

      <SiteNav current="home" onDark={onDark} />

      <div className="flex flex-col items-center justify-center flex-1 px-6 py-6">
        {/* Special-date banner */}
        {special && (special.title || special.link_url) && (
          <p className={`text-xs ${mutedText} text-center mb-3`}>
            {special.title}
            {special.outcome_note && ` — ${special.outcome_note}`}
            {special.link_url && (
              <>
                {" · "}
                <a
                  href={special.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`underline underline-offset-2 ${mutedHover}`}
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
        <h1 className={`text-sm font-medium ${faintText} uppercase tracking-widest mb-2`}>
          Can you beat Wellington today?
        </h1>

        {/* Verdict */}
        <p
          className={`text-[8rem] sm:text-[10rem] leading-none font-black mb-3 ${
            isGood ? (onDark ? "text-green-400" : "text-green-600") : onDark ? "text-red-400" : "text-red-500"
          }`}
        >
          {isGood ? "NO" : "YES"}
        </p>

        {/* Cheeky line — no max-width so quips stay on one line */}
        <p className={`text-sm ${mutedText} text-center mb-8 italic whitespace-nowrap`}>{verdictLine}</p>

        {/* Weather stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-10 mb-6">
          <WeatherStat
            label="Temperature"
            value={`${effectiveWeather.temperature.toFixed(1)}°C`}
            meets={tempMet}
            threshold={`≥ ${rules.minTemp}°C`}
            onDark={onDark}
          />
          <WeatherStat
            label="Wind"
            value={`${effectiveWeather.windSpeed.toFixed(1)} km/h`}
            meets={windMet}
            threshold={`< ${rules.maxWind} km/h`}
            onDark={onDark}
          />
          <WeatherStat
            label="Rain"
            value={`${(rainMet ? 0 : effectiveWeather.rain).toFixed(1)} mm`}
            meets={rainMet}
            threshold="0 mm"
            onDark={onDark}
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
        <ForecastStrip forecast={liveWeather.forecast} onDark={onDark} />

        {/* Attribution */}
        <p className={`text-xs ${faintText} text-center mt-5`}>
          Updated {format(parseISO(liveWeather.timestamp), "PPP")} ·{" "}
          <a
            href={liveWeather.source}
            target="_blank"
            rel="noopener noreferrer"
            className={`${mutedHover} underline underline-offset-2`}
          >
            open-meteo.com <ExternalLink className="inline-block w-3 h-3 ml-0.5" />
          </a>
        </p>
      </div>
    </div>
  );
}
