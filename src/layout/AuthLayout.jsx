import { Link } from 'react-router-dom';

export function AuthLayout({ title, subtitle, footerText, footerLinkLabel, footerLinkTo, children }) {
  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="auth-copy">
          <p className="eyebrow">Cloud cost anomaly intelligence</p>
          <h1>See spend shifts before they become budget fires.</h1>
          <p>
            A polished control center for tracking sync health, anomaly spikes, and cost drift across cloud services.
          </p>
        </div>
      </div>

      <div className="auth-card-shell">
        <div className="glass-card auth-card">
          <div className="card-header auth-header">
            <div>
              <p className="eyebrow">Secure workspace access</p>
              <h2>{title}</h2>
            </div>
            <p>{subtitle}</p>
          </div>
          {children}
          <p className="auth-footer">
            {footerText} <Link to={footerLinkTo}>{footerLinkLabel}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
