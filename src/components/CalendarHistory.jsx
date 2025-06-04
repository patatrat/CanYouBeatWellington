
import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Check, X } from 'lucide-react';
import { cn } from "@/lib/utils";

const CalendarHistory = ({ history }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create a map of dates to weather records for quick lookup
  const historyMap = React.useMemo(() => {
    const map = new Map();
    if (history) {
      history.forEach(record => {
        map.set(record.date, record.is_good_day);
      });
    }
    return map;
  }, [history]);

  // Custom day renderer to show tick/cross for each day
  const dayRenderer = (day) => {
    const dateString = day.toISOString().split('T')[0];
    const hasData = historyMap.has(dateString);
    const isGoodDay = historyMap.get(dateString);

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className="text-sm">{day.getDate()}</span>
        {hasData && (
          <div className="absolute -top-1 -right-1">
            {isGoodDay ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <X className="w-3 h-3 text-red-500" />
            )}
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
