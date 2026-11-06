"use server";

import { revalidatePath } from "next/cache";
import { castVote, type VoteType } from "@/lib/votes";
import { getTodaysNZTDate } from "@/lib/weather";
import { recordDisagreeReason } from "@/lib/vote-reasons";
import { isValidReason, isVerdict, type Verdict } from "@/lib/disagree-reasons";

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
  const result = await castVote(date, type, token);
  // The home page is cached for an hour, so without this its counts lag behind
  // the database. From a Server Action this also re-renders the voter's page.
  if (!result.alreadyVoted) revalidatePath("/");
  return result;
}

// The optional "why do you disagree?" follow-up. Same public-endpoint rules as
// voting: today only, a well-formed token, and a reason from the fixed list
// for that verdict. recordDisagreeReason() also requires that the token
// voted today. No revalidatePath: reasons aren't shown on the page, so there's
// nothing to refresh. A failure (e.g. the table not yet created) is logged
// and swallowed, since the vote itself has already been saved.
export async function castDisagreeReasonAction(date: string, verdict: Verdict, reason: string, token: string) {
  if (!isVerdict(verdict) || !isValidReason(verdict, reason)) throw new Error("Invalid reason");
  if (typeof token !== "string" || !UUID_RE.test(token)) throw new Error("Invalid voter token");
  if (date !== getTodaysNZTDate()) throw new Error("Reasons can only be given for today");
  try {
    return { recorded: await recordDisagreeReason(date, verdict, reason, token) };
  } catch (error) {
    console.error("Recording disagree reason failed:", error);
    return { recorded: false };
  }
}
