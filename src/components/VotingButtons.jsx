import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { trackVote } from '../utils/analytics';

const VotingButtons = ({ weatherRecord }) => {
  const [hasVoted, setHasVoted] = useState(false);
  const queryClient = useQueryClient();

  // Check if user has already voted today by storing vote status in localStorage with date
  useEffect(() => {
    if (weatherRecord?.date) {
      const voteKey = `voted_${weatherRecord.date}`;
      const hasVotedToday = localStorage.getItem(voteKey) === 'true';
      setHasVoted(hasVotedToday);
    }
  }, [weatherRecord?.date]);

  const updateVoteMutation = useMutation({
    mutationFn: async ({ voteType }) => {
      const column = voteType === 'agree' ? 'agree_count' : 'disagree_count';
      const currentCount = weatherRecord[column] || 0;
      
      const { data, error } = await supabase
        .from('daily_weather_records')
        .update({ [column]: currentCount + 1 })
        .eq('date', weatherRecord.date)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Mark as voted for today in localStorage
      const voteKey = `voted_${weatherRecord.date}`;
      localStorage.setItem(voteKey, 'true');
      setHasVoted(true);
      
      // Track the vote in Google Analytics
      trackVote(variables.voteType, weatherRecord.date);
      
      // Refetch the weather data to update the counts
      queryClient.invalidateQueries(['weather']);
    },
    onError: (error) => {
      console.error('Error updating vote:', error);
    }
  });

  const handleVote = (voteType) => {
    if (!hasVoted) {
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
        <span className="text-xs text-gray-500">Agree</span>
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
        <span className="text-xs text-gray-500">Disagree</span>
      </div>
    </div>
  );
};

export default VotingButtons;
