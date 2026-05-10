import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import CalendarHistory from '../components/CalendarHistory';
import MonthlyGoodDaysChart from '../components/MonthlyGoodDaysChart';
import MonthlyAveragesChart from '../components/MonthlyAveragesChart';
import SeasonBreakdown from '../components/SeasonBreakdown';
import FunFacts from '../components/FunFacts';

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from('daily_weather_records')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
};

const Section = ({ title, subtitle, children }) => (
  <section className="mb-14">
    <h2 className="text-lg font-bold uppercase tracking-widest text-gray-400 mb-1">{title}</h2>
    {subtitle && <p className="text-sm text-gray-400 mb-5">{subtitle}</p>}
    {!subtitle && <div className="mb-5" />}
    {children}
  </section>
);

const History = () => {
  const { data: history, isLoading, error } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory,
  });

  React.useEffect(() => {
    document.title = "The Record — Can You Beat Wellington?";
    return () => {
      document.title = "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?";
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200">

      <nav className="absolute top-4 right-5 flex gap-5 text-sm font-medium text-gray-500">
        <Link to="/" className="hover:text-gray-800 transition-colors">Today</Link>
        <Link to="/about" className="hover:text-gray-800 transition-colors">Why though?</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-14">

        <header className="text-center mb-12">
          <h1 className="text-4xl font-black text-gray-800 mb-2">The record.</h1>
          <p className="text-gray-500">Every Wellington day, judged.</p>
        </header>

        {isLoading && <p className="text-center text-gray-400 py-20">Loading history...</p>}
        {error && <p className="text-center text-red-500">Error loading history: {error.message}</p>}

        {history && (
          <>
            <Section title="Did you know">
              <FunFacts history={history} />
            </Section>

            <Section
              title="Last 12 months"
              subtitle="Good days per month. Navigate with the arrows to go further back."
            >
              <MonthlyGoodDaysChart history={history} />
            </Section>

            <Section
              title="Season breakdown"
              subtitle="Percentage of good days per season, across all years of data."
            >
              <SeasonBreakdown history={history} />
            </Section>

            <Section
              title="Monthly patterns"
              subtitle="Which months typically deliver? Aggregated across all years."
            >
              <MonthlyAveragesChart history={history} />
            </Section>

            <Section title="Calendar">
              <CalendarHistory history={history} />
            </Section>
          </>
        )}

      </div>
    </div>
  );
};

export default History;
