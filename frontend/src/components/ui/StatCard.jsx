import Card from './Card';
import { SkeletonCard } from './Skeleton';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import { formatINR } from '../../utils/currency';
import { motion, AnimatePresence } from 'framer-motion';

export default function StatCard({ title, value, numericValue, subValue, delta, deltaLabel, icon: Icon, loading, isCost = false, trend }) {
  if (loading && numericValue === undefined && value === undefined) return <SkeletonCard />;

  const animatedValue = useCountUp(numericValue || 0);
  const displayValue = numericValue !== undefined ? formatINR(animatedValue) : value;

  const isPositive = delta > 0;
  const isGood = isCost ? !isPositive : isPositive;
  const deltaColor = isGood ? 'text-brand' : 'text-accent-red';
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  const isLive = title.toLowerCase().includes('live');

  return (
    <Card className={`group relative transition-all duration-500 hover:border-brand/40 shadow-card ${isLive ? 'overflow-hidden' : ''}`}>
      {isLive && (
        <div className="absolute top-0 right-0 p-3">
           <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
          </div>
        </div>
      )}
      
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-text-secondary text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
            {title}
            {trend}
          </h3>
        </div>
        {Icon && (
          <div className="p-2.5 bg-bg-overlay rounded-xl border border-border-subtle group-hover:bg-brand/10 transition-colors">
            <Icon size={18} className="text-brand" />
          </div>
        )}
      </div>

      <div className="mt-5 mb-2 h-10 flex items-end">
        <span className="text-[28px] font-display font-bold tracking-tight text-text-primary leading-none">
          {displayValue}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 min-h-[24px]">
        {delta !== undefined && delta !== null ? (
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-bg-overlay ${deltaColor} font-black border border-border-subtle`}>
              <DeltaIcon size={12} strokeWidth={3} />
              {Math.abs(delta).toFixed(1)}%
            </div>
            {deltaLabel && <span className="font-medium">{deltaLabel}</span>}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {subValue && (
              <motion.span 
                key={subValue}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-[11px] text-text-muted font-mono uppercase tracking-tight"
              >
                {subValue}
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </div>
    </Card>
  );
}
