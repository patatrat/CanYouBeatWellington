// The optional follow-up asked after a "disagree" vote: why the voter thinks
// the verdict was wrong. Fixed options only (no free text, so nothing to
// moderate). Shared by the client prompt and the server action, so the
// server can reject anything that isn't on the list. No DB import, so it's
// safe in client components.

export type Verdict = "good" | "bad";

interface ReasonOption {
  key: string;
  label: string;
}

interface ReasonPrompt {
  question: string;
  options: ReasonOption[];
}

export const DISAGREE_REASONS: Record<Verdict, ReasonPrompt> = {
  // The site said it's a good day; the voter says it isn't.
  good: {
    question: "What's wrong with it?",
    options: [
      { key: "too_cold", label: "Too cold" },
      { key: "too_windy", label: "Too windy" },
      { key: "rained", label: "It rained" },
      { key: "not_here", label: "Not like that where I am" },
      { key: "other", label: "Other" },
    ],
  },
  // The site said it's not a good day; the voter says it is.
  bad: {
    question: "What did we get wrong?",
    options: [
      { key: "warm_enough", label: "Warm enough" },
      { key: "wind_ok", label: "Wind's not that bad" },
      { key: "rain_ok", label: "Rain wasn't a problem" },
      { key: "nice_here", label: "It's nice where I am" },
      { key: "other", label: "Other" },
    ],
  },
};

export const isVerdict = (value: unknown): value is Verdict => value === "good" || value === "bad";

export const isValidReason = (verdict: Verdict, reason: unknown): reason is string =>
  DISAGREE_REASONS[verdict].options.some((o) => o.key === reason);
