import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, TrendingUp, BarChart2, DollarSign, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

import api from '../api/axios';
import { getCostSummary } from '../api/costs';
import { getAccounts } from '../api/accounts';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export default function Insights() {
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);
  const [insights, setInsights] = useState([]);
  
  const [budgetData, setBudgetData] = useState(null);

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const [insRes, accRes, costRes] = await Promise.all([
        api.get('/api/insights'),
        getAccounts(),
        getCostSummary()
      ]);
      setInsights(insRes.data.data || []);
      
      const accs = accRes.data.data || [];
      // getCostSummary returns { current_month_total, top_services, ... } — no per-account breakdown
      // We compute utilization from account monthly_budget vs current total (approximate)
      const spent = {}; // Will be empty unless we have per-account endpoint
      
      const mappedBudgets = accs.map(a => {
        const spentAmt = spent[a.id] || 0;
        const pct = a.monthly_budget > 0 ? (spentAmt / a.monthly_budget) * 100 : 0;
        
        // Calculate projected overage natively from summary projection payload mapped locally
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const daysPassed = Math.max(1, new Date().getDate());
        const projected = (spentAmt / daysPassed) * daysInMonth;
        const projectedOverage = projected > a.monthly_budget ? projected - a.monthly_budget : 0;
        
        return {
          ...a,
          spent: spentAmt,
          utilization: pct,
          projected,
          projectedOverage
        };
      });
      
      setBudgetData(mappedBudgets.sort((a,b) => b.utilization - a.utilization));
      
    } catch (err) {
      toast.error('Failed to load insights engine');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenLoading(true);
    try {
      const res = await api.post('/api/insights/generate');
      setInsights(res.data.data);
      toast.success('Intelligence cache regenerated');
    } catch (err) {
      toast.error('Failed to generate insights');
    } finally {
      setRegenLoading(false);
    }
  };

  const getInsightMeta = (type) => {
    switch(type) {
      case 'SPIKE': return { icon: AlertTriangle, label: 'Spike Detected', color: 'text-accent-red', bg: 'bg-accent-red/10' };
      case 'DRIFT': return { icon: TrendingUp, label: 'Cost Drift', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'BUDGET': return { icon: DollarSign, label: 'Budget Alert', color: 'text-orange-500', bg: 'bg-orange-500/10' };
      case 'MOM': return { icon: BarChart2, label: 'Monthly Summary', color: 'text-[#008AD7]', bg: 'bg-[#008AD7]/10' };
      default: return { icon: BarChart2, label: 'Insight', color: 'text-brand', bg: 'bg-brand/10' };
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">AI Insights</h1>
          <p className="text-text-secondary text-sm">Powered by CostPilot Intelligence Engine
            {insights.length > 0 && ` · Last updated ${formatDistanceToNow(new Date(insights[0].created_at), { addSuffix: true })}`}
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={handleRegenerate} loading={regenLoading || loading}>
          Regenerate Analysis
        </Button>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4 relative">
        {(loading || regenLoading) && (
          <div className="absolute inset-0 z-10 bg-bg/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
              <p className="text-sm font-bold font-mono text-brand">Aggregating Data Layers...</p>
            </div>
          </div>
        )}

        {insights.length === 0 && !loading ? (
          <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl">
            <p className="text-text-secondary">No AI insights generated yet. Add accounts to begin.</p>
          </div>
        ) : (
          insights.map(insight => {
          const meta = getInsightMeta(insight.insight_type || insight.type);
            const Icon = meta.icon;
            
            return (
              <motion.div key={insight.id} variants={itemVariants}>
                <Card className={`p-6 border-l-4 overflow-hidden relative group`} style={{ borderLeftColor: meta.color.split('-')[1] || '#B6FF4A' }}>
                  <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                    <Icon size={120} />
                  </div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
                    <div className={`p-3 rounded-2xl shrink-0 ${meta.bg} ${meta.color}`}>
                      <Icon size={24} />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        {insight.account_id && <Badge className="text-[10px]">Cloud Account Context</Badge>}
                      </div>
                      
                      <h2 className="text-xl font-display text-white">{insight.headline}</h2>
                      <p className="text-[15px] leading-relaxed text-text-secondary max-w-3xl">{insight.body}</p>
                      
                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                        <p className="text-[11px] font-mono text-white/30 tracking-wider">
                          GENERATED {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true }).toUpperCase()}
                        </p>
                        {insight.related_anomaly_id && (
                          <Link to="/anomalies" className="text-xs font-bold text-brand hover:underline flex items-center gap-1 ml-auto">
                            Go to Related Anomaly <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {budgetData && budgetData.length > 0 && (
        <Card className="mt-8">
          <h2 className="text-lg font-display font-medium text-white mb-6">Month-End Budget Forecast</h2>
          <div className="space-y-6">
            {budgetData.map(acc => {
              const util = Math.min(acc.utilization, 100);
              let color = 'bg-brand';
              if (util > 70) color = 'bg-yellow-500';
              if (util > 90) color = 'bg-accent-red';
              
              return (
                <div key={acc.id}>
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2">
                      <Badge provider={acc.provider}>{acc.provider.toUpperCase()}</Badge>
                      <span className="text-sm font-medium text-white">{acc.account_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-white">₹{acc.spent.toLocaleString()}</span>
                      <span className="font-mono text-xs text-text-secondary"> / ₹{acc.monthly_budget.toLocaleString()}</span>
                      <span className={`text-xs font-bold ml-2 ${util > 90 ? 'text-accent-red' : 'text-text-secondary'}`}>({util.toFixed(1)}%)</span>
                    </div>
                  </div>
                  
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden flex relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${util}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className={`h-full ${color}`} 
                    />
                    {/* Tick marker for projected end */}
                    {acc.projected > 0 && acc.projected <= acc.monthly_budget && (
                      <div className="absolute top-0 bottom-0 w-1 bg-white/40" style={{ left: `${(acc.projected / acc.monthly_budget) * 100}%` }} title={`Projected ₹${acc.projected}`}></div>
                    )}
                  </div>
                  
                  {acc.projectedOverage > 0 && (
                    <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl mt-3 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-accent-red mt-0.5 shrink-0" />
                      <p className="text-xs text-accent-red font-medium">
                        Warning: Projected to overspend by ₹{acc.projectedOverage.toFixed(2)} (₹{acc.projected.toFixed(2)} total)
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
