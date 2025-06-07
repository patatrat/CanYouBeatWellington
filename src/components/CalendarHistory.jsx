
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Check, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from "@/lib/utils";

const CalendarHistory = ({ history }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create a map of dates to weather records for quick lookup
  const historyMap = React.useMemo(() => {
    const map = new Map();
    if (history) {
      history.forEach(record => {
        // Ensure we're working with the exact date string from the database
        // without any timezone conversion issues
        const dateString = record.date; // This should already be in YYYY-MM-DD format
        map.set(dateString, record);
      });
    }
    return map;
  }, [history]);

  // Custom day renderer to show tick/cross and voting indicators for each day
  const dayRenderer = (day) => {
    // Format the date to match the database format (YYYY-MM-DD)
    // Use the local date without timezone conversion
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(day.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${dayOfMonth}`;
    
    const record = historyMap.get(dateString);
    const hasData = !!record;
    const isGoodDay = record?.is_good_day;
    const agreeCount = record?.agree_count || 0;
    const disagreeCount = record?.disagree_count || 0;
    const totalVotes = agreeCount + disagreeCount;

    // Determine which vote indicator to show
    let voteIndicator = null;
    if (totalVotes > 0) {
      if (agreeCount > disagreeCount) {
        voteIndicator = <ThumbsUp className="w-2.5 h-2.5 text-green-600" />;
      } else if (disagreeCount > agreeCount) {
        voteIndicator = <ThumbsDown className="w-2.5 h-2.5 text-red-600" />;
      }
      // If equal votes, show nothing
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className="text-sm">{day.getDate()}</span>
        {hasData && (
          <div className="absolute -top-1 -right-1 flex flex-col items-center space-y-0.5">
            {isGoodDay ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-red-500" />
            )}
            {voteIndicator}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center space-x-2">
          <Check className="w-4 h-4 text-green-500" />
          <span className="text-sm">Good Day</span>
        </div>
        <div className="flex items-center space-x-2">
          <X className="w-4 h-4 text-red-500" />
          <span className="text-sm">Not a Good Day</span>
        </div>
        <div className="flex items-center space-x-2">
          <ThumbsUp className="w-4 h-4 text-green-600" />
          <span className="text-sm">Most Agree</span>
        </div>
        <div className="flex items-center space-x-2">
          <ThumbsDown className="w-4 h-4 text-red-600" />
          <span className="text-sm">Most Disagree</span>
        </div>
        <div className="text-sm text-gray-500">
          No symbol = No data
        </div>
      </div>
      
      <Calendar
        mode="single"
        month={currentMonth}
        onMonthChange={setCurrentMonth}
        className="rounded-md border pointer-events-auto"
        classNames={{
          day: cn(
            "h-12 w-12 p-0 font-normal relative",
            "hover:bg-accent hover:text-accent-foreground",
            "focus:bg-accent focus:text-accent-foreground"
          ),
        }}
        components={{
          Day: ({ date, ...props }) => (
            <div {...props} className={cn(props.className, "relative")}>
              {dayRenderer(date)}
            </div>
          ),
        }}
      />
    </div>
  );
};

export default CalendarHistory;
