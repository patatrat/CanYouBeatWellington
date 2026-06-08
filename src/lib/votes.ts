import { sql } from "./db";

export type VoteType = "agree" | "disagree";

export async function castVote(
  date: string,
  type: VoteType,
  token: string
): Promise<{ alreadyVoted: boolean }> {
  try {
    await sql`SELECT increment_vote(${date}::date, ${type}, ${token})`;
    return { alreadyVoted: false };
  } catch (error) {
    // 23505 = unique_violation: this token already voted today
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { alreadyVoted: true };
    }
    throw error;
  }
}
