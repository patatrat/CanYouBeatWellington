
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2 } from 'lucide-react';
import { generateAndDownloadCSV } from '../utils/generateHistoricalCSV';

const CSVGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    
    try {
      const result = await generateAndDownloadCSV();
      setResult(result);
    } catch (error) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Generate Historical Weather CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Generate a CSV file with ~2 years of historical Wellington weather data that you can upload to Supabase.
        </p>
        
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating CSV...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Generate & Download CSV
            </>
          )}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.success ? (
              <div className="space-y-2">
                <p className="font-medium text-green-800">✅ CSV Generated Successfully!</p>
                <p className="text-sm text-green-700">Total records: {result.totalRecords}</p>
                <p className="text-sm text-green-700">Good days found: {result.goodDays}</p>
                <p className="text-sm text-green-700">File: {result.filename}</p>
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="font-medium text-blue-800 mb-1">Next steps:</p>
                  <ol className="text-sm text-blue-700 space-y-1">
                    <li>1. Open your Supabase dashboard</li>
                    <li>2. Go to Table Editor → daily_weather_records</li>
                    <li>3. Click "Insert" → "Import data from CSV"</li>
                    <li>4. Upload the downloaded file</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium text-red-800">❌ Generation Failed</p>
                <p className="text-sm text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVGenerator;
