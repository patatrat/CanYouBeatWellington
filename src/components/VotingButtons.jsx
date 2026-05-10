import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { track } from '@vercel/analytics';

// Returns a persistent UUID for this browser, creating one if needed.
// Used server-side to enforce one vote per browser identity per day.
const getVoterToken = () => {
  let token = localStorage.getItem('voter_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('voter_token', token);
  }
  return token;
};

const VotingButtons = ({ weatherRecord }) => {
  const [hasVoted, setHasVoted] = useState(false);
  const [voteError, setVoteError] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (weatherRecord?.date) {
      const voteKey = `voted_${weatherRecord.date}`;
      const hasVotedToday = localStorage.getItem(voteKey) === 'true';
      setHasVoted(hasVotedToday);
    }
  }, [weatherRecord?.date]);

  const updateVoteMutation = useMutation({
    mutationFn: async ({ voteType }) => {
      const { error } = await supabase.rpc('increment_vote', {
        record_date: weatherRecord.date,
        vote_type: voteType,
        voter_token: getVoterToken(),
      });
      if (error) {
        // 23505 = unique_violation: this token already voted today
        if (error.code === '23505') {
          return { alreadyVoted: true };
        }
        throw error;
      }
      return { alreadyVoted: false };
    },
    onSuccess: (result, variables) => {
      setVoteError(false);
      const voteKey = `voted_${weatherRecord.date}`;
      localStorage.setItem(voteKey, 'true');
      setHasVoted(true);

      if (!result.alreadyVoted) {
        track('vote', { type: variables.voteType, date: weatherRecord.date });
        queryClient.invalidateQueries({ queryKey: ['todaysRecord'] });
      }
    },
    onError: (error) => {
      console.error('Error updating vote:', error);
      setVoteError(true);
    }
  });

  const handleVote = (voteType) => {
    if (!hasVoted) {
      setVoteError(false);
      updateVoteMutation.mutate({ voteType });
    }
  };

  return (
    <div className="flex justify-center space-x-8 mt-6">
      <div className="flex flex-col items-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleVote('agree')}
          disabled={hasVoted || updateVoteMutation.isPending}
          className="mb-2 hover:bg-green-50 hover:border-green-300"
          title="I agree with this assessment"
        >
          <ThumbsUp className="h-6 w-6 text-green-600" />
        </Button>
        <span className="text-sm font-medium text-green-600">
          {weatherRecord.agree_count || 0}
        </span>
      </div>

      <div className="flex flex-col items-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleVote('disagree')}
          disabled={hasVoted || updateVoteMutation.isPending}
          className="mb-2 hover:bg-red-50 hover:border-red-300"
          title="I disagree with this assessment"
        >
          <ThumbsDown className="h-6 w-6 text-red-600" />
        </Button>
        <span className="text-sm font-medium text-red-600">
          {weatherRecord.disagree_count || 0}
        </span>
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
