import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Activity, Filter } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import api from '../api/axios';

export default function ActivityLog() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ entity_type: '', start_date: '', end_date: '' });
  
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.get('/api/activity', { params });
      setLogs(res.data.data.items);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const entityTypes = ['cloud_account', 'anomaly', 'simulation', 'user', 'system'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-medium text-white mb-1">Activity Log</h1>
          <p className="text-text-secondary text-sm">Comprehensive audit trail of system events.</p>
        </div>
      </div>

      <Card className="flex flex-col sm:flex-row items-center gap-4 p-4 !bg-[#18181D]/80 backdrop-blur border border-white/10">
        <div className="flex items-center gap-2 text-text-secondary">
          <Filter size={18} /> <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
        </div>
        <div className="w-[1px] h-6 bg-white/10 hidden sm:block"></div>
        
        <select value={filters.entity_type} onChange={e => {setFilters({...filters, entity_type: e.target.value}); setPage(1);}} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50">
          <option value="">All Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        
        <input 
          type="date" 
          value={filters.start_date}
          onChange={e => {setFilters({...filters, start_date: e.target.value}); setPage(1);}}
          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50 custom-date-input"
        />
        <input 
          type="date" 
          value={filters.end_date}
          onChange={e => {setFilters({...filters, end_date: e.target.value}); setPage(1);}}
          className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand/50 custom-date-input"
        />
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/20 border-b border-white/[0.05]">
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase w-10"></th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase">Timestamp</th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase">Action</th>
                <th className="p-4 text-xs tracking-wider text-text-secondary font-bold uppercase">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-16 text-center text-text-secondary">Loading audit trail...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-16 text-center text-text-secondary">No activity registered matching criteria.</td>
                </tr>
              ) : (
                logs.map(log => {
                  const isExpanded = expandedRows.has(log.id);
                  const hasDetails = ['details', 'actor'].some(key => log[key] && Object.keys(log[key]).length > 0);
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        onClick={() => hasDetails && toggleRow(log.id)}
                        className={`hover:bg-white/[0.02] transition-colors ${hasDetails ? 'cursor-pointer group' : ''} ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                      >
                        <td className="p-4 w-10 text-text-secondary">
                          {hasDetails ? (
                            isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} className="group-hover:text-white transition-colors" />
                          ) : (
                            <Activity size={16} className="opacity-30" />
                          )}
                        </td>
                        <td className="p-4 text-sm font-mono text-text-secondary tracking-tight">
                          {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </td>
                        <td className="p-4 text-sm font-bold text-white capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </td>
                        <td className="p-4">
                          <Badge className="uppercase tracking-wider">
                            {log.entity_type.replace('_', ' ')}
                          </Badge>
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr className="bg-[#050505]">
                          <td colSpan="4" className="p-4 pt-2">
                            <div className="bg-[#0A0A0B] border border-white/5 rounded-xl p-4 overflow-x-auto mx-10">
                              <pre className="text-xs font-mono text-brand whitespace-pre-wrap">
                                {JSON.stringify({ actor: log.actor, target: log.entity_id, details: log.details }, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="px-6 py-4 border-t border-white/[0.05] flex justify-between items-center text-sm">
            <span className="text-text-secondary">Page {page} of {Math.ceil(total/20)}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
              <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>Next</Button>
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
      `}} />
    </div>
  );
}
