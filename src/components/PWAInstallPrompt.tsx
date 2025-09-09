'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/useOffline';
import { Download, X, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PWAInstallPromptProps {
  className?: string;
}

export function PWAInstallPrompt({ className }: PWAInstallPromptProps) {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show prompt after a delay if can install and not already installed
    if (canInstall && !isInstalled) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000); // Show after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!canInstall || isInstalled || isDismissed || !isVisible) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm",
      "bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700",
      "p-4 animate-in slide-in-from-bottom-2 duration-300",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Install App
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Add Thoughts to Text to your home screen for quick access and offline use.
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleInstall}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// Compact install button for settings or header
export function PWAInstallButton({ className }: { className?: string }) {
  const { canInstall, isInstalled, install } = usePWAInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <button
      onClick={install}
      disabled={isInstalled}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium",
        "bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50",
        "text-indigo-700 dark:text-indigo-300 rounded-md transition-colors",
        className
      )}
    >
      <Download className="w-4 h-4" />
      {isInstalled ? 'Already installed' : 'Install App'}
    </button>
  );
}