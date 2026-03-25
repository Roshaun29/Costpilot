export function GlassCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`glass-card content-card ${className}`.trim()}>
      {(title || subtitle || action) && (
        <header className="card-header">
          <div>
            {subtitle ? <p className="eyebrow">{subtitle}</p> : null}
            {title ? <h3>{title}</h3> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
