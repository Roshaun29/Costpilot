import React from 'react';
import { motion } from 'framer-motion';
import { useLiveData } from '../../hooks/useLiveData';
import { Zap, Activity, Database, Server } from 'lucide-react';
import EventFeed from './EventFeed';
import { formatINR } from '../../utils/currency';

const MetricMiniCard = ({ icon: Icon, label, value, color }) => (
  <div className="p-4 rounded-2xl bg-bg-raised border border-border-subtle flex items-center gap-4 flex-1">
    <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-text-muted tracking-widest">{label}</p>
      <p className="text-sm font-bold text-text-primary">{value}</p>
    </div>
  </div>
);

const LiveSection = React.memo(() => {
  const { liveMetrics, isRunning, events, isConnected } = useLiveData();

  // Aggregate metrics across all accounts
  const metrics = Object.values(liveMetrics);
  const avgCpu = metrics.length ? metrics.reduce((sum, m) => sum + m.cpu_pct, 0) / metrics.length : 0;
  const avgMem = metrics.length ? metrics.reduce((sum, m) => sum + m.memory_pct, 0) / metrics.length : 0;
  const totalNet = metrics.length ? metrics.reduce((sum, m) => sum + m.network_mbps, 0) : 0;
  const totalStorage = metrics.length ? metrics.reduce((sum, m) => sum + m.storage_gb, 0) : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      
      {/* Left: Live Statistics Grid */}
      <div className="xl:col-span-2 space-y-6">
        <div className="flex flex-wrap gap-4">
          <MetricMiniCard icon={Activity} label="Avg CPU Load" value={`${avgCpu.toFixed(1)}%`} color="brand" />
          <MetricMiniCard icon={Server} label="Avg Memory" value={`${avgMem.toFixed(1)}%`} color="accent-cyan" />
          <MetricMiniCard icon={Zap} label="Network Rate" value={`${totalNet.toFixed(1)} Mbps`} color="accent-amber" />
          <MetricMiniCard icon={Database} label="Storage Vol" value={`${totalStorage.toFixed(1)} GB`} color="text-secondary" />
        </div>

        <div className="p-6 rounded-3xl bg-bg-surface border border-border-subtle relative overflow-hidden min-h-[300px]">
           {/* Background Decoration */}
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 blur-[80px] rounded-full -mr-32 -mt-32" />
           
           <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-display font-bold text-white flex items-center gap-3">
                    Telemetry Stream
                    {!isConnected && <span className="text-[10px] text-accent-red animate-pulse">RECONNECTING...</span>}
                </h3>
                <p className="text-xs text-text-secondary mt-1 tracking-tight">Real-time infrastructure performance and cost drift</p>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                    <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-brand' : 'bg-text-muted'} ${isRunning ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-text-secondary">{isRunning ? 'Active' : 'Paused'}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
             {metrics.map(m => (
               <div key={m.account_id} className="p-4 rounded-xl bg-bg-primary/50 border border-border-subtle flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-text-muted truncate max-w-[80px]">{m.provider.toUpperCase()} ID: {m.account_id.slice(-6)}</span>
                    <span className="text-[10px] font-black text-brand">{m.cpu_pct}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={false}
                        animate={{ width: `${m.cpu_pct}%` }} 
                        className="h-full bg-brand" 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-medium text-text-muted uppercase">Rate</span>
                     <span className="text-xs font-mono font-bold text-text-primary">{formatINR(m.total_cost_rate_per_hour)}/hr</span>
                  </div>
               </div>
             ))}
             {metrics.length === 0 && (
                <div className="col-span-4 p-12 text-center text-text-muted text-sm italic font-medium">
                    Waiting for telemetry pulses...
                </div>
             )}
           </div>

           <div className="mt-8 p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                    <Zap size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white">Simulation Engine Status</h4>
                    <p className="text-[10px] text-text-muted">Currently processing {metrics.length} cloud provider telemetry streams</p>
                </div>
              </div>
              <button className="px-4 py-2 rounded-xl bg-white/5 text-[11px] font-black uppercase text-text-secondary hover:bg-white/10 transition-all">Inspect Pipeline</button>
           </div>
        </div>
      </div>

      {/* Right: Operations Feed */}
      <div className="xl:col-span-1 h-full">
        <EventFeed events={events} />
      </div>

    </div>
  );
});

export default LiveSection;
