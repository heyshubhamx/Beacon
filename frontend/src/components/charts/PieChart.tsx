import { PieChart as RechartsChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PieChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PieChart: React.FC<PieChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string) => {
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return [`${value} (${percentage}%)`, name];
            }} 
          />
          <Legend />
        </RechartsChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChart;