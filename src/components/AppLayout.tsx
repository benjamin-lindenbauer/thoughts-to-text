'use client';

import React, { useEffect, useRef } from 'react';
import { NavigationBar } from './NavigationBar';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { pwaManager } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

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
  const scrollRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // Initialize PWA manager in production and on localhost for dev testing
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );

    if (process.env.NODE_ENV === 'production' || isLocalhost) {
      pwaManager.registerServiceWorker();
      pwaManager.setupInstallPrompt();
    }
  }, []);

  // Enable swipe navigation between tabs on mobile within the main scroll container
  useSwipeNavigation(scrollRef, {
    threshold: 60,
    horizontalIntentRatio: 1.5,
    maxDurationMs: 800,
  });

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full bg-background transition-colors duration-200">
      {/* Offline indicator - positioned at top */}
      <div className="fixed top-4 right-4 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <OfflineIndicator />
        </div>
      </div>

      {/* Fixed Header */}
      {header ? (
        <header className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-b border-border z-40">
          <div className="mx-auto max-w-3xl h-full flex items-center pl-0 md:pl-2 pr-2 md:pr-4">
            {header}
          </div>
        </header>
      ) : null}

      {/* Scrollable Content Area between header and bottom nav */}
      <main
        ref={scrollRef}
        data-app-scroll="true"
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
      {/* <PWAInstallPrompt /> */}
    </div>
  );
}