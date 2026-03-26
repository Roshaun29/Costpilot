import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import SimulationToggle from '../ui/SimulationToggle';
import AlertBell from '../alerts/AlertBell';

const routeNames = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Cloud Accounts',
  '/costs': 'Cost Explorer',
  '/anomalies': 'Anomalies',
  '/alerts': 'Alerts',
  '/insights': 'Insights',
  '/activity': 'Activity Log',
  '/settings': 'Settings',
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const title = routeNames[location.pathname] || 'CostPilot';

  return (
    <header className="h-16 fixed top-0 right-0 left-0 lg:left-[240px] z-30 bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-white/[0.07] px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-white" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <h1 className="text-xl font-display font-medium text-text-primary hidden sm:block">{title}</h1>
      </div>
      
      <div className="flex items-center gap-4 sm:gap-6">
        <SimulationToggle />
        <div className="w-[1px] h-6 bg-white/10 hidden sm:block"></div>
        <AlertBell />
      </div>
    </header>
  );
}
