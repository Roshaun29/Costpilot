export default function Button({ 
  children, onClick, variant = 'primary', size = 'md', loading, disabled, icon: Icon, className = '', type = 'button' 
}) {
  const base = "inline-flex items-center gap-2 font-bold transition-all rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-brand text-black hover:bg-[#A3E63B] shadow-[0_0_15px_rgba(182,255,74,0.3)]",
    secondary: "bg-surface-raised border border-white/10 text-text-primary hover:bg-white/5",
    danger: "bg-accent-red text-white hover:bg-[#F23B5A] shadow-[0_0_15px_rgba(255,74,106,0.3)]",
    ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled || loading} 
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
      ) : null}
      {children}
    </button>
  );
}
