import { Zap } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0B] flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full border-t-2 border-brand animate-spin" />
        <Zap size={32} className="text-brand animate-pulse" fill="currentColor" />
      </div>
      <p className="mt-8 font-mono text-xs tracking-widest text-[#8A8A9A] uppercase">Initializing CostPilot Space</p>
    </div>
  );
}
