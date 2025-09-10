'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenText, Mic, Settings } from 'lucide-react';
import { OfflineIndicatorCompact } from './OfflineIndicator';
import { cn } from '@/lib/utils';
import { NAV_ROUTE_ORDER, NavRoute } from '@/lib/nav-order';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}

const navConfig: Record<NavRoute, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  '/notes': { icon: BookOpenText, label: 'Notes' },
  '/': { icon: Mic, label: 'Record' },
  '/settings': { icon: Settings, label: 'Settings' },
};

const navItems: NavItem[] = NAV_ROUTE_ORDER.map((href) => ({
  href,
  icon: navConfig[href as NavRoute].icon,
  label: navConfig[href as NavRoute].label,
}));

export function NavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      {/* Offline indicator bar */}
      <div className="absolute top-0 left-4 right-4 -translate-y-1/2">
        <OfflineIndicatorCompact className="mx-auto" />
      </div>

      <div className="mx-auto max-w-3xl h-full">
        <div className="flex items-center justify-around px-4 h-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && !!pathname && pathname.startsWith(item.href + '/'));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200',
                  'size-16 touch-manipulation relative',
                  'active:scale-95 active:bg-accent/50',
                  isActive
                    ? 'text-indigo-500 bg-gradient-to-r from-indigo-100 to-purple-100 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  item.className
                )}
              >
                <Icon className={cn(
                  'transition-transform duration-200',
                  isActive ? 'h-6 w-6' : 'h-5 w-5'
                )} />
                <span className={cn(
                  'text-xs font-medium transition-all duration-200',
                  isActive ? 'font-semibold' : ''
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}