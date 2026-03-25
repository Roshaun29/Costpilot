import { Activity, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const iconMap = {
  Dashboard: LayoutDashboard,
  Anomalies: AlertTriangle,
};

export function Sidebar({ open, onClose, items }) {
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar-panel ${open ? 'is-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">
            <Activity size={18} />
          </div>
          <div>
            <p className="eyebrow">Cloud Intelligence</p>
            <h1>Cost Command</h1>
          </div>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = iconMap[item.label] || LayoutDashboard;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'is-active' : ''}`
                }
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer glass-card">
          <p className="eyebrow">Monitoring</p>
          <strong>Realtime anomaly watch</strong>
          <span>Cost drift across 7 linked environments.</span>
        </div>
      </aside>
    </>
  );
}
