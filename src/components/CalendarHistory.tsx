"use client";

import { useState, useMemo } from "react";
import { ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { isGoodWeatherDay } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";
import {
  pickPrimarySpecialDate,
  resolveVerdict,
  type ActiveSpecialDate,
} from "@/lib/special-dates-logic";
import type { WarningDay } from "@/lib/weather-warnings";
import { CHART } from "@/utils/chartTheme";
import PanelHeader from "./PanelHeader";
import StepNav from "./StepNav";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// MetService's CAP colours, for the legend swatches.
const WARNING_SWATCHES = ["#FFEB18", "#FF8918", "#E3000F"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay();

interface CalendarHistoryProps {
  history: DailyWeatherRecord[];
  specialDates?: ActiveSpecialDate[];
  // NZ day → most severe MetService warning that day, precomputed on the
  // server (see warningsByDay()). Recorded since 2026-10-25 only.
  warningDays?: Record<string, WarningDay>;
  initialYear: number;
  initialMonth: number;
}

// Same verdict as the home page showed on the day: shared weather rule, then
// an active special date's verdict_override (e.g. a Wellington team winning)
// takes precedence — the calendar must never disagree with what the site said.
const isGoodDay = (r: DailyWeatherRecord, special: ActiveSpecialDate | null) =>
  resolveVerdict(
    isGoodWeatherDay({ temperature: r.temperature, windSpeed: r.wind_speed, rain: r.rain }, r.date),
    special?.verdict_override ?? null,
  );

// Same treatment as the year grid: good days filled green, bad days slate,
// and a warning day ringed in the warning's colour.
const cellStyle = (good: boolean | null, warningColour?: string) => ({
  background: good === null ? undefined : good ? CHART.good : CHART.neutral,
  boxShadow: warningColour ? `inset 0 0 0 2px ${warningColour}` : undefined,
});

const CalendarHistory = ({ history, specialDates, warningDays = {}, initialYear, initialMonth }: CalendarHistoryProps) => {
  // Initial state comes from the server component (NZT date) so SSR and client
  // see the same value — no hydration mismatch from new Date() on client.
  const [current, setCurrent] = useState({ year: initialYear, month: initialMonth });

  const historyMap = useMemo(() => {
    const map = new Map<string, DailyWeatherRecord>();
    history?.forEach((r) => map.set(r.date, r));
    return map;
  }, [history]);

  const specialMap = useMemo(() => {
    const byDay = new Map<string, ActiveSpecialDate[]>();
    specialDates?.forEach((s) => {
      for (let d = parseISO(s.start_date); d <= parseISO(s.end_date); d = addDays(d, 1)) {
        const key = format(d, "yyyy-MM-dd");
        byDay.set(key, [...(byDay.get(key) ?? []), s]);
      }
    });
    // When several occasions overlap a day, use the same precedence rule as
    // the home page so the badge and any verdict_override match what was shown.
    const map = new Map<string, ActiveSpecialDate>();
    byDay.forEach((dates, key) => {
      const primary = pickPrimarySpecialDate(dates);
      if (primary) map.set(key, primary);
    });
    return map;
  }, [specialDates]);

  const { year, month } = current;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => setCurrent(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  // initialYear/initialMonth are today's NZ month, so there's nothing to show past them.
  const atCurrentMonth = year > initialYear || (year === initialYear && month >= initialMonth);
  const nextMonth = () => {
    if (atCurrentMonth) return;
    setCurrent(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  };

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const monthGood = [...historyMap.values()].filter(
    (r) => r.date.startsWith(monthPrefix) && isGoodDay(r, specialMap.get(r.date) ?? null),
  ).length;
  const swatch = "inline-block h-[11px] w-[11px] rounded-sm";

  return (
    <div className="text-gray-800">
      <PanelHeader title={`${monthGood} good ${monthGood === 1 ? "day" : "days"} in ${MONTHS[month]} ${year}`}>
        <StepNav
          label={`${MONTH_SHORT[month]} ${year}`}
          onPrev={prevMonth}
          onNext={nextMonth}
          canNext={!atCurrentMonth}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
      </PanelHeader>

      <div className="mx-auto grid w-full max-w-md grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-slate-500">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const dateStr = `${monthPrefix}${String(day).padStart(2, "0")}`;
          const record = historyMap.get(dateStr);
          const special = specialMap.get(dateStr) ?? null;
          const warning = warningDays[dateStr];
          const good = record ? isGoodDay(record, special) : null;
          const agreeCount = record?.agree_count ?? 0;
          const disagreeCount = record?.disagree_count ?? 0;
          const showVotes = agreeCount + disagreeCount > 0 && agreeCount !== disagreeCount;

          const title = [
            record && `${record.temperature}°C · ${record.wind_speed} km/h · ${record.rain}mm rain`,
            showVotes && `${agreeCount} agreed, ${disagreeCount} disagreed`,
            special && special.title + (special.outcome_note ? `: ${special.outcome_note}` : ""),
            warning && warning.headline,
          ].filter(Boolean).join("\n");

          return (
            <div
              key={dateStr}
              title={title || undefined}
              className={cn(
                "relative flex h-11 w-full items-center justify-center rounded-md text-sm tabular-nums",
                good === true ? "font-semibold text-white" : good === false ? "text-gray-700" : "text-gray-400",
              )}
              style={cellStyle(good, warning?.colour)}
            >
              <span>{day}</span>
              {(showVotes || special) && (
                <div className="absolute right-1 top-1 flex flex-col items-center gap-0.5 opacity-80">
                  {showVotes && (agreeCount > disagreeCount
                    ? <ThumbsUp className="h-2.5 w-2.5" aria-label="Most agreed" />
                    : <ThumbsDown className="h-2.5 w-2.5" aria-label="Most disagreed" />)}
                  {special && <Sparkles className="h-2.5 w-2.5" aria-label={special.title} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className={swatch} style={{ background: CHART.good }} />Good day</span>
        <span className="inline-flex items-center gap-1.5"><span className={swatch} style={{ background: CHART.neutral }} />Not a good day</span>
        <span className="inline-flex items-center gap-1.5">
          <ThumbsUp className="h-3 w-3" /><ThumbsDown className="h-3 w-3" />Most agreed / disagreed
        </span>
        <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Special date</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5">
            {WARNING_SWATCHES.map((c) => (
              <span key={c} className={swatch} style={{ boxShadow: `inset 0 0 0 2px ${c}` }} />
            ))}
          </span>
          MetService warning
        </span>
      </div>
    </div>
  );
};

export default CalendarHistory;
