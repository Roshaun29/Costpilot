import { Bell, Menu, Search } from 'lucide-react';

export function Topbar({ onMenuClick, user }) {
  return (
    <header className="topbar glass-card">
      <div className="topbar-left">
        <button className="icon-button mobile-only" onClick={onMenuClick} type="button">
          <Menu size={18} />
        </button>
        <div>
          <p className="eyebrow">Spend intelligence workspace</p>
          <h2>Welcome back, {user.name}</h2>
        </div>
      </div>

      <div className="topbar-right">
        <label className="search-shell">
          <Search size={16} />
          <input type="text" placeholder="Search services, alerts, reports" />
        </label>
        <button className="icon-button" type="button">
          <Bell size={18} />
        </button>
        <div className="profile-pill">
          <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
