import { useState } from 'react';

interface HeatmapChartProps {
  data: Array<{
    day: number; // 0-6 (Sunday to Saturday)
    hour: number; // 0-23
    value: number;
  }>;
}

const HeatmapChart = ({ data }: HeatmapChartProps) => {
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; value: number } | null>(null);

  // Create days and hours arrays
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find the maximum value for color scaling
  const maxValue = Math.max(...data.map(item => item.value));

  // Helper function to get cell color based on value
  const getCellColor = (value: number) => {
    if (value === 0) return '#f3f4f6';
    
    const intensity = Math.min(value / maxValue, 1);
    // Convert the rgba to hex with opacity
    const alpha = Math.round((intensity * 0.9 + 0.1) * 255).toString(16).padStart(2, '0');
    return `#4f46e5${alpha}`;
  };

  // Helper function to get cell value
  const getCellValue = (day: number, hour: number) => {
    const cell = data.find(item => item.day === day && item.hour === hour);
    return cell ? cell.value : 0;
  };

  // Format hour for display
  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Heatmap grid */}
        <div className="flex">
          {/* Hour labels */}
          <div className="mr-2 mt-6">
            {hours.map((hour, index) => (
              index % 3 === 0 && (
                <div key={hour} className="h-6 flex items-center justify-end">
                  <span className="text-xs text-gray-500">{formatHour(hour)}</span>
                </div>
              )
            ))}
          </div>
          
          {/* Days and cells */}
          <div className="flex-1">
            {/* Day labels */}
            <div className="flex mb-1">
              {days.map(day => (
                <div key={day} className="flex-1 text-center">
                  <span className="text-xs font-medium text-gray-500">{day}</span>
                </div>
              ))}
            </div>
            
            {/* Cells */}
            <div className="grid grid-rows-24 gap-1" style={{ gridTemplateRows: 'repeat(24, 1fr)' }}>
              {hours.map(hour => (
                <div key={hour} className="flex gap-1 h-6">
                  {days.map((day, dayIndex) => {
                    const value = getCellValue(dayIndex, hour);
                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="flex-1 rounded-sm cursor-pointer transition-colors duration-200"
                        style={{ backgroundColor: getCellColor(value) }}
                        onMouseEnter={() => setHoveredCell({ day: dayIndex, hour, value })}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center justify-end">
          <div className="text-xs text-gray-500 mr-2">Activity:</div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-sm bg-gray-100 mr-1"></div>
            <span className="text-xs text-gray-500 mr-2">Low</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-sm bg-indigo-300 mr-1"></div>
            <span className="text-xs text-gray-500 mr-2">Medium</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-sm bg-indigo-600 mr-1"></div>
            <span className="text-xs text-gray-500">High</span>
          </div>
        </div>
        
        {/* Tooltip */}
        {hoveredCell && (
          <div className="absolute bg-gray-800 text-white p-2 rounded shadow-lg text-xs z-10" style={{ top: `${hoveredCell.hour * 24 + 24}px`, left: `${hoveredCell.day * 14 + 50}px` }}>
            <div>{days[hoveredCell.day]} at {formatHour(hoveredCell.hour)}</div>
            <div className="font-bold">{hoveredCell.value} notifications</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapChart; 