import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { GlassCard } from './GlassCard';

export function CostChart({ data }) {
  return (
    <GlassCard title="Cost analytics" subtitle="30-day cloud spend trajectory">
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(96, 165, 250, 0.82)" />
                <stop offset="100%" stopColor="rgba(96, 165, 250, 0.04)" />
              </linearGradient>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(30, 58, 138, 0.75)" />
                <stop offset="100%" stopColor="rgba(30, 58, 138, 0.02)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="rgba(191, 219, 254, 0.55)" />
            <YAxis tickLine={false} axisLine={false} stroke="rgba(191, 219, 254, 0.55)" />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(96, 165, 250, 0.18)',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(15, 23, 42, 0.28)',
              }}
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#60A5FA"
              fill="url(#forecastGradient)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#BFDBFE"
              fill="url(#costGradient)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
