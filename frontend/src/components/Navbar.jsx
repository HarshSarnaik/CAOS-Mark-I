import { Link, useLocation } from 'react-router-dom';
import { Shield, Radio, Zap } from 'lucide-react';

export default function Navbar() {
  const { pathname } = useLocation();

  const navLink = (to, icon, label) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        id={`nav-${label.toLowerCase()}`}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          transition-all duration-200
          ${active
            ? 'bg-surface-700 text-white'
            : 'text-surface-300 hover:text-white hover:bg-surface-800'
          }
        `}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 border-b border-surface-700/60
                        bg-surface-900/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" id="nav-logo" className="flex items-center gap-3 group">
          {/* Four-colour Google-style logo mark */}
          <div className="relative w-8 h-8 flex-shrink-0">
            <div className="absolute inset-0 rounded-lg bg-surface-800 border border-surface-700
                            group-hover:shadow-glow transition-shadow duration-300" />
            <div className="absolute inset-0 grid grid-cols-2 gap-[2px] p-[5px]">
              <div className="rounded-sm bg-google-blue" />
              <div className="rounded-sm bg-google-red" />
              <div className="rounded-sm bg-google-green" />
              <div className="rounded-sm bg-google-yellow" />
            </div>
          </div>
          <span className="font-bold text-lg tracking-tight">
            CAOS
            <span className="text-google-blue">-</span>
            Mark
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                           bg-google-blue/10 border border-google-blue/20
                           text-google-blue text-[10px] font-bold tracking-widest uppercase">
            <Zap size={8} />
            Beta
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLink('/',      <Shield size={15} />,  'Protect')}
          {navLink('/radar', <Radio  size={15} />,  'Radar')}
        </div>

        {/* Status pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full
                        bg-surface-800 border border-surface-700 text-xs text-surface-300">
          <span className="w-1.5 h-1.5 rounded-full bg-google-green dot-pulse" />
          System Online
        </div>
      </nav>
    </header>
  );
}
