import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import CalendarHistory from '../components/CalendarHistory';
import MonthlyGoodDaysChart from '../components/MonthlyGoodDaysChart';
import { recheckAllHistoricalData } from '../utils/recheckHistoricalData';
import { useToast } from "@/components/ui/use-toast";

const fetchHistory = async () => {
  const { data, error } = await supabase
    .from('daily_weather_records')
    .select('*')
    .order('date', { ascending: false });
  
  if (error) throw error;
  return data;
};

const About = () => {
  const { data: history, isLoading, error, refetch } = useQuery({
    queryKey: ['history'],
    queryFn: fetchHistory
  });

  const { toast } = useToast();
  const [isRechecking, setIsRechecking] = React.useState(false);
  const [recheckResults, setRecheckResults] = React.useState(null);

  const handleRecheckData = async () => {
    setIsRechecking(true);
    setRecheckResults(null);
    
    try {
      const result = await recheckAllHistoricalData();
      
      if (result.success) {
        setRecheckResults(result);
        toast({
          title: "✅ Data recheck completed!",
          description: `Updated ${result.updated} records, ${result.correct} were already correct. Total: ${result.total}`,
        });
        // Refresh the data to show updates
        refetch();
      } else {
        toast({
          title: "❌ Recheck failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h1 className="text-3xl font-bold mb-4">What is this all about?</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            We've all heard the saying 'You can't beat Wellington on a good day', but how do you know when its a good day? 
            </p>
          <p className="mb-4">
            Here's how it works:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>We fetch real-time weather data for <a href="https://en.wikipedia.org/wiki/Wellington" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Wellington, New Zealand <ExternalLink className="inline-block w-4 h-4 ml-1" /></a> from a reliable weather API.</li>
            <li>We analyze four key factors: temperature, wind speed, sunniness, and rainfall.</li>
            <li>Based on predefined thresholds, we determine if today is a day you "can't beat Wellington."</li>
          </ul>
          <p className="mb-4">
            The thresholds are:
          </p>
          <ul className="list-disc list-inside mb-4">
            <li>Minimum Temperature (Daily Maximum): 18°C</li>
            <li>Maximum Wind Speed: 20 km/h</li>
            <li>Minimum Sunniness: 90%</li>
            <li>Maximum Rainfall: 0 mm</li>
          </ul>
          <p className="mb-4">
            If all these conditions are met, it's considered a day when "you can't beat Wellington." Otherwise...
          </p>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Data Quality Check</h3>
            <p className="text-sm text-gray-600 mb-3">
              Click the button below to recheck all historical weather data against the current criteria and update any incorrect records.
            </p>
            <Button 
              onClick={handleRecheckData}
              disabled={isRechecking}
              className="w-full"
            >
              {isRechecking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Rechecking Data...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recheck Historical Data
                </>
              )}
            </Button>
            
            {recheckResults && (
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <h4 className="font-semibold mb-3 text-green-700">✅ Recheck Complete!</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-blue-600">{recheckResults.total}</div>
                    <div className="text-sm text-gray-600">Total Records</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-orange-600">{recheckResults.updated}</div>
                    <div className="text-sm text-gray-600">Updated</div>
                  </div>
                </div>
                
                {recheckResults.updated > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <XCircle className="w-4 h-4 text-red-500 mr-2" />
                        Changed from Good to Bad:
                      </span>
                      <span className="font-semibold">{recheckResults.changedFromGoodToBad}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        Changed from Bad to Good:
                      </span>
                      <span className="font-semibold">{recheckResults.changedFromBadToGood}</span>
                    </div>
                    
                    {recheckResults.changes && recheckResults.changes.length > 0 && (
                      <div className="mt-3">
                        <h5 className="font-medium text-sm mb-2">Recent Changes (showing first 10):</h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {recheckResults.changes.map((change, index) => (
                            <div key={index} className="text-xs flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span>{format(parseISO(change.date), 'MMM dd, yyyy')}</span>
                              <div className="flex items-center">
                                <span className={change.from ? 'text-green-600' : 'text-red-600'}>
                                  {change.from ? 'Good' : 'Bad'}
                                </span>
                                <ArrowRight className="w-3 h-3 mx-1" />
                                <span className={change.to ? 'text-green-600' : 'text-red-600'}>
                                  {change.to ? 'Good' : 'Bad'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {recheckResults.updated === 0 && (
                  <div className="text-center text-green-600 text-sm">
                    All records were already correct! 🎉
                  </div>
                )}
              </div>
            )}
          </div>
          
          <p className="mt-6 mb-4">
            Built by <a href="https://www.radomski.co.nz" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Patrick Radomski <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>, with <a href="https://gptengineer.app" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">some AI help <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>.
          </p>
          <p className="mb-4">
            Contact me on <a href="https://mastodon.nz/@Pat" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Mastodon <ExternalLink className="inline-block w-4 h-4 ml-1" /></a>.
          </p>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-4xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">Weather History Calendar</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center">Loading history...</p>}
          {error && <p className="text-center text-red-500">Error loading history: {error.message}</p>}
          {history && <CalendarHistory history={history} />}
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-4xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">Good Days Per Month</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center">Loading data...</p>}
          {error && <p className="text-center text-red-500">Error loading data: {error.message}</p>}
          {history && <MonthlyGoodDaysChart history={history} />}
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold mb-4">You can't beat Wellington on a good day - The Datsun Violets</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ paddingBottom: '56.25%', height: 0 }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src="https://www.youtube.com/embed/a4xNdyVPDJQ"
              title="You can't beat Wellington on a good day - The Datsun Violets"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4">
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default About;
