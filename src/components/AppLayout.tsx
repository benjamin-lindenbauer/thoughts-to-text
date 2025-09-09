'use client';

import React, { useEffect } from 'react';
import { NavigationBar } from './NavigationBar';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { pwaManager } from '@/lib/pwa';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
}

export function AppLayout({ 
  children, 
  header,
  className
}: AppLayoutProps) {
  useEffect(() => {
    // Initialize PWA manager (only in production to avoid dev caching issues)
    if (process.env.NODE_ENV === 'production') {
      pwaManager.registerServiceWorker();
      pwaManager.setupInstallPrompt();
    }
  }, []);

  return (
    <div className="relative h-screen min-h-0 w-full bg-background transition-colors duration-200 overflow-hidden">
      {/* Offline indicator - positioned at top */}
      <div className="fixed top-4 right-4 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>

      {/* Fixed Header */}
      {header && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-b border-border z-40">
          <div className="mx-auto max-w-3xl h-full flex items-center pl-0 md:pl-2 pr-2 md:pr-4">
            {header}
          </div>
        </header>
      )}

      {/* Scrollable Content Area between header and bottom nav */}
      <main
        className={cn(
          'fixed left-0 right-0 bottom-20 overflow-y-auto overflow-x-hidden',
          header ? 'top-14' : 'top-0',
          className
        )}
      >
        <div className="w-full max-w-3xl min-h-full mx-auto p-2 md:p-4">
          {children}
        </div>
      </main>

      {/* Fixed bottom navigation */}
      <NavigationBar />

      {/* PWA install prompt */}
      {/*<PWAInstallPrompt />*/}
    </div>
  );
}