'use client';

import React from 'react';
import { MobileNavigation } from './MobileNavigation';
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
  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      {/* Main content area with responsive padding */}
      <main 
        className={cn(
          'min-h-screen safe-area-top',
          // Mobile: account for navigation height + safe area
          showMobileNav && 'pb-20 md:pb-0',
          // Desktop: standard padding
          'md:px-6 md:py-4',
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
    </div>
  );
}