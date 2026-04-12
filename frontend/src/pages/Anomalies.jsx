import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, TrendingUp, CheckCircle, Clock, ChevronRight, X, Filter } from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import CostLineChart from '../components/charts/CostLineChart';

import { getAnomalies, getAnomalyStats, getAnomaly, updateAnomalyStatus } from '../api/anomalies';
import { getAccounts } from '../api/accounts';
import { formatINR } from '../utils/currency';

const SEVERITY_COLORS = { low: '#4AFFD4', medium: '#FFB84A', high: '#FF8A4A', critical: '#FF4A6A' };

export default function Anomalies() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const location = useLocation();
  
  
  const [filters, setFilters] = useState({ severity: '', status: '', account_id: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    fetchInitial();
  }, [filters, page]);

  useEffect(() => {
    if (location.state?.selectedAnomalyId && !loading) {
      handleDetails(location.state.selectedAnomalyId);
      // Clear state so it doesn't re-trigger on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.selectedAnomalyId, loading]);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const [statsRes, accRes, listRes] = await Promise.all([
        getAnomalyStats(),
        getAccounts(),
        getAnomalies({ ...filters, page, limit: 20 })
      ]);
      setStats(statsRes.data.data);
      setAccounts(accRes.data.data);
      setAnomalies(listRes.data.data.items);
      setTotal(listRes.data.data.total);
    } catch (err) {
      toast.error('Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  };

  const handleDetails = async (id) => {
    setDetailLoading(true);
    setShowModal(true);
    try {
      const res = await getAnomaly(id);
      setSelectedAnomaly(res.data.data);
      setNotes(res.data.data.notes || '');
    } catch (err) {
      toast.error('Failed to load details');
      setShowModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async (id, statusToSet, customNotes = null) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await updateAnomalyStatus(id, { status: statusToSet, notes: customNotes !== null ? customNotes : notes });
      toast.success(`Anomaly ${statusToSet}`);
      if (showModal) setShowModal(false);
      fetchInitial();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const severityOptions = ['Low', 'Medium', 'High', 'Critical'];
  const statusOptions = ['Open', 'Acknowledged', 'Resolved'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Anomalies</h1>
          <p className="text-text-secondary text-sm">Investigate and resolve Machine Learning flags.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Open Anomalies" value={stats?.total_open || 0} icon={AlertTriangle} loading={loading} />
        <Card className="hover:border-white/10 transition-colors">
          <h3 className="text-text-secondary text-sm font-medium mb-4">Critical</h3>
          <span className="text-[32px] font-mono font-bold tracking-tight text-accent-red">
            {stats?.by_severity?.critical || 0}
          </span>
        </Card>
        <Card className="hover:border-white/10 transition-colors">
          <h3 className="text-text-secondary text-sm font-medium mb-4">Avg Deviation</h3>
          <span className="text-[32px] font-mono font-bold tracking-tight text-white">
            +{stats?.avg_deviation?.toFixed(1) || 0}%
          </span>
        </Card>
        <Card className="hover:border-white/10 transition-colors">
          <h3 className="text-text-secondary text-sm font-medium mb-4">Resolved</h3>
          <span className="text-[32px] font-mono font-bold tracking-tight text-brand">
            {stats?.by_status?.resolved || 0}
          </span>
        </Card>
      </div>

      <Card className="flex flex-col sm:flex-row items-center gap-4 p-4 !bg-[#18181D]/80 backdrop-blur">
        <div className="flex items-center gap-2 text-text-secondary">
          <Filter size={18} /> <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
        </div>
        <div className="w-[1px] h-6 bg-white/10 hidden sm:block"></div>
        
        <select value={filters.severity} onChange={e => setFilters({...filters, severity: e.target.value, page: 1})} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50">
          <option value="">All Severities</option>
          {severityOptions.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
        </select>
        
        <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value, page: 1})} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50">
          <option value="">All Statuses</option>
          {statusOptions.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
        </select>

        <select value={filters.account_id} onChange={e => setFilters({...filters, account_id: e.target.value, page: 1})} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50 max-w-[200px]">
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
        </select>
      </Card>

      <div className="space-y-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => <Card key={i} className="h-24"><div className="shimmer h-full w-full rounded-xl" /></Card>)
        ) : anomalies.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
            <p className="text-text-secondary">No anomalies found matching criteria.</p>
          </div>
        ) : (
          anomalies.map(anom => (
            <Card key={anom.id} className="p-0 overflow-hidden group hover:border-white/20 transition-colors relative">
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: SEVERITY_COLORS[anom.severity] || '#fff' }}></div>
              <div className="p-5 pl-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-display font-medium text-lg text-white">{anom.service}</span>
                    <Badge status={anom.status} className="uppercase">{anom.status}</Badge>
                    <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-text-secondary">
                      {anom.detection_method.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="font-medium text-white/70">{anom.account_name || 'Deleted Account'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={12}/> detected {formatDistanceToNow(new Date(anom.anomaly_date), { addSuffix: true })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto">
                  <div>
                    <p className="text-xs text-text-secondary mb-1">Expected: {formatINR(anom.expected_cost)}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-white">{formatINR(anom.actual_cost)}</span>
                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border" style={{ color: SEVERITY_COLORS[anom.severity], backgroundColor: `${SEVERITY_COLORS[anom.severity]}15`, borderColor: `${SEVERITY_COLORS[anom.severity]}30` }}>
                        +{Number(anom.deviation_percent).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-auto">
                    {anom.status === 'open' && (
                      <select 
                        className="bg-surface-raised border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-brand/50 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.value) handleStatusUpdate(anom.id, e.target.value, null);
                        }}
                        value=""
                      >
                        <option value="" disabled>Action...</option>
                        <option value="acknowledged">Acknowledge</option>
                        <option value="resolved">Resolve</option>
                      </select>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => handleDetails(anom.id)}>Details</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
        
        {total > 20 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="flex items-center text-sm font-mono text-text-secondary px-4">Page {page} / {Math.ceil(total/20)}</span>
            <Button variant="ghost" disabled={page >= Math.ceil(total/20)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Anomaly Details" size="lg">
        {detailLoading || !selectedAnomaly ? (
          <div className="p-8 flex justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin"></div></div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display text-lg font-medium">{selectedAnomaly.service}</h3>
                  <Badge severity={selectedAnomaly.severity} className="uppercase">{selectedAnomaly.severity}</Badge>
                </div>
                <p className="text-sm text-text-secondary">{selectedAnomaly.account_name} • {format(new Date(selectedAnomaly.anomaly_date), 'PPpp')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-secondary mb-1">Deviation</p>
                <p className="font-mono text-2xl font-bold" style={{ color: SEVERITY_COLORS[selectedAnomaly.severity] }}>
                  +{Number(selectedAnomaly.deviation_percent).toFixed(1)}%
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm leading-relaxed text-text-secondary bg-surface p-4 rounded-xl border border-white/5 border-l-2 border-l-brand">
                This anomaly was detected using <strong className="text-white">{selectedAnomaly.detection_method.replace('_', ' ').toUpperCase()}</strong>. 
                The cost was {Number(selectedAnomaly.deviation_percent).toFixed(1)}% above the rolling statistical baseline expectation ({formatINR(selectedAnomaly.expected_cost)} expected vs {formatINR(selectedAnomaly.actual_cost)} actual).
              </p>
            </div>

            {selectedAnomaly.history && selectedAnomaly.history.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">30-Day Cost Trajectory</h4>
                <CostLineChart 
                  data={selectedAnomaly.history.map(h => ({
                    date: h.date,
                    cost_usd: h.cost_usd,
                    account_name: selectedAnomaly.service,
                    is_anomaly: h.is_anomaly
                  }))} 
                  height={250} 
                />
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">Investigation Notes</h4>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-24 bg-surface border border-white/10 rounded-xl p-3 text-sm text-white focus:border-brand/50 resize-none transition-colors"
                placeholder="Add notes about root causes or remediation steps..."
              />
            </div>

            <div className="flex border-t border-white/5 pt-6 mt-6 justify-between items-center">
              <Badge status={selectedAnomaly.status} className="uppercase px-4 py-1.5">{selectedAnomaly.status}</Badge>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => handleStatusUpdate(selectedAnomaly.id, selectedAnomaly.status, notes)} loading={statusLoading}>Save Notes</Button>
                {selectedAnomaly.status === 'open' && (
                  <>
                    <Button variant="ghost" onClick={() => handleStatusUpdate(selectedAnomaly.id, 'acknowledged')} loading={statusLoading}>Acknowledge</Button>
                    <Button variant="primary" onClick={() => handleStatusUpdate(selectedAnomaly.id, 'resolved')} loading={statusLoading}>Mark Resolved</Button>
                  </>
                )}
                {selectedAnomaly.status === 'acknowledged' && (
                  <Button variant="primary" onClick={() => handleStatusUpdate(selectedAnomaly.id, 'resolved')} loading={statusLoading}>Mark Resolved</Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
