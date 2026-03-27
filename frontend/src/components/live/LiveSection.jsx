import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { useLiveData } from '../../hooks/useLiveData';

import LiveCostChart from './LiveCostChart';
import StoragePanel from './StoragePanel';
import MetricTicker from './MetricTicker';

const MAX_POINTS = 60;

const LiveSection = React.memo(() => {
  const { isRunning } = useSimulationStore();
  const { liveMetrics } = useLiveData();

  const [chartHistory, setChartHistory] = useState(() => {
    // initialize empty array for cost line
    return Array.from({ length: 15 }, (_, i) => ({ time: '', cost: 0 }));
  });

  const [storage, setStorage] = useState(0);

  useEffect(() => {
    if (!liveMetrics) return;

    setStorage(liveMetrics.storage || 0);

    setChartHistory(prev => {
      const newPoint = {
        time: liveMetrics.time,
        cost: liveMetrics.cost
      };
      const updated = [...prev, newPoint];
      if (updated.length > MAX_POINTS) {
        return updated.slice(updated.length - MAX_POINTS);
      }
      return updated;
    });

  }, [liveMetrics]);

  return (
    <div className="flex flex-col gap-6 mb-6">
      <MetricTicker isRunning={isRunning} metrics={liveMetrics} />
      
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-3/4">
          <div className="bg-surface-raised/50 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl p-6 relative">
            {!isRunning && (
              <div className="absolute inset-0 bg-black/50 z-10 flex flex-col justify-center items-center backdrop-blur-[2px] rounded-2xl">
                <span className="bg-[#18181D] px-3 py-1.5 rounded text-white font-bold text-xs ring-1 ring-white/10 uppercase tracking-widest shadow-2xl">Simulation Paused</span>
              </div>
            )}
            <div className="flex justify-between items-end mb-4">
              <div>
                <h2 className="text-lg font-display font-medium text-white">Live Cost Rate</h2>
                <p className="text-xs text-text-secondary">Accumulating total cost per session run</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-brand animate-pulse' : 'bg-text-secondary'}`} />
                <span className={`text-[10px] font-bold tracking-widest uppercase ${isRunning ? 'text-brand' : 'text-text-secondary'}`}>
                  {isRunning ? 'Streaming' : 'Offline'}
                </span>
              </div>
            </div>
            
            <LiveCostChart data={chartHistory} height={200} />
          </div>
        </div>

        <div className="w-full lg:w-1/4">
          <StoragePanel storage={storage} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
});

export default LiveSection;
