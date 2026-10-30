import type { Metadata } from "next";
import { getAllHistoricalRecords, getTodaysNZTDate } from "@/lib/weather";
import { getSpecialDatesForRange } from "@/lib/special-dates";
import { getRecordedWarnings } from "@/lib/warning-history";
import { warningsByDay } from "@/lib/weather-warnings";
import FunFacts from "@/components/FunFacts";
import { calculateFunFacts } from "@/utils/weatherFunFacts";
import MonthlyGoodDaysChart from "@/components/MonthlyGoodDaysChart";
import SeasonBreakdown from "@/components/SeasonBreakdown";
import MonthlyAveragesChart from "@/components/MonthlyAveragesChart";
import CalendarHistory from "@/components/CalendarHistory";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "The Record — Can You Beat Wellington?",
  description: "Every Wellington day since 2020, judged good or bad: good days by month and season, monthly weather averages, and a full calendar.",
  alternates: { canonical: "/history" },
};

export const revalidate = 3600;

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="mb-14">
    <h2 className="text-lg font-bold uppercase tracking-widest text-gray-400 mb-1">{title}</h2>
    {subtitle ? <p className="text-sm text-gray-400 mb-5">{subtitle}</p> : <div className="mb-5" />}
    {children}
  </section>
);

export default async function HistoryPage() {
  const history = await getAllHistoricalRecords();

  // The special_dates table will only ever have tens of rows, so fetching
  // the whole history-spanning range in one shot is cheap — same pattern
  // as getAllHistoricalRecords() above.
  const today = getTodaysNZTDate();
  const earliestDate = history.at(-1)?.date ?? today;
  const [specialDates, recordedWarnings] = await Promise.all([
    getSpecialDatesForRange(earliestDate, today),
    getRecordedWarnings(),
  ]);
  const warningDays = warningsByDay(recordedWarnings);

  // Compute NZT date server-side and pass to CalendarHistory so the client
  // initialises state with the same year/month as the SSR output, avoiding
  // hydration mismatches from new Date() running at different wall-clock times.
  const nztNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
  const todayYear = nztNow.getFullYear();
  const todayMonth = nztNow.getMonth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">
      <SiteNav current="history" />

      <div className="max-w-3xl mx-auto px-6 py-14">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-800 mb-2">The record.</h1>
          <p className="text-gray-500">Every Wellington day, judged.</p>
        </header>

        <Section title="Did you know">
          <FunFacts facts={calculateFunFacts(history, today)} />
        </Section>

        <Section title="Last 12 months" subtitle="Good days per month. Navigate with the arrows to go further back.">
          <MonthlyGoodDaysChart history={history} />
        </Section>

        <Section title="Season breakdown" subtitle="Percentage of good days per season, across all years of data.">
          <SeasonBreakdown history={history} />
        </Section>

        <Section title="Monthly patterns" subtitle="Which months typically deliver? Aggregated across all years.">
          <MonthlyAveragesChart history={history} />
        </Section>

        <Section title="Calendar">
          <CalendarHistory
            history={history}
            specialDates={specialDates}
            warningDays={warningDays}
            initialYear={todayYear}
            initialMonth={todayMonth}
          />
        </Section>
      </div>
    </div>
  );
}
