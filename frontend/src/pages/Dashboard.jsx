import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Cloud, AlertTriangle, TrendingUp, DollarSign, ArrowRight, Zap, ListFilter } from 'lucide-react';
import { formatDistanceToNow, subDays, format } from 'date-fns';
import { useAuthStore } from '../store/authStore';

import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

import CostLineChart from '../components/charts/CostLineChart';
import AnomalyScatterChart from '../components/charts/AnomalyScatterChart';
import ServiceBreakdownChart from '../components/charts/ServiceBreakdownChart';

import LiveSection from '../components/live/LiveSection';
import { useLiveData } from '../hooks/useLiveData';
import { formatINR, formatINRCompact, usdToInr } from '../utils/currency';

import { getCostSummary, getCosts } from '../api/costs';
import { getAnomalyStats, getAnomalies } from '../api/anomalies';
import { getStatus } from '../api/simulation';
import api from '../api/axios';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

const LivePulse = () => (
  <div className="flex items-center gap-2 ml-2">
    <motion.div 
      animate={{ scale: [1, 1.4, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      style={{ width: 6, height: 6, borderRadius: '50%', background: '#B6FF4A', boxShadow: '0 0 8px #B6FF4A' }}
    />
    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#B6FF4A', fontWeight: 700 }}>LIVE</span>
  </div>
);

const StaticSection = React.memo(({ data, loading, navigate, timeRange, onRangeChange, liveCostRate, liveTotalToday, isRunning }) => {
  const goAnomalies = useCallback(() => navigate('/anomalies'), [navigate]);
  const goInsights = useCallback(() => navigate('/insights'), [navigate]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <StatCard 
            title="Live Cost Rate" 
            value={liveCostRate !== null ? formatINR(liveCostRate) : "₹—"}
            subValue={liveTotalToday !== null ? `Today: ${formatINR(liveTotalToday)}` : "Waiting for pulse..."}
            icon={Zap}
            loading={loading && liveCostRate === null}
            trend={<LivePulse />}
          />
        </motion.div>
        
        <motion.div variants={itemVariants}>
          <StatCard 
            title="Total This Month" 
            value={formatINR(data.summary?.current_month_total || 0)}
            delta={data.summary?.delta_percent}
            deltaLabel="vs last month"
            icon={TrendingUp}
            loading={loading}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <StatCard 
            title="Active Anomalies" 
            value={data.anomalyStats?.total_open || 0}
            icon={AlertTriangle}
            loading={loading}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <StatCard 
            title="Projected Month End" 
            value={formatINR(data.summary?.projected_month_end || 0)}
            icon={ListFilter}
            loading={loading}
          />
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="col-span-1 border-0 bg-surface-raised/50 backdrop-blur-xl ring-1 ring-white/10 p-0 overflow-hidden">
          <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-medium">Cost Trends</h2>
              <p className="text-sm text-text-secondary mt-1">Multi-cloud INR aggregation</p>
            </div>
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl ring-1 ring-white/[0.05]">
              {['7d', '30d', '90d'].map((r) => (
                <button 
                  key={r}
                  onClick={() => onRangeChange(r)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${timeRange === r ? 'bg-surface text-brand ring-1 ring-white/10' : 'text-text-secondary hover:text-white'}`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <CostLineChart data={data.chartData} loading={loading} height={350} isINR={true} />
          </div>
        </Card>
      </motion.div>

      <div className="flex flex-col xl:flex-row gap-6">
        <motion.div variants={itemVariants} className="xl:w-1/2">
          <Card className="h-full">
            <h2 className="text-lg font-display font-medium mb-1">Anomaly Distribution</h2>
            <p className="text-sm text-text-secondary mb-6">Scatter map by deviation scale</p>
            <AnomalyScatterChart anomalies={data.recentAnomalies} loading={loading} height={320} />
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="xl:w-1/2">
          <Card className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display font-medium">Recent Anomalies</h2>
              <button className="text-xs font-medium text-brand hover:underline" onClick={goAnomalies}>View all</button>
            </div>
            
            <div className="flex-1 space-y-3">
              {loading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)
              ) : data.recentAnomalies.length === 0 ? (
                <div className="text-text-secondary text-sm text-center py-10">No recent anomalies found.</div>
              ) : (
                data.recentAnomalies.map(anom => (
                  <div key={anom._id || anom.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors flex items-center justify-between group">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-white">{anom.service}</span>
                        <Badge severity={anom.severity}>{anom.severity}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <span className="truncate max-w-[100px]">{anom.account_name}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(anom.anomaly_date), { addSuffix: true })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-accent-red text-sm font-bold">+{Number(anom.deviation_percent).toFixed(1)}%</span>
                      <button className="p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand/20 hover:text-brand" onClick={() => navigate('/anomalies', { state: { selectedAnomalyId: anom._id || anom.id } })}>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <motion.div variants={itemVariants} className="w-full lg:w-1/2">
          <Card className="h-full">
            <h2 className="text-lg font-display font-medium mb-1">Service Breakdown</h2>
            <p className="text-sm text-text-secondary mb-6">7-day aggregated volume stacked (INR)</p>
            <ServiceBreakdownChart data={data.chartData} loading={loading} height={280} />
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="w-full lg:w-1/2">
          <Card className="h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-display font-medium">AI Insights</h2>
              <button className="text-xs font-medium text-text-secondary hover:text-white" onClick={goInsights}>Regenerate</button>
            </div>
            
            <div className="space-y-4">
              {loading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="h-20 shimmer rounded-xl" />)
              ) : data.insights.length === 0 ? (
                <div className="text-text-secondary text-sm text-center py-10">Waiting for intelligence generation...</div>
              ) : (
                data.insights.slice(0, 3).map((insight, i) => (
                  <div key={i} className="flex gap-4 items-start border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div className={`p-2 rounded-lg ${insight.type === 'SPIKE' ? 'bg-accent-red/10 text-accent-red' : 'bg-brand/10 text-brand'}`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white mb-1">{insight.headline}</h4>
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{insight.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
});

const DashboardHeader = React.memo(({ user, stats }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
      <div>
        <h1 className="text-3xl font-display font-bold">Good morning, {user?.full_name?.split(' ')[0] || 'User'} 👋</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <p className="text-sm text-text-secondary">Your cloud infrastructure is running normally</p>
          <div className="ml-4 px-2 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-bold ring-1 ring-brand/20">1 USD = ₹83.50</div>
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs text-text-muted font-medium bg-surface/50 px-4 py-2 rounded-xl border border-border-subtle">
        <span className="flex items-center gap-2"><Cloud size={14}/> {stats.accounts_monitored} Accounts</span>
        <span className="flex items-center gap-2"><Zap size={14}/> 12 Services</span>
        <span className="flex items-center gap-2"><ArrowRight size={14}/> Last sync 4s ago</span>
      </div>
    </div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: null,
    anomalyStats: null,
    simStatus: { accounts_monitored: 0 },
    recentAnomalies: [],
    insights: [],
    chartData: []
  });
  const [timeRange, setTimeRange] = useState('30d');

  // Live Data Hook
  const { liveMetrics, isConnected, isRunning } = useLiveData();

  const liveCostRatePerHour = useMemo(() => {
    if (!liveMetrics || Object.keys(liveMetrics).length === 0) return null;
    return Object.values(liveMetrics).reduce((sum, acct) => sum + (acct.total_cost_rate_per_hour || 0), 0);
  }, [liveMetrics]);
  
  const liveTotalToday = useMemo(() => {
    if (!liveMetrics || Object.keys(liveMetrics).length === 0) return null;
    return Object.values(liveMetrics).reduce((sum, acct) => sum + (acct.total_cost_today || 0), 0);
  }, [liveMetrics]);

  useEffect(() => {
    fetchDashboardData(timeRange);
    const interval = setInterval(() => fetchDashboardData(timeRange), 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchDashboardData = async (range) => {
    try {
      const endDate = new Date();
      let startDate;
      if (range === '7d') startDate = subDays(endDate, 7);
      else if (range === '30d') startDate = subDays(endDate, 30);
      else startDate = subDays(endDate, 90);
      
      const sd = format(startDate, 'yyyy-MM-dd');
      const ed = format(endDate, 'yyyy-MM-dd');

      const [sumRes, anomStatsRes, simRes, anomListRes, insRes, costRes] = await Promise.all([
        getCostSummary(),
        getAnomalyStats(),
        getStatus(),
        getAnomalies({ limit: 5 }),
        api.get('/api/insights'),
        getCosts({ start_date: sd, end_date: ed, granularity: 'daily' })
      ]);

      setData({
        summary: sumRes.data.data,
        anomalyStats: anomStatsRes.data.data,
        simStatus: simRes.data.data || { accounts_monitored: 0 },
        recentAnomalies: anomListRes.data.data.items || [],
        insights: insRes.data.data || [],
        chartData: costRes.data.data || []
      });
    } catch (err) {
      console.error('Dashboard fetch error', err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  if (!loading && data.simStatus.accounts_monitored === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-lg mx-auto">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          <Cloud size={48} className="text-brand" />
        </div>
        <h2 className="text-3xl font-display font-medium mb-3">Connect your first cloud account</h2>
        <p className="text-text-secondary mb-8 leading-relaxed">CostPilot will simulate real billing data, run Isolation Forests, and detect anomalies automatically via background Engine.</p>
        <Button size="lg" onClick={() => navigate('/accounts')}>Add Cloud Account</Button>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <DashboardHeader user={user} stats={data.simStatus} />
      <div className="h-px bg-white/[0.05] w-full mb-6" />

      <LiveSection />

      <StaticSection 
        data={data} 
        loading={loading} 
        navigate={navigate} 
        timeRange={timeRange} 
        onRangeChange={(r) => { setLoading(true); setTimeRange(r); }}
        liveCostRate={liveCostRatePerHour}
        liveTotalToday={liveTotalToday}
        isRunning={isRunning}
      />
    </motion.div>
  );
}
