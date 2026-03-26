import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '../ui/Skeleton';
import { Cloud } from 'lucide-react';

const COLORS = ['#B6FF4A', '#4AFFD4', '#FFB84A', '#FF8A4A'];

const CustomDot = (props) => {
  const { cx, cy, payload, dataKey } = props;
  const accName = dataKey; 
  if (payload[`${accName}_anomaly`]) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="#FF4A6A" stroke="#111114" strokeWidth={2} className="animate-pulse" />
    );
  }
  return <circle cx={cx} cy={cy} r={3} fill={props.stroke} opacity={0} />; 
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    let dateStr = label;
    try { dateStr = format(parseISO(label), 'MMM dd, yyyy'); } catch(e) {}
    
    return (
      <div className="bg-[#1E1E25] border border-white/10 p-3 rounded-xl shadow-xl">
        <p className="text-text-secondary text-xs mb-2">{dateStr}</p>
        {payload.map((entry, index) => {
          const isAnomaly = entry.payload[`${entry.dataKey}_anomaly`];
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 mb-1 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-text-primary">{entry.dataKey}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">${Number(entry.value).toFixed(2)}</span>
                {isAnomaly && <span className="w-2 h-2 bg-accent-red rounded-full" title="Anomaly Detected" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center gap-2 text-text-secondary text-sm hover:text-white transition-colors cursor-pointer">
          <Cloud size={14} color={entry.color} />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function CostLineChart({ data = [], loading = false, height = 300 }) {
  const { chartData, accounts } = useMemo(() => {
    if (!data.length) return { chartData: [], accounts: [] };
    const grouped = {};
    const accountsSet = new Set();
    
    data.forEach(item => {
      const dStr = typeof item.date === 'string' ? item.date.split('T')[0] : item.date;
      if (!grouped[dStr]) grouped[dStr] = { date: dStr };
      const accName = item.account_name || 'Total';
      accountsSet.add(accName);
      grouped[dStr][accName] = (grouped[dStr][accName] || 0) + Number(item.cost_usd);
      if (item.is_anomaly) grouped[dStr][`${accName}_anomaly`] = true;
    });
    
    return { 
      chartData: Object.values(grouped).sort((a,b) => a.date.localeCompare(b.date)), 
      accounts: Array.from(accountsSet) 
    };
  }, [data]);

  if (loading) return <Skeleton className="w-full" style={{ height }} />;

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-secondary border border-dashed border-white/10 rounded-xl" style={{ height }}>
        No historical cost data available.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          <Legend content={<CustomLegend />} />
          
          {accounts.map((acc, index) => (
            <Line 
              key={acc}
              type="monotone" 
              dataKey={acc} 
              stroke={COLORS[index % COLORS.length]} 
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6, fill: COLORS[index % COLORS.length], stroke: '#111114', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
