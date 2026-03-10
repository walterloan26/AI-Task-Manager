"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface WeeklyTrendsChartClientProps {
  data: Array<{ date: string; completed: number }>;
}

export function WeeklyTrendsChartClient({ data }: WeeklyTrendsChartClientProps) {
  return (
    <ResponsiveContainer 
      width="100%" 
      height="100%" 
      minWidth={0}  
      minHeight={200} 
      >
        
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
      >
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="completed" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}