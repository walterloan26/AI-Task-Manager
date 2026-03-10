import { PriorityDistributionClient } from './PriorityDistributionClient';
import { AlertCircle } from 'lucide-react';
import { cookies } from 'next/headers';

async function getPriorityDistribution(userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cookieStore = await cookies();
    
    const response = await fetch(`${baseUrl}/api/priority-distribution?userId=${userId}`, {
      cache: 'no-store',
      headers: {
        'Cookie': cookieStore.toString()
      }
    });
    
    if (!response.ok) {
      console.error('API responded with status:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch priority distribution:', error);
    return [];
  }
}

export default async function PriorityDistribution({ userId }: { userId: string }) {
  const data = await getPriorityDistribution(userId);
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <AlertCircle className="w-5 h-5 mr-2" />
        Priority Distribution
      </h3>
      <div className="h-64 w-full">
        {data.length > 0 ? (
          <PriorityDistributionClient data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}