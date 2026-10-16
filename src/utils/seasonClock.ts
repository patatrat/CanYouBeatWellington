// Positions the clock hand on public/wellington-seasons-calendar.png (Adam
// Shand's realistic Wellington calendar).
//
// The image's segments aren't drawn in proportion to their length in days
// (Shitsville is ~92° for 61 days, Summer ~63° for 90), so one angle-per-day
// rate would drift into the wrong segment. Instead, each day is placed by how
// far through its own season block it is, then mapped onto that block's arc.
// The hand always sits inside the segment the rest of the app says we're in.
//
// Angles are degrees clockwise from 12 o'clock, measured from the image's
// own pixels (the radial boundary lines). Re-measure if the image changes.
interface Arc {
  // getSeasonLabel() values this arc covers — the image has one Autumn
  // segment, while rulesStorage splits it into Autumn + Late Autumn.
  seasons: string[];
  // UTC month numbers (0 = Jan), contiguous, within one calendar year.
  months: number[];
  start: number;
  end: number;
}

export const SEASON_ARCS: Arc[] = [
  { seasons: ["Summer"], months: [0, 1, 2], start: 13.75, end: 76.4 },
  { seasons: ["Autumn", "Late Autumn"], months: [3, 4, 5], start: 76.4, end: 166.45 },
  { seasons: ["Winter"], months: [6, 7], start: 166.45, end: 224.05 },
  { seasons: ["Spring 1"], months: [8], start: 224.05, end: 254.1 },
  { seasons: ["Shitsville"], months: [9, 10], start: 254.1, end: 346 },
  // Straddles 12 o'clock, so end runs past 360.
  { seasons: ["Spring 2"], months: [11], start: 346, end: 373.75 },
];

// Centre of the ring in the 1200×1201 image, also measured.
export const CLOCK_CENTRE = { x: 599, y: 600 };

const DAY_MS = 86_400_000;

export const findSeasonArc = (date: string): Arc => {
  const month = Number(date.slice(5, 7)) - 1;
  const arc = SEASON_ARCS.find((a) => a.months.includes(month));
  if (!arc) throw new Error(`No season arc for ${date}`);
  return arc;
};

// date is a YYYY-MM-DD string (e.g. getTodaysNZTDate()). Uses the middle of
// the day so the hand never sits exactly on a segment boundary line.
export const getSeasonClockAngle = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  const arc = findSeasonArc(date);
  const blockStart = Date.UTC(y, arc.months[0], 1);
  const blockEnd = Date.UTC(y, arc.months[arc.months.length - 1] + 1, 1);
  const progress = (Date.UTC(y, m - 1, d) - blockStart + DAY_MS / 2) / (blockEnd - blockStart);
  return (arc.start + progress * (arc.end - arc.start)) % 360;
};
