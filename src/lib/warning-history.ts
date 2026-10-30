import { kv } from "@vercel/kv";
import { sql } from "./db";
import type { WeatherWarning } from "./weather-warnings";

// Neon-backed record of every warning that has covered Wellington, kept
// separate from weather-warnings.ts so the pure parsing code (and its tests)
// never import the DB client.

// A KV marker per recorded alert, so the every-30-minutes cron only wakes
// Neon when a genuinely new alert appears, not on every run. Neon's free
// tier bills compute time, and waking it 48 times a day would cost hours.
const RECORDED_TTL_SECONDS = 60 * 60 * 24 * 30;
const recordedKey = (id: string) => `cybw:warning-recorded:${id}`;

export async function recordWarnings(warnings: WeatherWarning[]): Promise<number> {
  if (warnings.length === 0) return 0;
  const seen = await kv.mget<(string | null)[]>(...warnings.map((w) => recordedKey(w.id)));
  const fresh = warnings.filter((_, i) => !seen[i]);

  for (const w of fresh) {
    await sql`
      INSERT INTO weather_warnings (id, headline, colour_name, colour, onset, expires, description, refs)
      VALUES (${w.id}, ${w.headline}, ${w.colourName}, ${w.colour}, ${w.onset}, ${w.expires}, ${w.description}, ${w.references})
      ON CONFLICT (id) DO NOTHING
    `;
    await kv.set(recordedKey(w.id), "1", { ex: RECORDED_TTL_SECONDS });
  }
  return fresh.length;
}

// Every recorded warning, shaped like a live one. Only tens of rows a year,
// so the History page reads them all. Returns [] on failure rather than
// breaking the page over a decoration.
export async function getRecordedWarnings(): Promise<WeatherWarning[]> {
  try {
    const rows = await sql`
      SELECT id, headline, colour_name, colour, onset, expires, description, refs
      FROM weather_warnings
    `;
    return rows.map((r) => ({
      id: r.id,
      // Not stored: only the posting cron uses it, and it reads live alerts.
      event: "unknown",
      headline: r.headline,
      description: r.description,
      instruction: null,
      onset: r.onset ? new Date(r.onset).toISOString() : null,
      expires: new Date(r.expires).toISOString(),
      colour: r.colour,
      colourName: r.colour_name,
      web: "https://www.metservice.com/warnings/home",
      references: r.refs ?? [],
    }));
  } catch (err) {
    console.error("Recorded warnings unavailable:", err);
    return [];
  }
}
