import Card from './Card';
import { SkeletonCard } from './Skeleton';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCard({ title, value, delta, deltaLabel, icon: Icon, loading, isCost = false }) {
  if (loading) return <SkeletonCard />;

  const isPositive = delta > 0;
  
  const isGood = isCost ? !isPositive : isPositive;
  const deltaColor = isGood ? 'text-brand' : 'text-accent-red';
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between">
        <h3 className="text-text-secondary text-sm font-medium">{title}</h3>
        {Icon && (
          <div className="p-2 bg-white/5 rounded-xl border border-white/5">
            <Icon size={18} className="text-brand" />
          </div>
        )}
      </div>
      <div className="mt-4">
        <span className="text-[32px] font-mono font-bold tracking-tight text-text-primary">
          {value}
        </span>
      </div>
      {(delta !== undefined && delta !== null) && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary">
          <div className={`flex items-center gap-0.5 px-2 py-1 rounded-md bg-white/5 ${deltaColor} font-medium`}>
            <DeltaIcon size={14} />
            {Math.abs(delta).toFixed(1)}%
          </div>
          {deltaLabel && <span>{deltaLabel}</span>}
        </div>
      )}
    </Card>
  );
}
