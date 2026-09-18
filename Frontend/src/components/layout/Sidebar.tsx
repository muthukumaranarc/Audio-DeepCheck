import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PhoneCall,
  Clock,
  BarChart3,
  Layers,
  Settings,
  HelpCircle,
  Activity
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Active Calls', path: '/active-calls', icon: PhoneCall, badge: '3' },
    { name: 'Call History', path: '/call-history', icon: Clock },
    { name: 'Analysis Reports', path: '/reports', icon: BarChart3 },
    { name: 'Evidence Viewer', path: '/evidence', icon: Layers },
  ];

  const bottomItems = [
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Help', path: '/help', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 h-screen sticky top-0 flex flex-col justify-between shrink-0 select-none overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            {/* Audio Wave Logo */}
            <div className="relative flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none">
                <rect x="2" y="11" width="3.5" height="14" rx="1.75" fill="#0D9488" />
                <rect x="8.5" y="6" width="3.5" height="24" rx="1.75" fill="#10B981" />
                <rect x="15" y="2" width="3.5" height="32" rx="1.75" fill="#06B6D4" />
                <rect x="21.5" y="8" width="3.5" height="20" rx="1.75" fill="#3B82F6" />
                <rect x="28" y="13" width="3.5" height="10" rx="1.75" fill="#6366F1" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight tracking-tight flex items-center gap-1">
                Audio <span className="text-[#0D9488]">DeepCheck</span>
              </h1>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium tracking-tight">
            Detect AI Voices. Build a Safer Tomorrow.
          </p>
        </div>

        {/* Primary Navigation Links */}
        <nav className="mt-4 px-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive: active }) =>
                  `relative flex items-center justify-between px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    active
                      ? 'bg-[#E8F8F0] text-[#059669] font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                  }`
                }
              >
                {/* Active Indicator Bar on Left */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#10B981] rounded-r-full" />
                )}

                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#10B981]' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[#EF4444] rounded-full shadow-xs">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Center/Lower Graphic Banner */}
      <div className="px-6 my-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/40 via-sky-50/30 to-indigo-50/40 p-4 border border-slate-100">
          {/* Subtle wavy illustration */}
          <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
              <path
                d="M0 60C30 30 70 80 120 40V80H0V60Z"
                fill="url(#wave-gradient)"
              />
              <defs>
                <linearGradient id="wave-gradient" x1="0" y1="0" x2="120" y2="80" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#06B6D4" />
                  <stop offset="1" stopColor="#3B82F6" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="relative z-10">
            <h3 className="text-slate-800 font-bold text-sm tracking-tight">Smarter</h3>
            <h3 className="text-slate-800 font-bold text-sm tracking-tight">Detection</h3>
            <p className="text-[#10B981] font-bold text-sm mt-0.5 tracking-tight">
              Safer Tomorrow
            </p>
            <div className="w-6 h-0.5 bg-[#10B981] rounded-full mt-1.5" />
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-slate-100">
        <div className="space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive: active }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer Meta */}
        <div className="mt-4 px-4 text-[11px] text-slate-400">
          <p className="font-medium">Audio DeepCheck v1.0.0</p>
          <p className="text-slate-400/80">Team Zero</p>
        </div>
      </div>
    </aside>
  );
};
