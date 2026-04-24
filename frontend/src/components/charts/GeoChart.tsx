import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GeoChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  color?: string;
}

const GeoChart = ({ data, color = '#8884d8' }: GeoChartProps) => {
  // Sort data by value in descending order
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  
  // Take top 10 locations
  const topLocations = sortedData.slice(0, 10);
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={topLocations}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis 
          dataKey="name" 
          type="category" 
          tick={{ fontSize: 12 }}
          width={100}
        />
        <Tooltip 
          formatter={(value) => [`${value} subscribers`, 'Count']}
          labelFormatter={(label) => `Location: ${label}`}
        />
        <Legend />
        <Bar 
          dataKey="value" 
          name="Subscribers" 
          fill={color} 
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default GeoChart; 