import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Globe, Bell, Settings, X, BarChart2, 
  MessageSquare, Users, Zap 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar = ({ isOpen, setIsOpen }: SidebarProps) => {
  const navItems = [
    { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/domains', icon: <Globe size={18} />, label: 'Domains' },
    { to: '/send-notification', icon: <Bell size={18} />, label: 'Send Notification' },
    { to: '/campaigns', icon: <MessageSquare size={18} />, label: 'Campaigns' },
    { to: '/subscriptions', icon: <Users size={18} />, label: 'Subscriptions' },
    { to: '/analytics', icon: <BarChart2 size={18} />, label: 'Analytics' },
    { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile backdrop with blur */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col
          bg-sidebar text-sidebar-foreground
          transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300 ease-in-out
          lg:static lg:inset-0 border-r border-sidebar-border`}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Beacon</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 rounded-md text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent'
                }`
              }
              onClick={() => setIsOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white shadow-md">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">Beacon v2.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;