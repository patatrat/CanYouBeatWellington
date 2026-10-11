import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { getHistoricalRecords, getTodaysNZTDate } from "@/lib/weather";
import { getSpecialDatesForRange } from "@/lib/special-dates";
import { canViewWrapped, isWrappedReleased } from "@/lib/wrapped-release";
import { computeWrapped, type Streak, type VoteReason, type VotedDay } from "@/utils/wrappedStats";
import SiteNav from "@/components/SiteNav";
import WrappedBarChart from "@/components/WrappedBarChart";

// Same window as /history — the year's numbers only move once a day.
export const revalidate = 3600;

// Stored history starts in 2020; anything outside that range (or not a
// four-digit year at all) is a plain 404.
const FIRST_YEAR = 2020;

const parseYear = (raw: string): number | null => {
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  const currentYear = Number(getTodaysNZTDate().slice(0, 4));
  return year >= FIRST_YEAR && year <= currentYear ? year : null;
};

type Params = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const year = parseYear((await params).year);
  if (year === null || !canViewWrapped(year)) return {};
  return {
    title: `Wellington Wrapped ${year} | Can You Beat Wellington?`,
    description: `A year of Wellington weather, judged: every good day, bad day and windy day of ${year}.`,
    // Drafts are never indexed, wherever they're viewed.
    robots: isWrappedReleased(year) ? undefined : { index: false, follow: false },
  };
}

const day = (date: string) => format(parseISO(date), "d MMMM");
const pct = (n: number) => `${Math.round(n)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-NZ")} ${n === 1 ? one : many}`;

const streakRange = (s: Streak) => (s.length === 1 ? day(s.start) : `${day(s.start)} to ${day(s.end)}`);

// Short labels for the chart, and the phrase used in sentences.
const REASON_LABEL: Record<VoteReason, string> = {
  good: "Ruled good",
  cold: "Only too cold",
  wind: "Too windy",
  rain: "Too wet",
};
const REASON_PHRASE: Record<VoteReason, string> = {
  good: "days the rules called good",
  cold: "days ruled out only for being too cold",
  wind: "days ruled out for wind",
  rain: "days ruled out for rain",
};
const REASON_QUIP: Record<VoteReason, string> = {
  good: "Tough crowd. The rules said good day, and plenty of you weren't having it.",
  cold: "Calm, dry and a degree or two short? Plenty of you called that a good day anyway.",
  wind: "Apparently the wind wasn't that bad. Says you.",
  rain: "A bit of rain never hurt anyone, apparently.",
};

// Rain at or under the good-day tolerance reads as dry, matching the rules.
const describeWeather = (d: VotedDay) =>
  `${d.temperature.toFixed(1)}°C, ${Math.round(d.windSpeed)} km/h wind, ${d.rain > 0.1 ? `${d.rain.toFixed(1)}mm rain` : "dry"}`;

const Card = ({ className, kicker, children }: { className: string; kicker: string; children: React.ReactNode }) => (
  <section className={`rounded-3xl px-7 py-10 sm:px-10 sm:py-12 shadow-lg ${className}`}>
    <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-4">{kicker}</p>
    {children}
  </section>
);

const Big = ({ children }: { children: React.ReactNode }) => (
  <p className="text-6xl sm:text-7xl font-black leading-none tracking-tight mb-3">{children}</p>
);

export default async function WrappedPage({ params }: Params) {
  const year = parseYear((await params).year);
  if (year === null || !canViewWrapped(year)) notFound();

  const today = getTodaysNZTDate();
  const [records, specialDates] = await Promise.all([
    getHistoricalRecords(`${year}-01-01`, `${year}-12-31`),
    getSpecialDatesForRange(`${year}-01-01`, `${year}-12-31`),
  ]);
  const s = computeWrapped(year, records, specialDates, today);
  const released = isWrappedReleased(year);

  const topSeason = s.seasons[0];
  const { onGoodDays, onBadDays } = s.votes;
  const totalVotes = s.votes.agree + s.votes.disagree;
  const goodDisagree = onGoodDays.disagreeRate;
  const badDisagree = onBadDays.disagreeRate;
  const topReason = s.votes.byReason[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {!released ? (
        <div className="sticky top-0 z-10 bg-yellow-300 text-gray-900 text-center text-sm font-semibold px-4 py-2">
          Draft preview. This page 404s on the live site until {year} is released.
        </div>
      ) : null}

      <SiteNav current="wrapped" onDark />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <header className="text-center py-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-300 mb-4">Can You Beat Wellington</p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
            Wellington
            <br />
            Wrapped {year}
          </h1>
          <p className="text-slate-300">
            {s.isPartialYear
              ? `The year so far, from 1 January to ${day(s.throughDate)}.`
              : "A whole year of Wellington weather, judged."}
          </p>
        </header>

        {s.recordedDays === 0 ? (
          <Card className="bg-slate-800" kicker="Hmm">
            <p className="text-xl">No weather on record for {year} yet.</p>
          </Card>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-amber-400 to-yellow-300 text-gray-900" kicker="Good days">
              <Big>{s.goodDays}</Big>
              <p className="text-xl font-semibold mb-2">
                days you genuinely couldn&apos;t beat Wellington.
              </p>
              <p className="text-gray-800">
                That&apos;s {pct(s.goodPct)} of the {plural(s.recordedDays, "day")} on record. The other{" "}
                {plural(s.badDays, "day")}? Well. Wellington.
              </p>
            </Card>

            {s.longestGoodStreak || s.longestBadStreak ? (
              <Card className="bg-gradient-to-br from-indigo-600 to-violet-700" kicker="Streaks">
                {s.longestGoodStreak ? (
                  <div className="mb-8">
                    <Big>{s.longestGoodStreak.length}</Big>
                    <p className="text-xl font-semibold">
                      good {s.longestGoodStreak.length === 1 ? "day" : "days in a row"}, your longest run.
                    </p>
                    <p className="text-indigo-100">{streakRange(s.longestGoodStreak)}.</p>
                  </div>
                ) : null}
                {s.longestBadStreak ? (
                  <div>
                    <p className="text-4xl font-black mb-2">{s.longestBadStreak.length}</p>
                    <p className="text-lg font-semibold">bad days in a row, the longest drought.</p>
                    <p className="text-indigo-100">{streakRange(s.longestBadStreak)}.</p>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {topSeason ? (
              <Card className="bg-gradient-to-br from-emerald-500 to-teal-700" kicker="Season of the year">
                <Big>{topSeason.label}</Big>
                <p className="text-xl font-semibold mb-8">
                  had the best odds: {pct(topSeason.pct)} of its days were good ({topSeason.good} of {topSeason.total}).
                </p>
                <WrappedBarChart
                  caption={`Share of good days per season in ${year}, best first`}
                  bars={s.seasons.map((season) => ({
                    label: season.label,
                    value: season.pct,
                    valueLabel: pct(season.pct),
                    tooltip: `${season.label}: ${season.good} good of ${season.total} days (${pct(season.pct)})`,
                  }))}
                />
              </Card>
            ) : null}

            <Card className="bg-gradient-to-br from-sky-500 to-blue-700" kicker="Rain">
              <Big>{s.rainDays}</Big>
              <p className="text-xl font-semibold mb-2">days with rain, {pct(s.rainPct)} of {s.isPartialYear ? "the year so far" : "the year"}.</p>
              {s.rainiestDay ? (
                <p className="text-sky-50">
                  The wettest was {day(s.rainiestDay.date)}, with {s.rainiestDay.rain.toFixed(1)}mm during daylight hours.
                </p>
              ) : null}
            </Card>

            <Card className="bg-gradient-to-br from-slate-600 to-slate-800" kicker="Wind">
              <p className="text-3xl sm:text-4xl font-black leading-tight mb-2">The windy city, in numbers.</p>
              <p className="text-slate-200 mb-8">
                Days by average daytime wind speed, in km/h. Anything from 30 up rules out a good day.
              </p>
              <WrappedBarChart
                caption={`Days in ${year} by average daytime wind speed`}
                marker={{ afterIndex: 2, label: "30 km/h good-day limit" }}
                bars={s.windBins.map((bin) => ({
                  label: bin.label,
                  value: bin.count,
                  valueLabel: String(bin.count),
                  tooltip: `${bin.label} km/h: ${plural(bin.count, "day")}`,
                  muted: bin.min >= 30,
                }))}
              />
              {s.windiestDay ? (
                <p className="text-slate-200 mt-6">
                  Windiest: {day(s.windiestDay.date)}, averaging {Math.round(s.windiestDay.windSpeed)} km/h.
                </p>
              ) : null}
            </Card>

            {totalVotes > 0 ? (
              <Card className="bg-gradient-to-br from-rose-500 to-pink-700" kicker="You voted">
                <Big>{totalVotes.toLocaleString("en-NZ")}</Big>
                <p className="text-xl font-semibold mb-2">
                  votes: {s.votes.agree.toLocaleString("en-NZ")} agreed, {s.votes.disagree.toLocaleString("en-NZ")} didn&apos;t.
                </p>
                {s.votes.firstVoteDate && s.votes.firstVoteDate > `${year}-01-01` ? (
                  <p className="text-rose-100 text-sm">Counting from the first vote, on {day(s.votes.firstVoteDate)}.</p>
                ) : null}
                {s.votes.busiest ? (
                  <p className="text-rose-50 mt-4">
                    Your busiest day was {day(s.votes.busiest.date)}, with{" "}
                    {plural(s.votes.busiest.agree + s.votes.busiest.disagree, "vote")}.
                  </p>
                ) : null}
                {goodDisagree !== null && badDisagree !== null ? (
                  <p className="text-rose-50 mt-4">
                    {goodDisagree > badDisagree
                      ? `You were harder to convince on good days: ${pct(goodDisagree * 100)} of votes disagreed, versus ${pct(badDisagree * 100)} on bad days.`
                      : goodDisagree < badDisagree
                        ? `You argued more on bad days: ${pct(badDisagree * 100)} of votes disagreed, versus ${pct(goodDisagree * 100)} on good days. Optimists, the lot of you.`
                        : `You disagreed exactly as often on good days as on bad ones: ${pct(goodDisagree * 100)}.`}
                  </p>
                ) : null}
              </Card>
            ) : null}

            {topReason || s.votes.mostContested || s.votes.mostUnanimous ? (
              <Card className="bg-gradient-to-br from-cyan-600 to-indigo-800" kicker="Where you drew the line">
                {topReason?.disagreeRate != null ? (
                  <>
                    <Big>{pct(topReason.disagreeRate * 100)}</Big>
                    <p className="text-xl font-semibold mb-2">
                      of votes disagreed on {REASON_PHRASE[topReason.reason]}.
                    </p>
                    <p className="text-cyan-50 mb-8">{REASON_QUIP[topReason.reason]}</p>
                  </>
                ) : null}
                {s.votes.byReason.length > 1 ? (
                  <>
                    <p className="text-sm text-cyan-50 mb-4">Share of votes that disagreed, by why the day got its verdict:</p>
                    <WrappedBarChart
                      caption={`Share of votes disagreeing with the verdict in ${year}, by reason`}
                      bars={s.votes.byReason.map((g) => ({
                        label: REASON_LABEL[g.reason],
                        value: (g.disagreeRate ?? 0) * 100,
                        valueLabel: pct((g.disagreeRate ?? 0) * 100),
                        tooltip: `${REASON_LABEL[g.reason]}: ${g.disagree} of ${g.agree + g.disagree} votes disagreed, across ${plural(g.days, "day")}`,
                      }))}
                    />
                    <p className="text-xs text-cyan-100 mt-3 mb-8">
                      A day that was both windy and wet counts under both.
                    </p>
                  </>
                ) : null}
                <div className="space-y-5">
                  {s.votes.mostContested ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-100 mb-1">Most contested day</p>
                      <p className="text-lg font-semibold">
                        {day(s.votes.mostContested.date)}: {s.votes.mostContested.agree} agreed, {s.votes.mostContested.disagree} didn&apos;t.
                      </p>
                      <p className="text-cyan-50">
                        {describeWeather(s.votes.mostContested)}, ruled {s.votes.mostContested.good ? "good" : "bad"}.
                      </p>
                    </div>
                  ) : null}
                  {s.votes.mostUnanimous ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-cyan-100 mb-1">Most unanimous day</p>
                      <p className="text-lg font-semibold">
                        {day(s.votes.mostUnanimous.date)}:{" "}
                        {s.votes.mostUnanimous.disagree === 0
                          ? `${plural(s.votes.mostUnanimous.agree, "vote")}, not one disagreed.`
                          : `${s.votes.mostUnanimous.agree} agreed, ${s.votes.mostUnanimous.disagree} didn't.`}
                      </p>
                      <p className="text-cyan-50">
                        {describeWeather(s.votes.mostUnanimous)}, ruled {s.votes.mostUnanimous.good ? "good" : "bad"}.
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {s.savedBySpecialDates.length > 0 || s.ruinedBySpecialDates.length > 0 ? (
              <Card className="bg-gradient-to-br from-fuchsia-600 to-purple-800" kicker="Vibes over weather">
                {s.savedBySpecialDates.length > 0 ? (
                  <>
                    <Big>{s.savedBySpecialDates.length}</Big>
                    <p className="text-xl font-semibold mb-4">
                      {s.savedBySpecialDates.length === 1 ? "day was" : "days were"} saved by something bigger than the weather.
                    </p>
                    <ul className="space-y-1 text-fuchsia-50">
                      {s.savedBySpecialDates.map((d) => (
                        <li key={d.date}>
                          {day(d.date)}: {d.title}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {s.ruinedBySpecialDates.length > 0 ? (
                  <p className="text-fuchsia-50 mt-6">
                    And {plural(s.ruinedBySpecialDates.length, "perfectly good day")} ruined anyway:{" "}
                    {s.ruinedBySpecialDates.map((d) => `${d.title} (${day(d.date)})`).join(", ")}.
                  </p>
                ) : null}
              </Card>
            ) : null}

            <Card className="bg-gradient-to-br from-orange-500 to-red-600" kicker="Also this year">
              <ul className="space-y-4 text-lg">
                {s.hottestDay ? (
                  <li>
                    <span className="font-black text-3xl">{s.hottestDay.temperature.toFixed(1)}°C</span>
                    <br />
                    Hottest day, on {day(s.hottestDay.date)}.
                  </li>
                ) : null}
                <li>
                  <span className="font-black text-3xl">{s.snowDays}</span>
                  <br />
                  {s.snowDays === 0
                    ? "Days of snow. Not even a flake."
                    : `${s.snowDays === 1 ? "Day" : "Days"} of snow. In Wellington.`}
                </li>
              </ul>
            </Card>
          </>
        )}

        {s.missingDates.length > 0 ? (
          <p className="text-center text-xs text-slate-400 pt-6">
            {plural(s.missingDates.length, "day")} of {year} {s.missingDates.length === 1 ? "has" : "have"} no usable
            weather record, so {s.missingDates.length === 1 ? "it's" : "they're"} left out of every number above.
          </p>
        ) : null}
      </main>
    </div>
  );
}
