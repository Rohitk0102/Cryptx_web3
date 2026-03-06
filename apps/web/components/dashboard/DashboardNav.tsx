'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/dashboard' || path === '/dashboard/portfolio') {
      return pathname === '/dashboard' || pathname === '/dashboard/portfolio';
    }
    return pathname?.startsWith(path);
  };

  const navItems = [
    { path: '/dashboard/portfolio', label: 'Portfolio' },
    { path: '/dashboard/tracking', label: 'Live Tracking' },
    { path: '/dashboard/transactions', label: 'Transactions' },
    { path: '/dashboard/pnl', label: 'Profit & Loss' },
    { path: '/dashboard/forecasting', label: 'AI Forecasting' },
  ];

  return (
    <div className="glass-nav sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto" role="navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              prefetch={true}
              className={`
                relative py-4 px-4 text-sm font-medium whitespace-nowrap transition-all duration-200
                border-b-2 shrink-0
                ${isActive(item.path)
                  ? 'text-[#00FFB2] border-[#00FFB2]'
                  : 'text-[#D5D5D5]/60 border-transparent hover:text-[#D5D5D5] hover:border-white/20'
                }
              `}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
