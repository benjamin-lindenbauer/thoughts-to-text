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
  showMobileNav?: boolean;
}

export function AppLayout({ 
  children, 
  className,
  showMobileNav = true 
}: AppLayoutProps) {
  useEffect(() => {
    // Initialize PWA manager
    pwaManager.registerServiceWorker();
    pwaManager.setupInstallPrompt();
  }, []);

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Offline indicator - positioned at top */}
      <div className="fixed top-4 left-4 right-4 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>

      {/* Main content area with responsive padding */}
      <main 
        className={cn(
          'min-h-screen safe-area-top',
          // Mobile: account for navigation height + safe area
          showMobileNav && 'pb-20',
          // Desktop: standard padding
          'md:px-6 md:py-4',
          // Add top padding to account for offline indicator
          'pt-4',
          className
        )}
      >
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
      
      {/* Mobile navigation - only show on mobile screens */}
      {showMobileNav && (
        <div className="md:hidden">
          <MobileNavigation />
        </div>
      )}

      {/* PWA install prompt */}
      <PWAInstallPrompt />
    </div>
  );
}