"use client";

import { useState, useMemo } from "react";
import { Check, X, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { isGoodWeatherDay } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";
import {
  pickPrimarySpecialDate,
  resolveVerdict,
  type ActiveSpecialDate,
} from "@/lib/special-dates-logic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay();

interface CalendarHistoryProps {
  history: DailyWeatherRecord[];
  specialDates?: ActiveSpecialDate[];
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

const CalendarHistory = ({ history, specialDates, initialYear, initialMonth }: CalendarHistoryProps) => {
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
  const nextMonth = () => setCurrent(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col items-center space-y-4 text-gray-800">
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Good Day</span>
        <span className="flex items-center gap-1"><X className="w-4 h-4 text-red-500" /> Not a Good Day</span>
        <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-green-600" /> Most Agree</span>
        <span className="flex items-center gap-1"><ThumbsDown className="w-4 h-4 text-red-600" /> Most Disagree</span>
        <span className="flex items-center gap-1"><Sparkles className="w-4 h-4 text-purple-500" /> Special date</span>
        <span className="text-gray-500">No symbol = No data</span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium w-36 text-center">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 w-full max-w-sm">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const mm = String(month + 1).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateStr = `${year}-${mm}-${dd}`;
          const record = historyMap.get(dateStr);
          const special = specialMap.get(dateStr) ?? null;
          const good = record ? isGoodDay(record, special) : null;
          const agreeCount = record?.agree_count ?? 0;
          const disagreeCount = record?.disagree_count ?? 0;
          const totalVotes = agreeCount + disagreeCount;
          const majorityAgree = agreeCount > disagreeCount;

          const weatherTitle = record
            ? `🌡️ ${record.temperature}°C  💨 ${record.wind_speed} km/h  🌧️ ${record.rain}mm rain`
            : undefined;
          const votesTitle = totalVotes > 0 && agreeCount !== disagreeCount
            ? `👍 ${agreeCount} | 👎 ${disagreeCount}`
            : undefined;
          const specialTitle = special
            ? special.title + (special.outcome_note ? ` — ${special.outcome_note}` : "")
            : undefined;

          return (
            <div key={dateStr} className={cn("relative h-12 w-full flex items-center justify-center rounded text-sm", record && "hover:bg-gray-50")}>
              <span>{day}</span>
              {(record || special) && (
                <div className="absolute top-0.5 right-0.5 flex flex-col items-center gap-0.5">
                  {record && (
                    <span title={weatherTitle}>
                      {good
                        ? <Check className="w-3 h-3 text-green-500" />
                        : <X className="w-3 h-3 text-red-500" />}
                    </span>
                  )}
                  {votesTitle && (
                    <span title={votesTitle}>
                      {majorityAgree
                        ? <ThumbsUp className="w-2.5 h-2.5 text-green-600" />
                        : <ThumbsDown className="w-2.5 h-2.5 text-red-600" />}
                    </span>
                  )}
                  {special && (
                    <span title={specialTitle}>
                      <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarHistory;
