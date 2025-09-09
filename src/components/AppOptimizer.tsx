'use client';

import React, { useEffect, useState } from 'react';
import { performanceMonitor } from '@/lib/performance';
import { PerformanceDebugger } from './PerformanceOptimizer';

interface AppOptimizerProps {
  children: React.ReactNode;
}

export function AppOptimizer({ children }: AppOptimizerProps) {
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    // Initialize performance monitoring
    const initializeOptimizations = async () => {
      try {
        // 1. Preload critical resources
        await preloadCriticalResources();
        
        // 2. Initialize service worker optimizations
        await initializeServiceWorker();
        
        // 3. Setup performance monitoring
        setupPerformanceMonitoring();
        
        // 4. Optimize images and assets
        optimizeAssets();
        
        // 5. Setup memory management
        setupMemoryManagement();
        
        setIsOptimized(true);
        console.log('App optimizations initialized');
      } catch (error) {
        console.warn('Some optimizations failed to initialize:', error);
        setIsOptimized(true); // Continue anyway
      }
    };

    initializeOptimizations();

    // Cleanup on unmount
    return () => {
      performanceMonitor.cleanup();
    };
  }, []);

  return (
    <>
      {children}
      {process.env.NODE_ENV === 'development' && <PerformanceDebugger />}
    </>
  );
}

// Preload critical resources
async function preloadCriticalResources() {
  const criticalResources = [
    '/manifest.json',
    '/icon_192.png',
    '/icon_512.png'
  ];

  const preloadPromises = criticalResources.map(resource => {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.onload = () => resolve(resource);
      link.onerror = () => resolve(resource); // Don't fail on errors
      document.head.appendChild(link);
    });
  });

  await Promise.all(preloadPromises);
  performanceMonitor.recordMetric('critical-resources-preloaded', preloadPromises.length, 'custom');
}

// Initialize service worker with optimizations
async function initializeServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates
    });

    // Listen for service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is available
            console.log('New service worker available');
            // Could show update notification here
          }
        });
      }
    });

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      if (data.type === 'SW_ACTIVATED') {
        console.log('Service worker activated with version:', data.version);
        performanceMonitor.recordMetric('sw-activation', 1, 'custom');
      }
    });

    performanceMonitor.recordMetric('sw-registration', 1, 'custom');
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}

// Setup comprehensive performance monitoring
function setupPerformanceMonitoring() {
  // Monitor Core Web Vitals
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          performanceMonitor.recordMetric('lcp', entry.startTime, 'timing');
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as PerformanceEventTiming;
          performanceMonitor.recordMetric('fid', fidEntry.processingStart - fidEntry.startTime, 'timing');
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        performanceMonitor.recordMetric('cls', clsValue, 'custom');
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

    } catch (error) {
      console.warn('Performance observers setup failed:', error);
    }
  }

  // Monitor network conditions
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    performanceMonitor.recordMetric('network-downlink', connection.downlink || 0, 'custom');
    performanceMonitor.recordMetric('network-rtt', connection.rtt || 0, 'timing');
  }

  // Monitor page visibility changes
  document.addEventListener('visibilitychange', () => {
    performanceMonitor.recordMetric(
      'page-visibility', 
      document.hidden ? 0 : 1, 
      'custom'
    );
  });
}

// Optimize images and assets
function optimizeAssets() {
  // Lazy load images
  const images = document.querySelectorAll('img[data-src]');
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px' // Start loading 50px before entering viewport
    });

    images.forEach(img => imageObserver.observe(img));
  }

  // Preload next page resources on hover
  const links = document.querySelectorAll('a[href^="/"]');
  links.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const href = (link as HTMLAnchorElement).href;
      if (href && !document.querySelector(`link[href="${href}"]`)) {
        const prefetchLink = document.createElement('link');
        prefetchLink.rel = 'prefetch';
        prefetchLink.href = href;
        document.head.appendChild(prefetchLink);
      }
    }, { once: true });
  });
}

// Setup memory management
function setupMemoryManagement() {
  // Monitor memory usage
  const checkMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      
      performanceMonitor.recordMetric('memory-used-mb', usedMB, 'memory');
      performanceMonitor.recordMetric('memory-total-mb', totalMB, 'memory');
      
      // Warn if memory usage is high
      if (usedMB > 100) { // > 100MB
        console.warn(`High memory usage detected: ${usedMB.toFixed(2)}MB`);
      }
    }
  };

  // Check memory every 30 seconds
  const memoryInterval = setInterval(checkMemoryUsage, 30000);
  
  // Initial check
  checkMemoryUsage();

  // Cleanup old performance entries
  const cleanupInterval = setInterval(() => {
    if ('clearResourceTimings' in performance) {
      performance.clearResourceTimings();
    }
  }, 300000); // Every 5 minutes

  // Store cleanup functions for later use
  (window as any).__appCleanup = () => {
    clearInterval(memoryInterval);
    clearInterval(cleanupInterval);
  };
}

// Bundle analyzer for development
export function BundleAnalyzer() {
  const [bundleInfo, setBundleInfo] = useState<any>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const analyzeBundles = () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      
      const analysis = {
        scripts: scripts.length,
        stylesheets: stylesheets.length,
        estimatedSize: scripts.length * 50 + stylesheets.length * 20, // Rough estimate in KB
        nextJsChunks: scripts.filter(s => (s as HTMLScriptElement).src.includes('/_next/')).length
      };

      setBundleInfo(analysis);
      performanceMonitor.recordMetric('bundle-scripts', analysis.scripts, 'custom');
      performanceMonitor.recordMetric('bundle-stylesheets', analysis.stylesheets, 'custom');
    };

    // Analyze after initial load
    setTimeout(analyzeBundles, 1000);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !bundleInfo) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/80 text-white p-2 rounded text-xs">
      <div>Scripts: {bundleInfo.scripts}</div>
      <div>Styles: {bundleInfo.stylesheets}</div>
      <div>Est. Size: {bundleInfo.estimatedSize}KB</div>
      <div>Next.js Chunks: {bundleInfo.nextJsChunks}</div>
    </div>
  );
}