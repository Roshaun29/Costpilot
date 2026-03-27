import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Cloud, AlertTriangle, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import { formatDistanceToNow, subDays, format } from 'date-fns';

import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

import CostLineChart from '../components/charts/CostLineChart';
import AnomalyScatterChart from '../components/charts/AnomalyScatterChart';
import ServiceBreakdownChart from '../components/charts/ServiceBreakdownChart';

import LiveSection from '../components/live/LiveSection';

import { getCostSummary, getCosts } from '../api/costs';
import { getAnomalyStats, getAnomalies } from '../api/anomalies';
import { getStatus } from '../api/simulation';
import api from '../api/axios'; // direct insights fetch

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
};

// Extracted InsightIcon to prevent re-creation
const InsightIcon = React.memo(({ type }) => {
  if (type === 'SPIKE') return <div className="p-2 bg-accent-red/20 text-accent-red rounded-xl"><AlertTriangle size={18} /></div>;
  if (type === 'DRIFT') return <div className="p-2 bg-yellow-500/20 text-yellow-500 rounded-xl"><TrendingUp size={18} /></div>;
  return <div className="p-2 bg-brand/20 text-brand rounded-xl"><DollarSign size={18} /></div>;
});

const StaticSection = React.memo(({ data, loading, navigate, timeRange, onRangeChange }) => {
  // Memoize handlers passed down to prevent children re-rendering
  const goAnomalies = useCallback(() => navigate('/anomalies'), [navigate]);
  const goInsights = useCallback(() => navigate('/insights'), [navigate]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <StatCard 
            title="Total This Month" 
            value={`$${data.summary?.current_month_total?.toLocaleString() || '0'}`}
            delta={data.summary?.delta_percent}
            deltaLabel="vs last month"
            icon={TrendingUp}
            loading={loading}
            isCost={true}
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
            title="Accounts Monitored" 
            value={data.simStatus?.accounts_monitored || 0}
            icon={Cloud}
            loading={loading}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <StatCard 
            title="Budget Forecast" 
            value={`$${data.summary?.projected_month_end?.toLocaleString() || '0'}`}
            icon={DollarSign}
            loading={loading}
          />
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="col-span-1 border-0 bg-surface-raised/50 backdrop-blur-xl ring-1 ring-white/10 p-0 overflow-hidden">
          <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-medium">Cost Trends</h2>
              <p className="text-sm text-text-secondary mt-1">Multi-cloud temporal aggregation</p>
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
            <CostLineChart data={data.chartData} loading={loading} height={350} />
          </div>
        </Card>
      </motion.div>

      <div className="flex flex-col xl:flex-row gap-6">
        <motion.div variants={itemVariants} className="xl:w-[58%]">
          <Card className="h-full">
            <h2 className="text-lg font-display font-medium mb-1">Anomaly Distribution</h2>
            <p className="text-sm text-text-secondary mb-6">Scatter map by deviation scale</p>
            <AnomalyScatterChart anomalies={data.recentAnomalies} loading={loading} height={320} />
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="xl:w-[42%]">
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
                  <div key={anom.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors flex items-center justify-between group">
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
                      <button className="p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand/20 hover:text-brand" onClick={() => navigate('/anomalies', { state: { selectedAnomalyId: anom.id } })}>
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
            <p className="text-sm text-text-secondary mb-6">7-day aggregated volume stacked</p>
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
                data.insights.slice(0, 3).map(insight => (
                  <div key={insight.id} className="flex gap-4 items-start">
                    <InsightIcon type={insight.type} />
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
    </>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: null,
    anomalyStats: null,
    simStatus: null,
    recentAnomalies: [],
    insights: [],
    chartData: []
  });
  const [timeRange, setTimeRange] = useState('30d');
  const [hasAccounts, setHasAccounts] = useState(true);

  // Poll main dashboard 30s
  useEffect(() => {
    fetchDashboardData(timeRange);
    const interval = setInterval(() => {
      fetchDashboardData(timeRange);
    }, 30000);
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

      const sim = simRes.data.data;
      if (sim.accounts_monitored === 0) {
        setHasAccounts(false);
      } else {
        setHasAccounts(true);
      }

      setData({
        summary: sumRes.data.data,
        anomalyStats: anomStatsRes.data.data,
        simStatus: simRes.data.data,
        recentAnomalies: anomListRes.data.data.items || [],
        insights: insRes.data.data || [],
        chartData: costRes.data.data || []
      });
    } catch (err) {
      console.error('Failed dashboard data load', err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  const handleRangeChange = useCallback((range) => {
    setLoading(true); // show loader only on user action
    setTimeRange(range);
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  if (!loading && !hasAccounts) {
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
      
      <LiveSection />

      <StaticSection 
        data={memoizedData} 
        loading={loading} 
        navigate={navigate} 
        timeRange={timeRange} 
        onRangeChange={handleRangeChange} 
      />

    </motion.div>
  );
}
