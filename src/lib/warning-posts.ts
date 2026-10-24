import { formatNZTime, type WeatherWarning } from "./weather-warnings";

// Which Wellington warnings the bot should post about. Only orange and red
// ones: yellow watches are too routine to be worth a toot.
//
// MetService reissues a warning roughly every 12 hours under a new
// identifier, with <references> pointing at the one it replaces. So a
// warning counts as already posted if any alert it references was posted.
// The exception is an upgrade to red, which is posted again.

export const POSTABLE = ["Orange", "Red"];

export interface WarningPlan {
  // Warnings to post, with whether this is a first post or an upgrade.
  post: { warning: WeatherWarning; kind: "new" | "upgrade" }[];
  // Reissues of something already posted: recorded so later reissues still
  // chain back to it, but not posted again.
  record: WeatherWarning[];
}

// posted maps alert identifier → colour it was posted (or recorded) at.
export function planWarningPosts(warnings: WeatherWarning[], posted: Record<string, string>): WarningPlan {
  const plan: WarningPlan = { post: [], record: [] };
  for (const warning of warnings) {
    if (!POSTABLE.includes(warning.colourName) || posted[warning.id]) continue;

    const earlier = warning.references.map((id) => posted[id]).filter(Boolean);
    if (earlier.length === 0) {
      plan.post.push({ warning, kind: "new" });
    } else if (warning.colourName === "Red" && !earlier.includes("Red")) {
      plan.post.push({ warning, kind: "upgrade" });
    } else {
      plan.record.push(warning);
    }
  }
  return plan;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const WARNING_HASHTAGS = ["Wellington", "WellingtonWeather"];

// The toot body. Everything from the feed is escaped, since it ends up as
// HTML on every follower's server.
export function buildWarningPostHtml(warning: WeatherWarning, kind: "new" | "upgrade"): string {
  const icon = warning.colourName === "Red" ? "🔴" : "🟠";
  const when = warning.onset
    ? `${formatNZTime(warning.onset)} – ${formatNZTime(warning.expires)}`
    : `Until ${formatNZTime(warning.expires)}`;
  const lead = kind === "upgrade" ? "Now upgraded: " : "";

  return (
    `<p>${icon} ${lead}<strong>${escapeHtml(warning.headline)}</strong> for Wellington<br>${when}</p>` +
    `<p>${escapeHtml(warning.description)}</p>` +
    (warning.instruction ? `<p>${escapeHtml(warning.instruction)}</p>` : "") +
    `<p>Details from <a href="${escapeHtml(warning.web)}">MetService</a> · ` +
    `Preparedness advice from <a href="https://getready.govt.nz/">NEMA</a></p>` +
    `<p>${WARNING_HASHTAGS.map((t) => `#${t}`).join(" ")}</p>`
  );
}

// A stable, URL-safe note id for a warning post.
export const warningNoteSuffix = (warning: WeatherWarning) =>
  `warning-${warning.id.replace(/[^A-Za-z0-9]+/g, "-")}`;
