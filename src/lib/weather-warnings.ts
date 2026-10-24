// MetService severe weather watches and warnings for Wellington, from its
// public CAP (Common Alerting Protocol) feed. Licensed CC BY 4.0, so the
// banner credits MetService and links back to it.
//
// The RSS index doesn't say which region each alert covers, so every listed
// alert is fetched and kept only if one of its area polygons contains the
// same Wellington point we fetch weather for. That's sturdier than matching
// area names, which vary ("Wellington", "Wellington and Kapiti Coast", ...).

const FEED_URL = "https://alerts.metservice.com/cap/rss";
const WELLINGTON = { lat: -41.2866, lon: 174.7756 };
// Matches the home page's own revalidate window, so the warnings never force
// the page to regenerate (and wake Neon) more often than it already does.
const REVALIDATE_SECONDS = 3600;
const TIMEOUT_MS = 5000;

export interface WeatherWarning {
  id: string;
  headline: string;
  description: string;
  instruction: string | null;
  onset: string | null;
  expires: string;
  colour: string;
  colourName: string;
  web: string;
  // Identifiers of the earlier alerts this one replaces. MetService reissues
  // each warning roughly every 12 hours under a new identifier, pointing
  // back at the one it updates.
  references: string[];
}

const tag = (xml: string, name: string): string | null => {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decodeEntities(match[1].trim()) : null;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

const parameter = (xml: string, name: string): string | null => {
  const match = xml.match(new RegExp(`<valueName>${name}</valueName>\\s*<value>([^<]*)</value>`));
  return match ? match[1].trim() : null;
};

// Ray casting. CAP polygons are "lat,lon lat,lon ..." pairs.
export function polygonContains(polygon: string, lat: number, lon: number): boolean {
  const points = polygon
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number));
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [latI, lonI] = points[i];
    const [latJ, lonJ] = points[j];
    if (lonI > lon !== lonJ > lon && lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI) {
      inside = !inside;
    }
  }
  return inside;
}

// Returns the alert if it's a live, public one covering Wellington, else null.
export function parseWellingtonAlert(xml: string, now: Date): WeatherWarning | null {
  if (tag(xml, "status") !== "Actual" || tag(xml, "scope") !== "Public") return null;
  if (tag(xml, "msgType") === "Cancel") return null;

  const expires = tag(xml, "expires");
  if (!expires || new Date(expires) <= now) return null;

  const polygons = [...xml.matchAll(/<polygon>([^<]+)<\/polygon>/g)].map((m) => m[1]);
  if (!polygons.some((p) => polygonContains(p, WELLINGTON.lat, WELLINGTON.lon))) return null;

  return {
    id: tag(xml, "identifier") ?? expires,
    headline: tag(xml, "headline") ?? "Severe weather alert",
    description: tag(xml, "description") ?? "",
    instruction: tag(xml, "instruction"),
    onset: tag(xml, "onset"),
    expires,
    colour: parameter(xml, "ColourCodeHex") ?? "#FFD400",
    colourName: parameter(xml, "ColourCode") ?? "Yellow",
    web: tag(xml, "web") ?? "https://www.metservice.com/warnings/home",
    // CAP references are space-separated "sender,identifier,sent" triples.
    references: (tag(xml, "references") ?? "")
      .split(/\s+/)
      .map((ref) => ref.split(",")[1])
      .filter((id): id is string => Boolean(id)),
  };
}

const RANK: Record<string, number> = { Red: 0, Orange: 1, Yellow: 2 };

// Most severe first, then soonest.
export function sortWarnings(warnings: WeatherWarning[]): WeatherWarning[] {
  return [...warnings].sort(
    (a, b) =>
      (RANK[a.colourName] ?? 3) - (RANK[b.colourName] ?? 3) ||
      (a.onset ?? a.expires).localeCompare(b.onset ?? b.expires),
  );
}

const nzDate = (iso: string | number) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

// The most severe warning in force at any point during an NZ calendar day
// (YYYY-MM-DD), or null. Expects sortWarnings() order. A warning with no
// onset is already in force, so it covers every day up to its expiry.
export function warningForDay(date: string, warnings: WeatherWarning[]): WeatherWarning | null {
  return (
    warnings.find(
      (w) =>
        (w.onset === null || nzDate(w.onset) <= date) &&
        // A warning ending exactly at midnight doesn't touch the next day.
        nzDate(new Date(w.expires).getTime() - 1) >= date,
    ) ?? null
  );
}

// For the History calendar: each NZ day any warning touched → the most
// severe one that day. Days are walked with UTC dates, which is safe for
// plain YYYY-MM-DD stepping.
export type WarningDay = Pick<WeatherWarning, "headline" | "colour" | "colourName">;

export function warningsByDay(warnings: WeatherWarning[]): Record<string, WarningDay> {
  const days: Record<string, WarningDay> = {};
  for (const w of sortWarnings(warnings)) {
    const last = nzDate(new Date(w.expires).getTime() - 1);
    const start = new Date(`${nzDate(w.onset ?? w.expires)}T00:00:00Z`);
    for (let d = start; d.toISOString().slice(0, 10) <= last; d = new Date(d.getTime() + 86_400_000)) {
      const key = d.toISOString().slice(0, 10);
      days[key] ??= { headline: w.headline, colour: w.colour, colourName: w.colourName };
    }
  }
  return days;
}

// "6pm Mon 26 Oct" in NZ time. The server runs in UTC, so this can't use
// date-fns' local-time formatting.
export function formatNZTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const minutes = parts.minute === "00" ? "" : `:${parts.minute}`;
  return `${parts.hour}${minutes}${parts.dayPeriod.toLowerCase().replace(/\./g, "")} ${parts.weekday} ${parts.day} ${parts.month}`;
}

const fetchText = async (url: string, fresh: boolean) => {
  const res = await fetch(url, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
};

// Never throws: a MetService outage must not take the home page down with
// it, so any failure just means no banner. `fresh` skips the fetch cache,
// for the warning-posting cron, which shouldn't act on hour-old data.
export async function getWellingtonWarnings(now = new Date(), { fresh = false } = {}): Promise<WeatherWarning[]> {
  try {
    const rss = await fetchText(FEED_URL, fresh);
    const links = [...rss.matchAll(/<link>(https:\/\/alerts\.metservice\.com\/cap\/alert\?id=[^<]+)<\/link>/g)].map(
      (m) => decodeEntities(m[1]),
    );
    const alerts = await Promise.allSettled(links.map((link) => fetchText(link, fresh)));
    const warnings = alerts
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => parseWellingtonAlert(r.value, now))
      .filter((w): w is WeatherWarning => w !== null);
    return sortWarnings(warnings);
  } catch (err) {
    console.error("Weather warnings unavailable:", err);
    return [];
  }
}
