// Scenario-based quips for today's verdict.
// Scenario is determined by which of the three criteria (temp/wind/rain) are met.
// Each array should have 4-6 entries so rotation feels natural.

type Scenario = keyof typeof QUIPS;
type ForecastBucket = keyof typeof FORECAST_SUMMARY;
type SeverityScenario = keyof typeof SEVERE_QUIPS;

const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

// ── Today's verdict quips ────────────────────────────────────────────────────

export const QUIPS = {

  // All three criteria met
  GOOD: [
    "Get outside. Wellington is showing off.",
    "Even the wind took the day off.",
    "Pretty bloody gorgeous, as it happens.",
    "Wellington on a good day. There, we said it.",
    "Yep. Can't argue with that.",
    "Bloody lovely. Don't waste it.",
    "YCBWOAGD. Today, it's actually true.",
  ],

  // Wind is the only failure (temp ✓, rain ✓, wind ✗)
  WIND_ONLY: [
    "The wind's at it again. Classic.",
    "Lovely day. Shame about the nor'wester.",
    "Would've been perfect. Cheers, wind.",
    "Temperature? ✓  Rain? ✓  Wind? Absolutely not.",
    "Wellington remembered it has a personality.",
    "So close. The wind had other plans.",
  ],

  // Rain is the only failure (temp ✓, wind ✓, rain ✗)
  RAIN_ONLY: [
    "So close. Then it rained.",
    "Calm, warm — and of course, raining.",
    "The rain didn't get the memo.",
    "Good vibes, bad drizzle.",
    "Perfect but for the rain. So close.",
    "Almost a pearler. Almost.",
  ],

  // Temperature is the only failure (wind ✓, rain ✓, temp ✗)
  TEMP_ONLY: [
    "Calm and dry. Just... a bit nippy.",
    "No wind. No rain. Just needs a jumper. Or three.",
    "Brisk. That's the word. Brisk.",
    "Dry as a bone, calm as anything. Bring a coat.",
    "Perfect but for the cold. Bring a coat.",
    "It's fine. It's just not warm. That's all.",
  ],

  // Wind and rain both fail (temp ✓)
  WIND_RAIN: [
    "Wet and windy. The Wellington double.",
    "Horizontal rain. Peak Wellington.",
    "Blustery and soaked. At least it's not cold too.",
    "Full Wellington energy today.",
    "The starter pack. Wind, rain, nothing else.",
    "It's giving Wellington. Very Wellington.",
  ],

  // Wind and temperature both fail (rain ✓)
  WIND_TEMP: [
    "Cold and windy. Dry though — so there's that.",
    "Freezing and blustery. At least it's not raining.",
    "No rain! Everything else, though.",
    "A dry misery. Almost impressive.",
    "Cold, cutting, windy. But bone dry.",
    "Rough. But no rain. Small mercies.",
  ],

  // Rain and temperature both fail (wind ✓)
  RAIN_TEMP: [
    "Cold and wet. The wind's behaving, at least.",
    "Quiet rubbish day. Not blowing a gale, so.",
    "Rainy and nippy, with a side of stillness.",
    "Two wrong, one right. Go wind.",
    "Cold rain. Still air. Wellington on mute.",
    "Miserable, but quietly so.",
  ],

  // All three criteria fail
  ALL_BAD: [
    "Wind, rain, cold. Wellington going full Wellington.",
    "Everything's wrong. As you were.",
    "The full set. Hat trick of bad.",
    "When Wellington decides to commit to the bit.",
    "At least it's consistent.",
    "Honestly, respect the audacity.",
    "Wind, rain, cold. Triple threat.",
  ],
} as const satisfies Record<string, string[]>;

// ── Severity quips ───────────────────────────────────────────────────────────
// Absolute-intensity flavour text, layered on top of the scenario quips above
// rather than replacing them — the actual good/bad-day verdict is untouched
// (still decided by rulesStorage.ts); these only override which line of text
// is shown. Checked in severity order by getSeverityScenario() before falling
// back to the scenario quips, so a single day never matches more than one.

export const SEVERE_QUIPS = {
  // Any snowfall — checked first in getSeverityScenario(), ahead of even the
  // most extreme wind, since Wellington snow is rare enough to make the news.
  SNOW: [
    "Call your kids, call the press, there might be snow in Wellington!",
    "What is the one thing less likely than a good day in Wellington? Snow in Wellington!",
    "Break out the winter jandals, you'll need the extra traction for the snow.",
  ],

  // Wind ≥ 40 km/h, no rain
  WIND_40: [
    "Hold on to your hats, it's blowing!",
    'Here\'s my impression of Wellington today: "Whoosh, whoosh, whoosh."',
    "Wind, wind, go away, come again another day.",
  ],

  // Wind ≥ 50 km/h (and < 60)
  WIND_50: [
    "I hope you aren't planning on flying today.",
    "She's windy out there, go check your tramp.",
    "Your glass recycling bin is in the next suburb.",
  ],

  // Wind ≥ 60 km/h
  WIND_60: [
    "Someone check on the Zephyrometer.",
    "Is the Water Whirler still there?",
  ],

  // Wind ≥ 40 km/h (and < 50) and rain > 5mm — takes priority over plain WIND_40
  WIND_40_RAIN: [
    "Don't bother with an umbrella today.",
    "Normally rain falls down. Today it falls sideways.",
    "Planning on heading outside today? You're brave.",
    "Today is what Aucklanders think every day is like in Wellington.",
  ],

  // Feels-like temperature below 0°C — checked after the wind tiers, since a
  // wind-driven cold snap is already explained by the wind quip; this tier
  // is for the day genuinely cold enough on its own merits.
  FEELS_LIKE_COLD: [
    "Bust out the long johns, she's a cold one.",
    "The only thing worse than freezing cold temperatures is how often people in the office are going to mention it today.",
    "Time to ironically tell the barista, 'You can't beat Wellington on a good day.'",
  ],

  // Rain ≥ 25mm (only reached once wind is below 40 — see getSeverityScenario)
  RAIN_HEAVY: [
    "It's raining cats and dogs.",
    "Enjoy your swim.",
    "Quick, clear the drains before the rains.",
  ],

  // Rain ≥ 10mm (and < 25) and wind < 30 km/h
  RAIN_STEADY_CALM: [
    "It could be worse, it could be windy.",
    "At least the rain is falling straight down today.",
  ],
} as const satisfies Record<string, string[]>;

// ── Great day quip ───────────────────────────────────────────────────────────
// A step up from GOOD — checked when the day clears the good-day bar by a
// wide margin (temp 3°+ above the seasonal minimum, calm wind), not just
// when it scrapes past. Only reached when rain is also fine, same as GOOD.

export const GREAT_DAY_QUIPS = [
  "Today is the type of day they write songs about.",
  "One day you'll be telling your grandkids about today.",
  "Sure, you can't beat Wellington on a good day, but today is a GREAT DAY.",
  "It's always like this in Wellington — yeah, right.",
] as const satisfies readonly string[];

// ── Forecast summary quips ───────────────────────────────────────────────────
// Shown below the 6-day forecast strip based on how many good days are coming.

export const FORECAST_SUMMARY = {
  // 0 good days in the next 6
  none: [
    "Nothing to write home about this week.",
    "Wellington's not planning to impress anytime soon.",
    "Rough week ahead. Make peace with the indoors.",
    "Six days. Zero good ones. Very Wellington.",
  ],

  // 1 good day
  one: [
    "There's a glimmer. Don't get too excited.",
    "One decent day ahead. Guard it with your life.",
    "A single ray of hope. Classic Wellington ration.",
    "One good day incoming. Mark it in the calendar.",
  ],

  // 2–3 good days
  few: [
    "A few decent days ahead. Savour them.",
    "Not bad. Not bad at all, actually.",
    "Some hope on the horizon.",
    "Wellington's in a generous mood. Briefly.",
  ],

  // 4+ good days
  many: [
    "Suspiciously nice week ahead. Wellington must want something.",
    "Multiple good days in a row? Unprecedented.",
    "Something's off. This is too good.",
    "A proper run of good weather. Don't tell anyone.",
  ],
} as const satisfies Record<string, string[]>;

// ── Helpers ──────────────────────────────────────────────────────────────────

export const getScenario = (tempMet: boolean, windMet: boolean, rainMet: boolean): Scenario => {
  if (tempMet  && windMet  && rainMet)  return 'GOOD';
  if (tempMet  && windMet  && !rainMet) return 'RAIN_ONLY';
  if (tempMet  && !windMet && rainMet)  return 'WIND_ONLY';
  if (!tempMet && windMet  && rainMet)  return 'TEMP_ONLY';
  if (tempMet  && !windMet && !rainMet) return 'WIND_RAIN';
  if (!tempMet && !windMet && rainMet)  return 'WIND_TEMP';
  if (!tempMet && windMet  && !rainMet) return 'RAIN_TEMP';
  return 'ALL_BAD';
};

export const pickQuip = (scenario: Scenario): string =>
  pick([...(QUIPS[scenario] ?? QUIPS.ALL_BAD)]);

// "Great day" bar: temp at least 3° above the seasonal minimum, wind under
// 20 km/h (well inside the ordinary <30 good-day threshold), and rain still
// fine — a stricter version of GOOD, not a replacement for it.
export const isGreatDay = (
  weather: { temperature: number; windSpeed: number; rain: number },
  minTemp: number,
): boolean => weather.temperature >= minTemp + 3 && weather.windSpeed < 20 && weather.rain <= 0;

export const pickGreatDayQuip = (): string => pick([...GREAT_DAY_QUIPS]);

// "Almost good" — a near-miss on temperature specifically: wind and rain
// both clear the normal good-day bar (reuses the caller's own windMet/
// rainMet rather than a separate hardcoded threshold, unlike isGreatDay's
// stricter bar above), and temperature falls short of the seasonal minimum
// by less than a full degree. Checked ahead of the plain TEMP_ONLY scenario
// quip so a razor-thin miss reads differently from an ordinary cold day.
export const isAlmostGoodDay = (
  temperature: number,
  minTemp: number,
  windMet: boolean,
  rainMet: boolean,
): boolean => windMet && rainMet && temperature < minTemp && minTemp - temperature < 1;

export const ALMOST_GOOD_DAY_QUIPS = [
  'To borrow a quote from Maxwell Smart — "Missed it by that much." 🤏',
  "New Zealand might have two degrees of separation, but we're less than one degree away from a good day today.",
  "YCBWOAAGD — You can't beat Wellington on an almost good day.",
  "As Meat Loaf would say — two out of three ain't bad.",
] as const satisfies readonly string[];

export const pickAlmostGoodDayQuip = (): string => pick([...ALMOST_GOOD_DAY_QUIPS]);

// Priority waterfall, most severe/specific condition first — each check
// "claims" the day before a less specific one gets a chance, so exactly one
// tier ever matches. Snow sits at the very top — rarer and more newsworthy
// than any wind reading. Wind tiers are nested (60 implies 50 implies 40),
// so the highest one reached wins outright regardless of rain; the
// wind+rain combo only applies in the 40-49 band, since 50+ is dramatic
// enough on its own — and only once rain is more than a light shower
// (> 5mm), so a windy day with a token drizzle still reads as plain
// WIND_40. Feels-like-cold is checked after wind, since a wind-driven cold
// snap is already explained by the wind quip — this tier is for the day
// that's genuinely cold on its own merits, not because of the wind chill.
// Returns null when nothing severe applies — callers should fall back to the
// standard scenario quips (getScenario/pickQuip) in that case.
export interface SeverityWeather {
  windSpeed: number;
  rain: number;
  snowfall: number;
  feelsLike: number;
}

export const getSeverityScenario = (weather: SeverityWeather): SeverityScenario | null => {
  const { windSpeed, rain, snowfall, feelsLike } = weather;
  if (snowfall > 0) return "SNOW";
  if (windSpeed >= 60) return "WIND_60";
  if (windSpeed >= 50) return "WIND_50";
  if (windSpeed >= 40 && rain > 5) return "WIND_40_RAIN";
  if (windSpeed >= 40) return "WIND_40";
  if (feelsLike < 0) return "FEELS_LIKE_COLD";
  if (rain >= 25) return "RAIN_HEAVY";
  if (rain >= 10 && windSpeed < 30) return "RAIN_STEADY_CALM";
  return null;
};

export const pickSeverityQuip = (weather: SeverityWeather): string | null => {
  const scenario = getSeverityScenario(weather);
  return scenario ? pick([...SEVERE_QUIPS[scenario]]) : null;
};

export const pickForecastSummary = (goodDayCount: number): string => {
  const bucket: ForecastBucket =
    goodDayCount === 0 ? 'none' :
    goodDayCount === 1 ? 'one' :
    goodDayCount <= 3  ? 'few' : 'many';
  return pick([...FORECAST_SUMMARY[bucket]]);
};
