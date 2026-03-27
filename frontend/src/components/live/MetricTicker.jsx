import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MetricTicker = React.memo(({ isRunning, metrics }) => {
  if (!isRunning) return null;

  return (
    <AnimatePresence>
      <motion.div 
        key="ticker"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-40"
      >
        <div className="bg-surface-raised/90 backdrop-blur-md ring-1 ring-white/10 px-6 py-2 rounded-full flex gap-8 shadow-xl">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">CPU</span>
            <span className="text-xs font-mono font-medium text-white">{metrics?.cpu || 0}%</span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Memory</span>
            <span className="text-xs font-mono font-medium text-white">{metrics?.memory || 0}%</span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Network</span>
            <span className="text-xs font-mono font-medium text-[#4AFFD4]">{metrics?.network || 0} Mbps</span>
          </div>
          <div className="w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Run Cost</span>
            <span className="text-xs font-mono font-medium text-brand">${metrics?.cost?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default MetricTicker;
