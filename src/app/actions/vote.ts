"use server";

import { castVote, type VoteType } from "@/lib/votes";
import { getTodaysNZTDate } from "@/lib/weather";

const VALID_TYPES: VoteType[] = ["agree", "disagree"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server Actions are a public HTTP endpoint — every argument is
// attacker-controllable regardless of what VotingButtons sends. Votes are
// only ever accepted for today (NZT): without the date check, anyone could
// rewrite the vote counts of any historical day, and increment_vote() itself
// silently ignores unknown vote types rather than rejecting them.
export async function castVoteAction(date: string, type: VoteType, token: string) {
  if (!VALID_TYPES.includes(type)) throw new Error("Invalid vote type");
  if (typeof token !== "string" || !UUID_RE.test(token)) throw new Error("Invalid voter token");
  if (date !== getTodaysNZTDate()) throw new Error("Votes can only be cast for today");
  return castVote(date, type, token);
}
