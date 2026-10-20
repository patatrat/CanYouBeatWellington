import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ExternalLink } from "lucide-react";
import { getTodaysNZTDate } from "@/lib/weather";
import { getSeasonLabel } from "@/utils/rulesStorage";
import { getSeasonClockAngle, CLOCK_CENTRE } from "@/utils/seasonClock";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Wellington's Six Seasons, Including Shitsville — Can You Beat Wellington?",
  description: "Where are we in the Wellington year? A seasons clock for Summer, Autumn, Winter, Spring 1, Shitsville and Spring 2 that moves every day.",
  alternates: { canonical: "/seasons" },
};

// No DB call here, so this costs nothing in Neon compute. Hourly keeps the
// hand at most an hour late after NZ midnight, same as the home page.
export const revalidate = 3600;

const HAND_LENGTH = 440; // reaches just past the ring's inner edge (~431px)

export default function SeasonsPage() {
  const today = getTodaysNZTDate();
  const angle = getSeasonClockAngle(today);
  const { x, y } = CLOCK_CENTRE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100">
      <SiteNav current="seasons" />

      <div className="max-w-2xl mx-auto px-6 py-16">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-800 mb-2">The Wellington seasons</h1>
          <p className="text-gray-500">
            {format(parseISO(today), "EEEE d MMMM")} · {getSeasonLabel(today)} season
          </p>
        </header>

        <div className="relative mx-auto w-full max-w-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image isn't used anywhere in this app */}
          <img
            src="/wellington-seasons-calendar.png"
            alt={`A ring-shaped calendar of Wellington's seasons: Summer, Autumn, Winter, Spring 1, Shitsville and Spring 2. A clock hand points to today, ${format(parseISO(today), "d MMMM")}.`}
            width={1200}
            height={1201}
            className="w-full h-auto"
          />
          {/* Same coordinate space as the image, so the hand pivots on the ring's centre. */}
          <svg viewBox="0 0 1200 1201" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <g transform={`rotate(${angle.toFixed(2)} ${x} ${y})`} className="text-gray-800">
              <line x1={x} y1={y + 60} x2={x} y2={y - HAND_LENGTH + 30} stroke="currentColor" strokeWidth={14} strokeLinecap="round" />
              <path d={`M ${x} ${y - HAND_LENGTH} l -22 48 h 44 z`} fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth={6} />
            </g>
            <circle cx={x} cy={y} r={22} className="fill-gray-800" />
            <circle cx={x} cy={y} r={8} className="fill-amber-300" />
          </svg>
        </div>

        <p className="text-gray-700 mt-10">
          Wellington doesn&apos;t do four seasons. It does six: Summer (January to March), Autumn
          (April to June), Winter (July and August), Spring 1 (September), Shitsville (October and
          November) and Spring 2 (December). The hand moves a little every day, so you can see
          exactly how much of the current season is left. Each season has its own bar for a{" "}
          <Link href="/about" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
            good day
          </Link>.
        </p>

        <p className="text-center text-sm text-gray-500 mt-6">
          Calendar by{" "}
          <a href="https://adam.nz/realistic-calendar" target="_blank" rel="noopener" className="text-amber-700 hover:text-amber-900 underline underline-offset-2">
            Adam Shand <ExternalLink className="inline-block w-3.5 h-3.5 ml-0.5" />
          </a>
        </p>
      </div>
    </div>
  );
}
