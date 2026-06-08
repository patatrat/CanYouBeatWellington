"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { track } from "@vercel/analytics";
import { Button } from "@/components/ui/button";
import { castVoteAction } from "@/app/actions/vote";
import type { VoteType } from "@/lib/votes";

// Returns a persistent UUID for this browser, creating one if needed.
// Used server-side to enforce one vote per browser identity per day.
const getVoterToken = (): string => {
  let token = localStorage.getItem("voter_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("voter_token", token);
  }
  return token;
};

interface VotingButtonsProps {
  date: string;
  agreeCount: number;
  disagreeCount: number;
}

const VotingButtons = ({ date, agreeCount, disagreeCount }: VotingButtonsProps) => {
  const [counts, setCounts] = useState({ agree: agreeCount, disagree: disagreeCount });
  const [hasVoted, setHasVoted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [voteError, setVoteError] = useState(false);

  useEffect(() => {
    // Read after mount, not during render — localStorage doesn't exist on the
    // server, and reading it during the initial client render would produce a
    // hydration mismatch against the server-rendered (always "not voted") HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasVoted(localStorage.getItem(`voted_${date}`) === "true");
  }, [date]);

  const handleVote = async (voteType: VoteType) => {
    if (hasVoted || isPending) return;
    setVoteError(false);
    setIsPending(true);
    try {
      const result = await castVoteAction(date, voteType, getVoterToken());
      localStorage.setItem(`voted_${date}`, "true");
      setHasVoted(true);
      if (!result.alreadyVoted) {
        track("vote", { type: voteType, date });
        setCounts((prev) => ({ ...prev, [voteType]: prev[voteType] + 1 }));
      }
    } catch (error) {
      console.error("Error updating vote:", error);
      setVoteError(true);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex justify-center space-x-8 mt-6">
      <div className="flex flex-col items-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleVote("agree")}
          disabled={hasVoted || isPending}
          className="mb-2 hover:bg-green-50 hover:border-green-300"
          title="I agree with this assessment"
        >
          <ThumbsUp className="h-6 w-6 text-green-600" />
        </Button>
        <span className="text-sm font-medium text-green-600">{counts.agree}</span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleVote("disagree")}
          disabled={hasVoted || isPending}
          className="mb-2 hover:bg-red-50 hover:border-red-300"
          title="I disagree with this assessment"
        >
          <ThumbsDown className="h-6 w-6 text-red-600" />
        </Button>
        <span className="text-sm font-medium text-red-600">{counts.disagree}</span>
      </div>

      {voteError && (
        <p className="text-xs text-red-500 text-center mt-3">
          Couldn&apos;t record your vote — please try again.
        </p>
      )}
    </div>
  );
};

export default VotingButtons;
