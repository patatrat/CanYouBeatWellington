
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import CSVGenerator from '../components/CSVGenerator';

const CSVGen = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <CSVGenerator />
      
      <div className="mt-6">
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
};

export default CSVGen;
