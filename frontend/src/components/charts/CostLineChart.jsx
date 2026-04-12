import { useMemo, useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceDot, ReferenceArea,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatINRCompact, formatINR, usdToInr } from '../../utils/currency';
import api from '../../api/axios';

const COLORS = ['#B6FF4A', '#4AFFD4', '#FFB84A', '#FF8A4A', '#FF4A6A'];

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, isINR }) => {
  if (!active || !payload?.length) return null;
  let dateStr = label;
  try { dateStr = format(parseISO(label), 'MMM dd, yyyy'); } catch (e) {}

  return (
    <div className="bg-bg-overlay border border-border-strong p-4 rounded-2xl shadow-2xl backdrop-blur-xl min-w-[180px]">
      <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-3 border-b border-border-subtle pb-2">
        {dateStr}
      </p>
      <div className="space-y-2">
        {payload.map((entry, i) => {
          if (entry.value == null || entry.value === 0) return null;
          return (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-text-primary text-xs font-bold">{entry.name}</span>
              </div>
              <span className="font-mono text-white text-xs font-black">
                {isINR ? formatINR(entry.value) : `$${Number(entry.value).toFixed(2)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly dot shape
// ─────────────────────────────────────────────────────────────────────────────
const AnomalyDot = ({ cx, cy }) => (
  <g>
    <circle cx={cx} cy={cy} r={5} fill="#FF4A4A" stroke="white" strokeWidth={2} />
    <text x={cx} y={cy - 10} textAnchor="middle" fill="#FF4A4A" fontSize={10} fontWeight="bold">⚠</text>
  </g>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Chart
// ─────────────────────────────────────────────────────────────────────────────
/**
 * CostLineChart — Enhanced with:
 *   - Rolling 7-day average overlay (dashed)
 *   - 7-day cost forecast with confidence band (shaded)
 *   - Anomaly markers (red dot + ⚠ label)
 *
 * Props:
 *   data         : Raw cost_data records from API
 *   anomalies    : AnomalyResult records to overlay (optional)
 *   showForecast : Whether to fetch and render the forecast band
 *   loading      : Loading state
 *   height       : Chart height in px
 *   isINR        : Currency mode
 */
export default function CostLineChart({
  data        = [],
  anomalies   = [],
  showForecast = true,
  loading      = false,
  height       = 300,
  isINR        = true,
}) {
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Fetch forecast from /api/costs/forecast
  useEffect(() => {
    if (!showForecast || !data.length) return;
    let cancelled = false;
    setForecastLoading(true);
    api.get('/api/costs/forecast', { params: { days: 7, window: 60 } })
      .then(res => {
        if (!cancelled) setForecastData(res.data?.data || null);
      })
      .catch(() => {}) // Silently degrade — forecast is optional
      .finally(() => { if (!cancelled) setForecastLoading(false); });
    return () => { cancelled = true; };
  }, [data.length, showForecast]);

  // ── Build chartData: aggregate cost_data by date ────────────────────────
  const { chartData, accounts } = useMemo(() => {
    if (!data.length) return { chartData: [], accounts: [] };
    const grouped     = {};
    const accountsSet = new Set();

    data.forEach(item => {
      const dStr   = typeof item.date === 'string' ? item.date.split('T')[0]
                     : (item.cost_date || '').split('T')[0];
      if (!dStr) return;
      if (!grouped[dStr]) grouped[dStr] = { date: dStr };
      const accName = item.account_name || 'Total';
      accountsSet.add(accName);
      const val = Number(item.cost_usd || item.cost || 0);
      grouped[dStr][accName] = (grouped[dStr][accName] || 0) + (isINR ? usdToInr(val) : val);
    });

    return {
      chartData: Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)),
      accounts:  Array.from(accountsSet),
    };
  }, [data, isINR]);

  // ── Merge rolling_mean from forecast history into chartData ─────────────
  const enrichedData = useMemo(() => {
    if (!forecastData?.history?.length) return chartData;
    const meanByDate = {};
    forecastData.history.forEach(h => { meanByDate[h.date] = h.rolling_mean; });
    return chartData.map(row => ({
      ...row,
      rolling_mean: meanByDate[row.date]
        ? (isINR ? usdToInr(meanByDate[row.date]) : meanByDate[row.date])
        : null,
    }));
  }, [chartData, forecastData, isINR]);

  // ── Build forecast points (appended after historical data) ──────────────
  const forecastPoints = useMemo(() => {
    if (!forecastData?.forecast?.length) return [];
    return forecastData.forecast.map(f => ({
      date:  f.date,
      lower: isINR ? usdToInr(f.lower) : f.lower,
      upper: isINR ? usdToInr(f.upper) : f.upper,
      forecast_value: isINR ? usdToInr(f.value) : f.value,
    }));
  }, [forecastData, isINR]);

  // ── Build anomaly marker positions ─────────────────────────────────────
  const anomalyMarkers = useMemo(() => {
    if (!anomalies?.length) return [];
    return anomalies.map(a => {
      const dStr = (a.anomaly_date || '').split('T')[0];
      const cost = isINR ? usdToInr(a.actual_cost || 0) : (a.actual_cost || 0);
      return { date: dStr, cost, id: a.id, severity: a.severity };
    }).filter(m => m.date && m.cost > 0);
  }, [anomalies, isINR]);

  // ── Full combined timeline ──────────────────────────────────────────────
  const fullData = useMemo(() => {
    const base = enrichedData.map(d => ({ ...d, isForecast: false }));
    const fcast = forecastPoints.map(f => ({
      date:           f.date,
      rolling_mean:   null,
      forecast_value: f.forecast_value,
      lower:          f.lower,
      upper:          f.upper,
      isForecast:     true,
    }));
    return [...base, ...fcast];
  }, [enrichedData, forecastPoints]);

  if (loading) {
    return (
      <div className="animate-pulse bg-white/5 rounded-3xl" style={{ height }} />
    );
  }

  if (!fullData.length) {
    return (
      <div
        className="flex items-center justify-center text-text-muted border border-dashed border-border-subtle rounded-3xl font-medium"
        style={{ height }}
      >
        Awaiting billing telemetry...
      </div>
    );
  }

  const fmtY = (val) => isINR
    ? (val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`)
    : `$${val}`;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={fullData} margin={{ top: 16, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {accounts.map((acc, i) => (
              <linearGradient key={`grad-${acc}`} id={`color-${acc}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS[i % COLORS.length]} stopOpacity={0.18} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}    />
              </linearGradient>
            ))}
            {/* Forecast confidence band gradient */}
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#B6FF4A" stopOpacity={0.10} />
              <stop offset="95%" stopColor="#B6FF4A" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={(t) => { try { return format(parseISO(t), 'MMM dd'); } catch { return t; } }}
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 }}
            tickMargin={12}
            axisLine={false}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 600 }}
            tickFormatter={fmtY}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip isINR={isINR} />} />

          <Legend
            wrapperStyle={{ paddingTop: 16, fontSize: 11, fontWeight: 700 }}
            iconType="circle"
          />

          {/* ── Forecast confidence band ───────────────────────────── */}
          {forecastPoints.length > 0 && (
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="url(#forecastGrad)"
              fillOpacity={1}
              legendType="none"
              name=""
              isAnimationActive={false}
            />
          )}

          {/* ── Actual cost areas per account ─────────────────────── */}
          {accounts.map((acc, i) => (
            <Area
              key={acc}
              type="monotone"
              dataKey={acc}
              stroke={COLORS[i % COLORS.length]}
              fillOpacity={1}
              fill={`url(#color-${acc})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: COLORS[i % COLORS.length], stroke: 'white', strokeWidth: 2 }}
              name={acc}
            />
          ))}

          {/* ── Rolling 7-day average (dashed) ───────────────────── */}
          <Line
            type="monotone"
            dataKey="rolling_mean"
            stroke="#888"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="7D Avg"
            connectNulls={false}
          />

          {/* ── Forecast line ─────────────────────────────────────── */}
          {forecastPoints.length > 0 && (
            <Line
              type="monotone"
              dataKey="forecast_value"
              stroke="#B6FF4A"
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              name="Forecast"
              connectNulls={true}
            />
          )}

          {/* ── Anomaly markers ───────────────────────────────────── */}
          {anomalyMarkers.map(m => (
            <ReferenceDot
              key={m.id}
              x={m.date}
              y={m.cost}
              r={5}
              fill="#FF4A4A"
              stroke="white"
              strokeWidth={2}
              label={{ value: '⚠', fill: '#FF4A4A', position: 'top', fontSize: 12 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
