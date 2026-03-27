import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const LiveCostChart = React.memo(({ data, height = 300 }) => {
  // Minimize re-renders and compute only when data actually changes
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="liveCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#B6FF4A" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#B6FF4A" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#8A8A9A', fontSize: 11 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#8A8A9A', fontSize: 11 }}
            tickFormatter={(val) => `$${val}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: '#fff' }}
          />
          <Area 
            type="monotone" 
            dataKey="cost" 
            stroke="#B6FF4A" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#liveCostGrad)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}, (prevProps, nextProps) => prevProps.data === nextProps.data);

export default LiveCostChart;
