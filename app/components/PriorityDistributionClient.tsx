"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

interface PriorityDistributionClientProps {
  data: Array<{ name: string; value: number }>;
}

export function PriorityDistributionClient({ data }: PriorityDistributionClientProps) {
  // If no data or all values are 0, show a message
  if (!data || data.length === 0 || data.every(item => item.value === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No task complexity data available
      </div>
    );
  }

  console.log('Rendering pie chart with data:', data);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}