import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveRules, loadRules } from '../utils/rulesStorage';
import { toast } from "sonner";

const Admin = () => {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState({
    minTemp: 18,
    maxWind: 10,
    minSunnyness: 90,
    maxRain: 0
  });

  const { data: savedRules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: loadRules,
    onSuccess: (data) => {
      if (data) setRules(data);
    }
  });

  const mutation = useMutation({
    mutationFn: saveRules,
    onSuccess: () => {
      queryClient.invalidateQueries(['rules']);
      toast.success("Rules saved successfully!");
    },
    onError: () => {
      toast.error("Failed to save rules. Please try again.");
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRules(prevRules => ({
      ...prevRules,
      [name]: parseFloat(value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(rules);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-8">Admin Settings</h1>
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">How the Rules Work</h2>
        <p className="text-gray-700 mb-4">
          For a day to be considered "good" in Wellington, all four conditions must be met:
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-4">
          <li>Temperature must be at least the minimum set value</li>
          <li>Wind speed must be below the maximum set value</li>
          <li>Sunnyness must be at least the minimum set percentage</li>
          <li>Rain must not exceed the maximum set value</li>
        </ul>
        <p className="text-gray-700">
          If all conditions are met, it's considered a day you "can't beat Wellington."
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="mb-4">
          <Label htmlFor="minTemp">Minimum Temperature (°C)</Label>
          <Input
            type="number"
            id="minTemp"
            name="minTemp"
            value={rules.minTemp}
            onChange={handleChange}
            step="0.1"
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="maxWind">Maximum Wind Speed (km/h)</Label>
          <Input
            type="number"
            id="maxWind"
            name="maxWind"
            value={rules.maxWind}
            onChange={handleChange}
            step="0.1"
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="minSunnyness">Minimum Sunnyness (%)</Label>
          <Input
            type="number"
            id="minSunnyness"
            name="minSunnyness"
            value={rules.minSunnyness}
            onChange={handleChange}
            step="1"
          />
        </div>
        <div className="mb-4">
          <Label htmlFor="maxRain">Maximum Rain (mm)</Label>
          <Input
            type="number"
            id="maxRain"
            name="maxRain"
            value={rules.maxRain}
            onChange={handleChange}
            step="0.1"
          />
        </div>
        <Button type="submit" className="w-full mb-4" disabled={mutation.isLoading}>
          {mutation.isLoading ? 'Saving...' : 'Save Rules'}
        </Button>
      </form>
      <Link to="/">
        <Button variant="outline">Back to Home</Button>
      </Link>
    </div>
  );
};

export default Admin;