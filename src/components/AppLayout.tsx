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
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Offline indicator - positioned at top */}
      <div className="fixed top-4 right-4 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>

      {/* Main content area with responsive padding */}
      <main 
        className={cn(
          'min-h-screen safe-area-top',
          // Account for navigation height + safe area on all screens
          'pb-20',
          // Standard padding
          'px-4',
          className
        )}
      >
        <div className="mx-auto max-w-3xl">
          {children}
        </div>
      </main>
      
      {/* Navigation - show on all screens */}
      <MobileNavigation />

      {/* PWA install prompt */}
      <PWAInstallPrompt />
    </div>
  );
}