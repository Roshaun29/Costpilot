export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div className="relative" onClick={() => !disabled && onChange(!checked)}>
        <input type="checkbox" className="sr-only" checked={checked} readOnly />
        <div
          className={`w-10 h-6 rounded-full transition-colors duration-200 ${
            checked ? 'bg-brand' : 'bg-surface-overlay border border-white/10'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      {label && (
        <span className="text-sm text-text-secondary">{label}</span>
      )}
    </label>
  );
}
