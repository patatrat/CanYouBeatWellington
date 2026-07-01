// Maps a special_date_defs.background_key value to a Tailwind gradient
// class. Kept in code (not raw CSS from the DB) so nothing from the
// database ever lands directly in a className — new backgrounds need a
// one-line code change + redeploy, which is fine for a hobby project.
//
// `dark: true` marks near-black gradients — the home page swaps its
// gray-on-light text classes for light ones so the page stays readable.
export interface SpecialBackground {
  className: string;
  dark?: boolean;
}

export const SPECIAL_BACKGROUNDS: Record<string, SpecialBackground> = {
  anniversary: { className: "bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100" },
  matariki: { className: "bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950", dark: true },
  rugby: { className: "bg-gradient-to-br from-slate-800 via-zinc-800 to-slate-900", dark: true },
  festive: { className: "bg-gradient-to-br from-red-50 via-rose-50 to-red-100" },
};
