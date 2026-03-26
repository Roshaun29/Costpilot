import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '../ui/Skeleton';

const COLORS = ['#B6FF4A', '#4AFFD4', '#008AD7', '#FFB84A', '#FF9900', '#9B51E0', '#FF4A6A', '#4285F4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    let dateStr = label;
    try { dateStr = format(parseISO(label), 'MMM dd, yyyy'); } catch(e) {}
    
    // Sort tooltip payload by value descending
    const sortedPayload = [...payload].sort((a,b) => b.value - a.value);
    const total = sortedPayload.reduce((sum, entry) => sum + entry.value, 0);

    return (
      <div className="bg-[#1E1E25] border border-white/10 p-3 rounded-xl shadow-xl min-w-[200px]">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <p className="text-text-secondary text-sm">{dateStr}</p>
          <p className="text-white font-mono font-bold">${total.toFixed(2)}</p>
        </div>
        
        {sortedPayload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-1 text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-text-secondary">{entry.dataKey}</span>
            </div>
            <span className="font-mono text-white">${Number(entry.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ServiceBreakdownChart({ data = [], loading = false, height = 300 }) {
  const { chartData, services } = useMemo(() => {
    if (!data.length) return { chartData: [], services: [] };
    const grouped = {};
    const servicesSet = new Set();
    
    data.forEach(item => {
      const dStr = typeof item.date === 'string' ? item.date.split('T')[0] : item.date;
      if (!grouped[dStr]) grouped[dStr] = { date: dStr };
      const svcName = item.service || 'Other';
      servicesSet.add(svcName);
      grouped[dStr][svcName] = (grouped[dStr][svcName] || 0) + Number(item.cost_usd);
    });
    
    // Sort by date and take last 7 for UI clarity if large
    const finalData = Object.values(grouped).sort((a,b) => a.date.localeCompare(b.date));
    const recentData = finalData.length > 7 ? finalData.slice(-7) : finalData;

    return { 
      chartData: recentData, 
      services: Array.from(servicesSet) 
    };
  }, [data]);

  if (loading) return <Skeleton className="w-full" style={{ height }} />;

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-secondary border border-dashed border-white/10 rounded-xl" style={{ height }}>
        No service breakdown data available.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="date" 
            tickFormatter={(tick) => {
              try { return format(parseISO(tick), 'MMM dd'); } catch(e) { return tick; }
            }}
            stroke="#4A4A5A" 
            tick={{ fill: '#8A8A9A', fontSize: 12 }} 
            tickMargin={10} 
            axisLine={false} 
          />
          <YAxis 
            stroke="#4A4A5A" 
            tick={{ fill: '#8A8A9A', fontSize: 12, fontFamily: 'JetBrains Mono' }} 
            tickFormatter={(val) => `$${val}`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          
          {services.map((svc, index) => (
            <Bar 
              key={svc} 
              dataKey={svc} 
              stackId="a" 
              fill={COLORS[index % COLORS.length]} 
              radius={index === services.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
