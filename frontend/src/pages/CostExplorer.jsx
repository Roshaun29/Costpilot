import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Filter, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import CostLineChart from '../components/charts/CostLineChart';

import { getCosts } from '../api/costs';
import { getAccounts } from '../api/accounts';
import { formatINR } from '../utils/currency';

export default function CostExplorer() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  const [filters, setFilters] = useState({
    accountId: '',
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    granularity: 'daily'
  });

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    try {
      const accRes = await getAccounts();
      setAccounts(accRes.data.data);
      await fetchCosts(filters);
    } catch (err) {
      toast.error('Failed to initialize Explorer');
    }
  };

  const fetchCosts = async (currentFilters) => {
    setLoading(true);
    try {
      const payload = {
        start_date: currentFilters.startDate,
        end_date: currentFilters.endDate,
        granularity: currentFilters.granularity
      };
      if (currentFilters.accountId) payload.account_id = currentFilters.accountId;
      
      const res = await getCosts(payload);
      setChartData(res.data.data);
      setPage(1); // reset table
    } catch (err) {
      toast.error('Failed to pull chart query');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    if (loading) return;
    fetchCosts(filters);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedData = [...chartData].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Sort logic
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedData = sortedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const exportCSV = () => {
    const headers = ['Date', 'Service', 'Account', 'Cost INR', 'Anomaly Detected'];
    const csvContent = [
      headers.join(','),
      ...sortedData.map(r => [
        r.date, 
        `"${r.service || 'Overall'}"`, 
        `"${r.account_name || 'All'}"`, 
        r.cost_usd, 
        r.is_anomaly ? 'YES' : 'NO'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `costpilot_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    link.click();
    toast.success('CSV Downloaded Successfully');
  };

  // Pre-sets
  const setRange = (days) => {
    setFilters(prev => ({
      ...prev,
      startDate: format(subDays(new Date(), days), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Cost Explorer</h1>
          <p className="text-text-secondary text-sm">Granular analytical querying & temporal visualizations.</p>
        </div>
        <Button icon={Download} variant="secondary" onClick={exportCSV} disabled={chartData.length === 0}>
           Export CSV
        </Button>
      </div>

      <Card className="sticky top-20 z-20 flex flex-col md:flex-row items-end gap-4 bg-[#18181D]/90 backdrop-blur-md">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Account Filter</label>
            <select
              value={filters.accountId}
              onChange={e => setFilters({...filters, accountId: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 transition-colors cursor-pointer"
            >
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Time Range (Start)</label>
            <input 
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 transition-colors custom-date-input"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Time Range (End)</label>
            <input 
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand/50 transition-colors custom-date-input"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Granularity</label>
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              {['daily', 'weekly', 'monthly'].map(g => (
                <button
                  key={g}
                  onClick={() => setFilters({...filters, granularity: g})}
                  className={`flex-1 py-1.5 text-xs font-bold capitalize rounded-lg transition-colors ${filters.granularity === g ? 'bg-surface-raised text-white shadow-sm ring-1 ring-white/20' : 'text-text-secondary hover:text-white'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
          <Button variant="primary" icon={Search} onClick={handleApplyFilters} className="w-full md:w-auto shrink-0">
            Query
          </Button>
        </div>
      </Card>

      <Card className="p-1 sm:p-6 overflow-hidden">
        <CostLineChart data={chartData} loading={loading} height={400} />
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/[0.05]">
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-2">Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                </th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('service')}>
                  <div className="flex items-center gap-2">Service {sortConfig.key === 'service' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                </th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase">Account (Virtual)</th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase cursor-pointer hover:text-white transition-colors text-right" onClick={() => handleSort('cost_usd')}>
                  <div className="flex items-center justify-end gap-2">Cost (INR) {sortConfig.key === 'cost_usd' && (sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>)}</div>
                </th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase text-center">Anomaly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-text-secondary">Loading dataset...</td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-text-secondary">No matching query data found</td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 text-sm font-medium text-white">{row.date}</td>
                    <td className="p-4 text-sm text-text-secondary">{row.service || "Compound Aggregate"}</td>
                    <td className="p-4 text-sm text-text-secondary">
                      {row.account_name || (filters.accountId ? accounts.find(a=>a.id === filters.accountId)?.account_name : "All Evaluated")}
                    </td>
                    <td className="p-4 text-sm font-mono font-bold text-white text-right">{formatINR(row.cost_usd)}</td>
                    <td className="p-4 text-center items-center justify-center">
                      {row.is_anomaly ? <span className="inline-block w-2.5 h-2.5 bg-accent-red rounded-full shadow-[0_0_8px_#FF4A6A] animate-pulse"></span> : <span className="inline-block w-2 H-2 bg-white/10 rounded-full"></span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/[0.05] flex items-center justify-between text-sm">
            <div className="text-text-secondary">
              Showing <span className="text-white font-mono">{(page - 1) * rowsPerPage + 1}</span> to <span className="text-white font-mono">{Math.min(page * rowsPerPage, sortedData.length)}</span> of <span className="text-white font-mono">{sortedData.length}</span> entries
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-date-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.5;
          cursor: pointer;
        }
        .custom-date-input::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}} />
    </div>
  );
}
