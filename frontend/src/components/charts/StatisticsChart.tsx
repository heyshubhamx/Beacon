import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface StatisticsChartProps {
  data: {
    name: string;
    subscriptions?: number;
    notifications?: number;
    deliveries?: number;
    clicks: number;
  }[];
}

// Custom tooltip for better presentation
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border border-gray-200 shadow-sm rounded-md text-sm">
        <p className="font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const StatisticsChart: React.FC<StatisticsChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="subscriptions" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
            name="Subscribers"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="deliveries" 
            stroke="#3b82f6" 
            activeDot={{ r: 8 }} 
            name="Deliveries"
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="clicks" 
            stroke="#10b981" 
            activeDot={{ r: 8 }} 
            name="Clicks"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatisticsChart;