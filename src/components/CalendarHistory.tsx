"use client";

import { useState, useMemo } from "react";
import { Check, X, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getThresholds } from "@/utils/rulesStorage";
import type { DailyWeatherRecord } from "@/types/db";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfWeek = (year: number, month: number) => new Date(year, month, 1).getDay();

interface CalendarHistoryProps {
  history: DailyWeatherRecord[];
  initialYear: number;
  initialMonth: number;
}

const isGoodDay = (r: DailyWeatherRecord) => {
  const { minTemp, maxWind, maxRain } = getThresholds(r.date);
  return r.temperature >= minTemp && r.wind_speed < maxWind && r.rain <= maxRain;
};

const CalendarHistory = ({ history, initialYear, initialMonth }: CalendarHistoryProps) => {
  // Initial state comes from the server component (NZT date) so SSR and client
  // see the same value — no hydration mismatch from new Date() on client.
  const [current, setCurrent] = useState({ year: initialYear, month: initialMonth });

  const historyMap = useMemo(() => {
    const map = new Map<string, DailyWeatherRecord>();
    history?.forEach((r) => map.set(r.date, r));
    return map;
  }, [history]);

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
    <div className="flex flex-col items-center space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-500" /> Good Day</span>
        <span className="flex items-center gap-1"><X className="w-4 h-4 text-red-500" /> Not a Good Day</span>
        <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-green-600" /> Most Agree</span>
        <span className="flex items-center gap-1"><ThumbsDown className="w-4 h-4 text-red-600" /> Most Disagree</span>
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
          const good = record ? isGoodDay(record) : null;
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

          return (
            <div key={dateStr} className={cn("relative h-12 w-full flex items-center justify-center rounded text-sm", record && "hover:bg-gray-50")}>
              <span>{day}</span>
              {record && (
                <div className="absolute top-0.5 right-0.5 flex flex-col items-center gap-0.5">
                  <span title={weatherTitle}>
                    {good
                      ? <Check className="w-3 h-3 text-green-500" />
                      : <X className="w-3 h-3 text-red-500" />}
                  </span>
                  {votesTitle && (
                    <span title={votesTitle}>
                      {majorityAgree
                        ? <ThumbsUp className="w-2.5 h-2.5 text-green-600" />
                        : <ThumbsDown className="w-2.5 h-2.5 text-red-600" />}
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
