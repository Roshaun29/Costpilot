export default function Badge({ children, variant = 'default', severity, status, provider, className = '' }) {
  const base = "inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-lg border";
  
  let styles = "bg-white/5 border-white/10 text-text-secondary";
  
  if (severity) {
    const s = severity.toLowerCase();
    if (s === 'low') styles = "bg-brand/10 border-brand/20 text-brand";
    if (s === 'medium') styles = "bg-yellow-500/10 border-yellow-500/20 text-yellow-500";
    if (s === 'high') styles = "bg-orange-500/10 border-orange-500/20 text-orange-500";
    if (s === 'critical') styles = "bg-accent-red/10 border-accent-red/20 text-accent-red";
  } else if (status) {
    const s = status.toLowerCase();
    if (s === 'open') styles = "bg-accent-red/10 border-accent-red/20 text-accent-red";
    if (s === 'acknowledged') styles = "bg-yellow-500/10 border-yellow-500/20 text-yellow-500";
    if (s === 'resolved') styles = "bg-brand/10 border-brand/20 text-brand";
    if (s === 'synced') styles = "bg-brand/10 border-brand/20 text-brand";
    if (s === 'syncing') styles = "bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse";
    if (s === 'idle') styles = "bg-white/5 border-white/10 text-text-secondary";
  } else if (provider) {
    const p = provider.toLowerCase();
    if (p === 'aws') styles = "bg-[#FF9900]/10 border-[#FF9900]/20 text-[#FF9900]";
    if (p === 'azure') styles = "bg-[#008AD7]/10 border-[#008AD7]/20 text-[#008AD7]";
    if (p === 'gcp') styles = "bg-[#4285F4]/10 border-[#4285F4]/20 text-[#4285F4]";
  }

  return (
    <span className={`${base} ${styles} ${className}`}>
      {children}
    </span>
  );
}
