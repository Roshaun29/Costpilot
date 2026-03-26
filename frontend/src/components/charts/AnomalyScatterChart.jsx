import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '../ui/Skeleton';

const SEVERITY_COLORS = {
  low: '#4AFFD4',
  medium: '#FFB84A',
  high: '#FF8A4A',
  critical: '#FF4A6A'
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    let dateStr = data.anomaly_date;
    try { dateStr = format(parseISO(data.anomaly_date), 'MMM dd, HH:mm'); } catch(e) {}
    
    return (
      <div className="bg-[#1E1E25] border border-white/10 p-4 rounded-xl shadow-xl w-64 z-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">{data.service}</span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full" style={{ color: SEVERITY_COLORS[data.severity.toLowerCase()] || '#fff', backgroundColor: `${SEVERITY_COLORS[data.severity.toLowerCase()]}20` }}>
            {data.severity}
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Account:</span>
            <span className="text-white truncate max-w-[120px]">{data.account_name || 'System'}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Deviation:</span>
            <span className="font-mono text-accent-red">+{Number(data.deviation_percent).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Actual Cost:</span>
            <span className="font-mono text-white">${Number(data.actual_cost).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-text-secondary text-xs mt-2 pt-2 border-t border-white/5">
            <span>Date:</span>
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AnomalyScatterChart({ anomalies = [], loading = false, height = 300 }) {
  if (loading) return <Skeleton className="w-full" style={{ height }} />;

  if (anomalies.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-secondary border border-dashed border-white/10 rounded-xl" style={{ height }}>
        No anomalies detected yet.
      </div>
    );
  }

  // Format data for Scatter
  const data = anomalies.map(a => ({
    ...a,
    x: Number(a.actual_cost),
    y: Number(a.deviation_percent),
    z: 1 // uniform sizing, could be actual cost impact
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Actual Cost" 
            stroke="#4A4A5A" 
            tickFormatter={(val) => `$${val}`}
            tick={{ fill: '#8A8A9A', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Deviation %" 
            stroke="#4A4A5A" 
            tickFormatter={(val) => `${val}%`}
            tick={{ fill: '#8A8A9A', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <ZAxis type="number" dataKey="z" range={[50, 200]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          
          {Object.keys(SEVERITY_COLORS).map(severity => (
            <Scatter 
              key={severity}
              name={severity} 
              data={data.filter(d => d.severity.toLowerCase() === severity)} 
              fill={SEVERITY_COLORS[severity]}
              fillOpacity={0.8}
            />
          ))}
          
          <ReferenceLine y={25} stroke="rgba(255,74,106,0.5)" strokeDasharray="3 3" label={{ position: 'top', value: 'Alert Threshold', fill: '#FF4A6A', fontSize: 10 }} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
