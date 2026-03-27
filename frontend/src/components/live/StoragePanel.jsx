import React from 'react';
import Card from '../ui/Card';

const StoragePanel = React.memo(({ storage, isRunning }) => {
  // Cap at 100 for display, or show max.
  const percentage = Math.min((storage / 100) * 100, 100);

  return (
    <Card className="relative overflow-hidden h-full flex flex-col justify-center">
      {!isRunning && (
        <div className="absolute inset-0 bg-black/60 z-10 flex flex-col justify-center items-center backdrop-blur-sm">
          <span className="bg-[#18181D] px-3 py-1.5 rounded text-white font-bold text-xs ring-1 ring-white/10 uppercase tracking-widest shadow-2xl">
            Simulation Paused
          </span>
        </div>
      )}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-display font-medium text-white">Storage Bound</h3>
        <span className="text-xs font-mono text-brand">{storage.toFixed(3)} GB</span>
      </div>
      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-brand h-full rounded-full transition-all duration-100 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  );
});

export default StoragePanel;
