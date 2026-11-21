"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Check, Droplet, Thermometer, Wind, X } from "lucide-react";
import { buildYearGrid, type YearGridCell } from "@/utils/yearGrid";
import type { DailyWeatherRecord } from "@/types/db";
import type { WarningDay } from "@/lib/weather-warnings";
import { CHART } from "@/utils/chartTheme";
import StepNav from "./StepNav";

// GitHub-style year grid, weather only (see utils/yearGrid.ts). Used on
// /history (with a year picker) and on Wrapped (one year, dark card).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// MetService's CAP colours (yellow and orange as stored; red per their scale).
const WARNING_SWATCHES = ["#FFEB18", "#FF8918", "#E3000F"];

const CELL = 11;
const STEP = 14;
const LEFT = 28;
const TOP = 18;

// One slate hue for bad days, darkest = failed all three checks, in both
// tones. Good days stay one green so the shading only grades bad days.
const PALETTE = {
  light: {
    good: CHART.good, bad: CHART.neutral, failed: ["", "#d5dde6", "#98a8ba", "#435466"],
    empty: "#cbd5e1", label: CHART.axis,
  },
  dark: {
    good: "#2fbf68", bad: "#475569", failed: ["", "#94a3b8", "#64748b", "#334155"],
    empty: "#475569", label: "#94a3b8",
  },
} as const;

interface YearGridProps {
  records: DailyWeatherRecord[];
  warningDays: Record<string, WarningDay>;
  today: string;
  initialYear: number;
  // Years offered in the picker. Omit for a single fixed year (Wrapped).
  years?: number[];
  tone?: "light" | "dark";
  showStats?: boolean;
}

type Tip = { cell: YearGridCell; left: number; top: number };

const fmtDay = (date: string) => format(parseISO(date), "d MMM");

export default function YearGrid({
  records,
  warningDays,
  today,
  initialYear,
  years,
  tone = "light",
  showStats = true,
}: YearGridProps) {
  const [year, setYear] = useState(initialYear);
  const [detail, setDetail] = useState(true);
  const [tip, setTip] = useState<Tip | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const colours = PALETTE[tone];
  const dark = tone === "dark";

  const grid = useMemo(() => buildYearGrid(year, records, warningDays, today), [year, records, warningDays, today]);
  const { stats } = grid;

  // On a narrow screen the grid scrolls sideways; open the current year at
  // today's end, like GitHub, and past years at January.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = year === Number(today.slice(0, 4)) ? el.scrollWidth : 0;
  }, [year, today]);

  // Touch has no mouseleave, so a tap outside the grid (or any scroll)
  // closes the tooltip.
  useEffect(() => {
    if (!tip) return;
    const close = (e: Event) => {
      if (e.type === "scroll" || !svgRef.current?.contains(e.target as Node)) setTip(null);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [tip]);

  const changeYear = (y: number) => {
    setYear(y);
    setTip(null);
  };

  const show = (cell: YearGridCell, target: Element) => {
    if (cell.status === "empty") return setTip(null);
    const r = target.getBoundingClientRect();
    setTip({ cell, left: r.left + r.width / 2, top: r.top });
  };

  const fill = (c: YearGridCell) =>
    c.status === "good" ? colours.good : detail ? colours.failed[c.failed] : colours.bad;

  const width = LEFT + grid.weeks * STEP;
  const height = TOP + 7 * STEP;
  const goodPct = stats.recordedDays ? Math.round((stats.goodDays / stats.recordedDays) * 100) : 0;

  const muted = dark ? "text-slate-300" : "text-gray-500";
  const legendSwatch = (colour: string) => (
    <span className="inline-block h-[11px] w-[11px] rounded-sm" style={{ background: colour }} />
  );

  return (
    <div className={dark ? "text-white" : "text-gray-800"}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
        <p className={`text-lg font-bold ${dark ? "" : "text-gray-800"}`}>
          {stats.goodDays} good {stats.goodDays === 1 ? "day" : "days"} in {year}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <button
            type="button"
            role="switch"
            aria-checked={detail}
            onClick={() => setDetail((d) => !d)}
            className="inline-flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span
              className={`relative h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${
                detail ? "bg-green-500" : dark ? "bg-slate-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                  detail ? "translate-x-3" : ""
                }`}
              />
            </span>
            Bad day detail
          </button>
          {years && years.length > 1 ? (
            <StepNav
              label={String(year)}
              onPrev={() => changeYear(year - 1)}
              onNext={() => changeYear(year + 1)}
              canPrev={year > Math.min(...years)}
              canNext={year < Math.max(...years)}
              prevLabel="Previous year"
              nextLabel="Next year"
            />
          ) : null}
        </div>
      </div>

      <div ref={scroller} className="overflow-x-auto pb-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ minWidth: 600, display: "block" }}
          role="img"
          aria-label={`${year}: ${stats.goodDays} good days of ${stats.recordedDays} on record`}
          onMouseLeave={() => setTip(null)}
        >
          {["Mon", "Wed", "Fri"].map((d, i) => (
            <text key={d} x={0} y={TOP + i * 2 * STEP + 9} fontSize={10} fill={colours.label}>
              {d}
            </text>
          ))}
          {grid.monthStarts.map(({ month, col }) => (
            <text key={month} x={LEFT + col * STEP} y={10} fontSize={10} fill={colours.label}>
              {MONTHS[month]}
            </text>
          ))}
          {grid.cells.map((c) => {
            const x = LEFT + c.col * STEP;
            const y = TOP + c.row * STEP;
            return (
              <g
                key={c.date}
                onMouseEnter={(e) => show(c, e.currentTarget)}
                onClick={(e) => show(c, e.currentTarget)}
                style={{ cursor: c.status === "empty" ? "default" : "pointer" }}
              >
                {/* Hit target a little larger than the square. */}
                <rect x={x - 1.5} y={y - 1.5} width={STEP} height={STEP} fill="transparent" />
                {c.status === "empty" ? (
                  <rect
                    x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} rx={2}
                    fill="none" stroke={colours.empty} strokeDasharray="2 1.5"
                  />
                ) : (
                  <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill(c)} />
                )}
                {c.warning ? (
                  <rect
                    x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={1.5}
                    fill="none" stroke={c.warning.colour} strokeWidth={2}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs ${muted}`}>
        <span className="inline-flex items-center gap-1.5">{legendSwatch(colours.good)}Good day</span>
        {detail ? (
          <>
            <span>Bad day, failed on:</span>
            {[1, 2, 3].map((n) => (
              <span key={n} className="inline-flex items-center gap-1.5">
                {legendSwatch(colours.failed[n])}
                {n === 3 ? "all 3" : `${n} of 3`}
              </span>
            ))}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5">{legendSwatch(colours.bad)}Not a good day</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5">
            {WARNING_SWATCHES.map((c) => (
              <span key={c} className="inline-block h-[11px] w-[11px] rounded-sm" style={{ boxShadow: `inset 0 0 0 2px ${c}` }} />
            ))}
          </span>
          MetService warning
        </span>
      </div>

      {showStats && stats.recordedDays > 0 ? (
        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            [`${goodPct}%`, `of ${stats.recordedDays} days were good`],
            stats.longestRun
              ? [`${stats.longestRun.length} ${stats.longestRun.length === 1 ? "day" : "days"}`,
                 stats.longestRun.length === 1 ? `longest run, ${fmtDay(stats.longestRun.start)}` : `longest run, ${fmtDay(stats.longestRun.start)}–${fmtDay(stats.longestRun.end)}`]
              : null,
            stats.bestMonth ? [MONTH_NAMES[stats.bestMonth.month], `best month, ${stats.bestMonth.good} of ${stats.bestMonth.total} days`] : null,
            [String(stats.warningDays), "days under a MetService warning"],
            [String(stats.failedAllThree), "days that failed on all three"],
          ]
            .filter((s): s is string[] => s !== null)
            .map(([value, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
                <dd className={`text-xs ${muted}`}>{label}</dd>
              </div>
            ))}
        </dl>
      ) : null}

      {tip ? <GridTip tip={tip} /> : null}
    </div>
  );
}

function GridTip({ tip }: { tip: Tip }) {
  const { cell } = tip;
  const checks = cell.checks!;
  const items = [
    { Icon: Thermometer, ok: checks.temp, name: "Temperature" },
    { Icon: Wind, ok: checks.wind, name: "Wind" },
    { Icon: Droplet, ok: checks.rain, name: "Rain" },
  ];
  // Keep the tooltip on screen near the edges.
  // Flips below the square when there's no room above it.
  const left = Math.min(Math.max(tip.left, 90), window.innerWidth - 90);
  const below = tip.top < 90;
  return (
    <div
      role="tooltip"
      className={`pointer-events-none fixed z-50 -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-2 text-xs text-white shadow-lg ${below ? "" : "-translate-y-full"}`}
      style={{ left, top: below ? tip.top + CELL + 20 : tip.top - 8 }}
    >
      <p className="font-semibold mb-1.5 whitespace-nowrap">{format(parseISO(cell.date), "EEE d MMMM")}</p>
      <div className="flex gap-3">
        {items.map(({ Icon, ok, name }) => (
          <span key={name} className="inline-flex items-center gap-0.5">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {ok ? <Check className="h-3.5 w-3.5 text-green-400" aria-hidden /> : <X className="h-3.5 w-3.5 text-red-400" aria-hidden />}
            <span className="sr-only">{name} {ok ? "passed" : "failed"}</span>
          </span>
        ))}
      </div>
      {cell.warning ? (
        <p className="mt-1.5 flex items-center gap-1 whitespace-nowrap">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: cell.warning.colour }} aria-hidden />
          {cell.warning.colourName} warning
        </p>
      ) : null}
    </div>
  );
}
