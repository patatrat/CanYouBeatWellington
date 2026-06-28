// Maps a special_date_defs.background_key value to a Tailwind gradient
// class. Kept in code (not raw CSS from the DB) so nothing from the
// database ever lands directly in a className — new backgrounds need a
// one-line code change + redeploy, which is fine for a hobby project.
export const SPECIAL_BACKGROUNDS: Record<string, string> = {
  anniversary: "bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100",
  matariki: "bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950",
  sevens: "bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100",
};
