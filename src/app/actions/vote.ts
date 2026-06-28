"use server";

import { castVote, type VoteType } from "@/lib/votes";

export async function castVoteAction(date: string, type: VoteType, token: string) {
  return castVote(date, type, token);
}
