'use client';

import React, { useEffect } from 'react';
import { MobileNavigation } from './MobileNavigation';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { pwaManager } from '@/lib/pwa';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ 
  children, 
  className
}: AppLayoutProps) {
  useEffect(() => {
    // Initialize PWA manager
    pwaManager.registerServiceWorker();
    pwaManager.setupInstallPrompt();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background transition-colors duration-200 overflow-hidden">
      {/* Offline indicator - positioned at top */}
      <div className="fixed top-4 right-4 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>

      {/* Main content area - scrollable */}
      <main 
        className={cn(
          'flex-1 overflow-y-auto safe-area-top',
          // Standard padding
          'px-2 md:px-4',
          // Account for navigation height + safe area
          'pb-20',
          className
        )}
      >
        <div className="mx-auto max-w-3xl">
          {children}
        </div>
      </main>
      
      {/* Navigation - fixed at bottom, outside scroll area */}
      <MobileNavigation />

      {/* PWA install prompt */}
      <PWAInstallPrompt />
    </div>
  );
}