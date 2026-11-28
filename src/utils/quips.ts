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
    "Today is why we put up with the rest of the year.",
    "Wellington's put its best face on. Go and see it.",
    "Clear your afternoon. You'll thank us.",
    "Sweet as. Get amongst it.",
    "No wind, no rain, no excuses.",
    "🎵 Her love shines over my horizon, she's a slice of heaven 🎵 And today, so is Wellington.",
    "We don't know how lucky we are. Today, we actually do.",
  ],

  // Wind is the only failure (temp ✓, rain ✓, wind ✗)
  WIND_ONLY: [
    "The wind's at it again. Classic.",
    "Would've been perfect. Cheers, wind.",
    "Temperature? ✓  Rain? ✓  Wind? Absolutely not.",
    "Wellington remembered it has a personality.",
    "So close. The wind had other plans.",
    "🎵 Sway 🎵 Bic Runga, starring every tree in Wellington. Probably.",
  ],

  // Rain is the only failure (temp ✓, wind ✓, rain ✗)
  RAIN_ONLY: [
    "So close. Then it rained.",
    "Calm, warm — and of course, raining.",
    "The rain didn't get the memo.",
    "Good vibes, bad drizzle.",
    "Perfect, apart from the wet bit.",
    "Almost a pearler. Almost.",
    "🎵 Don't go out in the rain 🎵 Dragon had it right.",
    "🎵 Everywhere you go, you always take the weather with you 🎵 Please leave it at home today.",
  ],

  // Temperature is the only failure (wind ✓, rain ✓, temp ✗)
  TEMP_ONLY: [
    "Calm and dry. Just... a bit nippy.",
    "No wind. No rain. Just needs a jumper. Or three.",
    "Brisk. That's the word. Brisk.",
    "Dry as a bone, calm as anything. Shame about the chill.",
    "Perfect but for the cold. Bring a coat.",
    "It's fine. It's just not warm. That's all.",
    "Lovely day, if you're a penguin.",
    "Still and dry. Just add merino.",
    "All the ingredients, except warmth.",
    "The kind of day that looks better through a window.",
  ],

  // Wind and rain both fail (temp ✓)
  WIND_RAIN: [
    "Wet and windy. The Wellington double.",
    "Horizontal rain. Peak Wellington.",
    "Blustery and soaked. At least it's not cold too.",
    "Full Wellington energy today.",
    "The starter pack. Wind, rain, nothing else.",
    "Coats on, hoods up, umbrellas abandoned.",
    "Someone needs to sacrifice an umbrella to the Welly Weather Gods.",
    "Breaking news: rubbish bins all over Wellington full of broken umbrellas.",
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
    "🎵 Don't go out in the rain 🎵 Dragon had it right.",
  ],

  // All three criteria fail
  ALL_BAD: [
    "Wind, rain, cold. Wellington going full Wellington.",
    "Everything's wrong. As you were.",
    "The full set. Hat trick of bad.",
    "When Wellington decides to commit to the bit.",
    "At least it's consistent.",
    "Honestly, respect the audacity.",
    "A triple threat, and not the fun kind.",
    "🎵 Four seasons in one day 🎵 Crowded House, documentary makers.",
    "Even Jim Hickey couldn't put a positive spin on this one.",
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
    "It's not windy, it's \"bracing\".",
    "Good day to fly a kite. Bad day to be holding one.",
    "Doors will slam. Hair will be ruined. Carry on.",
    "Hold on to your coffee lid.",
  ],

  // Wind ≥ 50 km/h (and < 60)
  WIND_50: [
    "I hope you aren't planning on flying today.",
    "She's windy out there, go check your tramp.",
    "Your glass recycling bin is in the next suburb.",
    "🎵 Anchor me 🎵 The Mutton Birds would understand today.",
  ],

  // Wind ≥ 60 km/h
  WIND_60: [
    "Someone check on the Zephyrometer.",
    "Is the Water Whirler still there?",
  ],

  // Wind ≥ 40 km/h (and < 50) and rain > 5mm — takes priority over plain WIND_40
  WIND_40_RAIN: [
    "Leave the umbrella, unless you want to end up like Mary Poppins.",
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
    "🎵 Don't go out in the rain 🎵 Dragon had it right.",
    "🎵 Everywhere you go, you always take the weather with you 🎵 Please leave it at home today.",
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
  "🎵 How bizarre, how bizarre 🎵 A great day in Wellington.",
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
    "Six days of meh. Plan indoor activities accordingly.",
    "Not a single good day in sight. Very on brand.",
    "The forecast says no. And no. And no again.",
    "If you spot a good day this week, please report it.",
    "Good days this week: zero. Character building: plenty.",
    "🎵 Outlook for Thursday 🎵 And Friday. And the weekend. More of the same.",
  ],

  // 1 good day
  one: [
    "There's a glimmer. Don't get too excited.",
    "One decent day ahead. Guard it with your life.",
    "A single ray of hope. Classic Wellington ration.",
    "One good day incoming. Mark it in the calendar.",
    "One good day on the way. Don't waste it.",
    "Just the one good day coming. Book your leave now.",
    "One good day this week. Choose your outdoor plans wisely.",
    "One good day ahead. Act surprised when it turns up.",
  ],

  // 2–3 good days
  few: [
    "A few decent days ahead. Savour them.",
    "Not bad. Not bad at all, actually.",
    "Some hope on the horizon.",
    "Wellington's in a generous mood. Briefly.",
    "A couple of good days coming. Wellington's showing promise.",
    "Good days ahead, in moderation.",
    "A few good days on the way. Get the washing out.",
    "Not a full week of them, but we'll take it.",
  ],

  // 4+ good days
  many: [
    "Suspiciously nice week ahead. Wellington must want something.",
    "Multiple good days in a row? Unprecedented.",
    "Something's off. This is too good.",
    "A proper run of good weather. Don't tell anyone.",
    "A week like this is why people put up with the rest.",
    "More good days than bad ahead. Write it down, nobody will believe you.",
    "Clear your weekend. And possibly your weekdays.",
    "The forecast is looking very un-Wellington.",
    "🎵 Slice of heaven 🎵 And it's not just a slice this week.",
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

// A good day in April also gets this line.
export const APRIL_GOOD_QUIPS = [
  "🎵 Take me to the April sun in Cuba 🎵 Not just Cuba. Wellington's got it today.",
] as const;

// Any bad day that falls on a Wednesday also gets this line.
export const WEDNESDAY_BAD_QUIPS = ["🎵 Wednesday, don't mention Wednesday 🎵 Not a good one at all."] as const;

// Extra context that adds lines to a pool (never replaces it):
// windDirection in degrees, month 1–12, dayOfWeek 0 = Sunday … 6 = Saturday.
export interface QuipContext {
  windDirection?: number | null;
  month?: number;
  dayOfWeek?: number;
}

export const pickQuip = (scenario: Scenario, context: QuipContext = {}): string =>
  pick([
    ...(QUIPS[scenario] ?? QUIPS.ALL_BAD),
    ...(scenario === "WIND_ONLY" ? windDirectionQuips(context.windDirection ?? null) : []),
    ...(scenario === "GOOD" && context.month === 4 ? APRIL_GOOD_QUIPS : []),
    ...(scenario !== "GOOD" && context.dayOfWeek === 3 ? WEDNESDAY_BAD_QUIPS : []),
  ]);

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
  "So close you could almost call it. Almost.",
  "Under a degree off. The thermometer's being petty.",
  "Calm, dry, and one jumper short of perfect.",
] as const satisfies readonly string[];

export const pickAlmostGoodDayQuip = (): string => pick([...ALMOST_GOOD_DAY_QUIPS]);

// ── Good-day streak quips ────────────────────────────────────────────────────
// Checked when today is good and at least one preceding day was too — takes
// priority over isGreatDay/isAlmostGoodDay, since "N good days in a row" is a
// more surprising fact than today individually clearing the bar by a wide
// margin. Longer streaks (6+) reuse the 5-tier pool — there's no way to know
// in advance how long a streak can realistically run in Wellington, so rather
// than inventing wording for an arbitrary cutoff, the "mythical working week"
// framing just keeps applying.
export const STREAK_QUIPS: Record<number, readonly string[]> = {
  2: [
    "Two good days in a row! Eat your heart out!",
    "Is this déjà vu? Wasn't it a good day yesterday too?",
    "Back-to-back good days. Don't jinx it.",
    "Two in a row. Wellington's on a roll.",
    "Yesterday was good, today's good. Somebody pinch me.",
  ],
  3: [
    "Howzat!! It's a hat trick — three in a row good days!",
    "Statistically implausible, but it happened — three good days in a row.",
    "Any more good days in a row and we might start getting bored of them.",
    "🎵 Can't get enough 🎵 Supergroove, on this run of good days.",
  ],
  4: [
    'To borrow a phrase from Smash Mouth — "the good days start coming and they don\'t stop coming."',
    "Four in a row! What if it's just good days forever?",
    "🎵 Can't get enough 🎵 Supergroove, on this run of good days.",
  ],
  5: [
    "It's the mythical good working week — five good days in a row.",
    "🎵 Can't get enough 🎵 Supergroove, on this run of good days.",
  ],
} as const satisfies Record<number, readonly string[]>;

export const pickStreakQuip = (streak: number): string | null => {
  const pool = STREAK_QUIPS[Math.min(streak, 5)];
  return pool ? pick([...pool]) : null;
};

// ── Streak-broken quips ──────────────────────────────────────────────────────
// A bad day straight after one or more good days. Keyed by how long the run
// that just ended was (5+ share the last tier). Lines can use {culprit}
// (whatever failed today: "wind", "rain and cold", ...) and {n} (the run's
// length). The scenario lines below join the pool when today's failure
// matches, at any run length.
export const STREAK_BROKEN_QUIPS: Record<number, readonly string[]> = {
  1: [
    "And now, back to our regularly scheduled weather.",
    "Well, yesterday was nice.",
    "That was fun while it lasted. All twenty-four hours of it.",
    "Yesterday was a good day. Today's here to even things out.",
    "One good day, and Wellington's already taken it back.",
  ],
  2: [
    "The day that denied us the hat trick.",
    "It would have been three in a row, if it weren't for that meddling {culprit}.",
    "So close to a hat trick. Two will have to do.",
    "Two good days was apparently the limit.",
  ],
  3: [
    "We can't have Wellington getting too used to good days.",
    "Three good days in a row, so here's a reminder of what we haven't been missing.",
    "Three in a row was nice. Normal service has resumed.",
    "The hat trick happened. Let's not get greedy.",
  ],
  4: [
    "Four in a row! We were starting to think it was just good days forever. It wasn't.",
    "So close to the mythical good working week.",
    "Four good days in a row. It had to end sometime, and today's the day.",
  ],
  5: [
    "The good days started coming, and now they've stopped coming.",
    "{n} good days in a row. Enjoy the memories.",
    "After a run like that, Wellington owes us nothing. Well, almost nothing.",
  ],
} as const satisfies Record<number, readonly string[]>;

export const STREAK_BROKEN_SCENARIO_QUIPS: Partial<Record<Scenario, readonly string[]>> = {
  WIND_ONLY: [
    "Of course the wind came back. It always comes back.",
    "The wind's been saving itself up for today.",
  ],
  RAIN_ONLY: ["The good run's been rained off."],
  TEMP_ONLY: ["Still dry, still calm, just not warm enough to count. So close to keeping it going."],
  ALL_BAD: ["If you're going to end a streak, end it properly. Cold, windy and wet."],
};

// What failed today, for {culprit}. All three failing reads as "weather".
export const streakCulprit = (tempMet: boolean, windMet: boolean, rainMet: boolean): string => {
  const failed = [!windMet && "wind", !rainMet && "rain", !tempMet && "cold"].filter(Boolean) as string[];
  return failed.length === 3 ? "weather" : failed.join(" and ");
};

// priorStreak: good days in a row up to yesterday. Null when there was no run
// to break, or when nothing failed (a bad verdict forced by a special date),
// so the caller falls through to the usual quips.
// Join the pool for any run length.
export const STREAK_BROKEN_ANY_QUIPS = [
  "The good weather? Gone burger, as Jim Hickey would say.",
  "🎵 History never repeats 🎵 Split Enz, talking about yesterday's weather.",
] as const;

// Joins the pool on a Saturday, when the run that ended included Friday.
export const STREAK_BROKEN_SATURDAY_QUIPS = ["Lovely on Friday, and now it's the weekend. Typical."] as const;

export const pickStreakBrokenQuip = (
  priorStreak: number,
  tempMet: boolean,
  windMet: boolean,
  rainMet: boolean,
  isSaturday = false,
): string | null => {
  if (priorStreak < 1 || (tempMet && windMet && rainMet)) return null;
  const pool = [
    ...STREAK_BROKEN_QUIPS[Math.min(priorStreak, 5)],
    ...(STREAK_BROKEN_SCENARIO_QUIPS[getScenario(tempMet, windMet, rainMet)] ?? []),
    ...STREAK_BROKEN_ANY_QUIPS,
    ...(isSaturday ? STREAK_BROKEN_SATURDAY_QUIPS : []),
  ];
  return pick(pool)
    .replace("{culprit}", streakCulprit(tempMet, windMet, rainMet))
    .replace("{n}", String(priorStreak));
};

// ── Wind direction ───────────────────────────────────────────────────────────
// Cook Strait funnels Wellington's wind almost entirely north or south, so
// two pools cover nearly every windy day. Mixed into the wind-only and
// strong-wind pools; east/west or unknown directions add nothing.
export const WIND_DIRECTION_QUIPS = {
  north: [
    "The north wind doth blow, and we shall have snow. Wrong hemisphere. Just more wind.",
    "A howling northerly. Wellington's factory setting.",
    "Northerly gale. At least it's a warm one.",
    "Lovely day. Shame about the nor'wester.",
  ],
  south: [
    "Southerly buster. Straight from Antarctica, no stopovers.",
    "The wind's coming from the south, and it's brought the cold with it.",
    "A proper southerly. Hope you packed a hat. And gloves. And a scarf.",
    "Southerly change. Somewhere, a ferry's been cancelled.",
  ],
} as const;

// Where the wind comes from: north is NW–NE (292.5°–67.5°), south SE–SW.
export const windQuarter = (degrees: number | null): "north" | "south" | null => {
  if (degrees == null || Number.isNaN(degrees)) return null;
  const d = ((degrees % 360) + 360) % 360;
  if (d >= 292.5 || d < 67.5) return "north";
  if (d >= 112.5 && d < 247.5) return "south";
  return null;
};

const windDirectionQuips = (degrees: number | null): string[] => {
  const quarter = windQuarter(degrees);
  return quarter ? [...WIND_DIRECTION_QUIPS[quarter]] : [];
};

// ── Dead calm ────────────────────────────────────────────────────────────────
// Daytime wind averaging under 5 km/h: about 3–4 days a year since 2020, so
// rarer than most severe tiers. Checked just after them.
export const DEAD_CALM_QUIPS = [
  "Not a breath of wind. The harbour's a millpond.",
  "No wind. None. Is this still Wellington?",
  "The wind's taken a sick day.",
  "Dead calm. The windsock at the airport has given up.",
] as const satisfies readonly string[];

export const pickDeadCalmQuip = (windSpeed: number): string | null =>
  windSpeed < 5 ? pick([...DEAD_CALM_QUIPS]) : null;

// ── Long runs of bad days ────────────────────────────────────────────────────
// A bad day once there's been no good day for a week or more. {n} is the
// days since the last good one, today included. Keyed by the lower bound.
export const DROUGHT_QUIPS: Record<7 | 14 | 21, readonly string[]> = {
  7: [
    "A week without a good day. Wellington's testing us.",
    "{n} days since the last good one. Not that anyone's counting. We're counting.",
    "{n} days without a good day. Hang in there.",
    "🎵 Don't dream it's over 🎵 Crowded House said that {n} days ago.",
  ],
  14: [
    "{n} days and counting. Do you remember what the sun feels like?",
    "Two weeks without a good day. Time to stock up on vitamin D.",
    "🎵 Don't dream it's over 🎵 Crowded House said that {n} days ago.",
  ],
  21: [
    "{n} days since the last good day. At this point it's a lifestyle.",
    "Somewhere, a good day is waiting for us. It's just taking its time.",
    "🎵 Don't dream it's over 🎵 Crowded House said that {n} days ago.",
  ],
};

export const pickDroughtQuip = (daysWithoutGood: number): string | null => {
  if (daysWithoutGood < 7) return null;
  const tier = daysWithoutGood >= 21 ? 21 : daysWithoutGood >= 14 ? 14 : 7;
  // "A week without" only reads right for exactly seven days.
  const pool = DROUGHT_QUIPS[tier].filter((q) => daysWithoutGood === 7 || !q.startsWith("A week"));
  return pick(pool).replace("{n}", String(daysWithoutGood));
};

// A good day after 7+ bad ones. {n} is the length of the bad run.
export const DROUGHT_OVER_QUIPS = [
  "{n} days of rubbish, and then this. Wellington, you tease.",
  "The drought is over. Get outside before it changes its mind.",
  "After {n} bad days, we'd almost forgotten what this looked like.",
] as const satisfies readonly string[];

export const pickDroughtOverQuip = (priorBadRun: number): string | null =>
  priorBadRun >= 7 ? pick([...DROUGHT_OVER_QUIPS]).replace("{n}", String(priorBadRun)) : null;

// ── Bad today, good tomorrow ─────────────────────────────────────────────────
export const TOMORROW_LOOKS_GOOD_QUIPS = [
  "Hang in there. Tomorrow's looking better.",
  "Today's a write-off, but tomorrow's looking promising.",
  "Save your outdoor plans for tomorrow.",
  "🎵 Maybe tomorrow 🎵 Goldenhorse giving us a weather forecast.",
] as const satisfies readonly string[];

export const TOMORROW_IS_THURSDAY_QUIPS = [
  "🎵 Outlook for Thursday, your guess as good as mine 🎵 Better than today.",
] as const;

// tomorrowDayOfWeek: 0 = Sunday … 6 = Saturday.
export const pickTomorrowQuip = (tomorrowLooksGood: boolean, tomorrowDayOfWeek: number | null = null): string | null =>
  tomorrowLooksGood
    ? pick([...TOMORROW_LOOKS_GOOD_QUIPS, ...(tomorrowDayOfWeek === 4 ? TOMORROW_IS_THURSDAY_QUIPS : [])])
    : null;

// ── Good days by day of the week ─────────────────────────────────────────────
// dayOfWeek: 0 = Sunday … 6 = Saturday.
export const WEEKEND_GOOD_QUIPS = [
  "A good day and it's the weekend. Don't you dare stay inside.",
  "Good weather on a weekend? Wellington's spoiling us.",
] as const satisfies readonly string[];

export const MONDAY_GOOD_QUIPS = [
  "A good day on a Monday. Wellington's sense of humour at work.",
] as const satisfies readonly string[];

export const pickDayOfWeekGoodQuip = (dayOfWeek: number): string | null =>
  dayOfWeek === 0 || dayOfWeek === 6
    ? pick([...WEEKEND_GOOD_QUIPS])
    : dayOfWeek === 1
      ? pick([...MONDAY_GOOD_QUIPS])
      : null;

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
  // Today's dominant wind direction in degrees, when known. Only picks extra
  // lines; it never changes which tier applies.
  windDirection?: number | null;
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
  if (!scenario) return null;
  const windy = scenario === "WIND_40" || scenario === "WIND_50" || scenario === "WIND_60";
  return pick([...SEVERE_QUIPS[scenario], ...(windy ? windDirectionQuips(weather.windDirection ?? null) : [])]);
};

// Joins the "one good day" pool when that day is a Thursday.
export const FORECAST_ONE_THURSDAY = [
  "🎵 Outlook for Thursday 🎵 Good, for once. Plan accordingly.",
] as const;

// onlyGoodDayOfWeek: 0 = Sunday … 6 = Saturday, when exactly one day is good.
export const pickForecastSummary = (goodDayCount: number, onlyGoodDayOfWeek: number | null = null): string => {
  const bucket: ForecastBucket =
    goodDayCount === 0 ? 'none' :
    goodDayCount === 1 ? 'one' :
    goodDayCount <= 3  ? 'few' : 'many';
  const extra = bucket === 'one' && onlyGoodDayOfWeek === 4 ? FORECAST_ONE_THURSDAY : [];
  return pick([...FORECAST_SUMMARY[bucket], ...extra]);
};
