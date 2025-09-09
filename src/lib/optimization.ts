// Performance optimization utilities

import React, { lazy, ComponentType } from 'react';

// Enhanced lazy loading with error boundaries and loading states
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: ComponentType
) {
  const LazyComponent = lazy(importFn);
  
  const WrappedComponent = (props: React.ComponentProps<T>) => {
    return React.createElement(
      React.Suspense,
      {
        fallback: fallback 
          ? React.createElement(fallback) 
          : React.createElement('div', 
              { className: 'flex items-center justify-center p-4' },
              React.createElement('div', { 
                className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500' 
              })
            )
      },
      React.createElement(LazyComponent, props)
    );
  };
  
  return WrappedComponent;
}

// Preload components for better UX
export function preloadComponent(importFn: () => Promise<any>) {
  // Start loading the component
  const componentPromise = importFn();
  
  // Return a function to wait for the component to be loaded
  return () => componentPromise;
}

// Image optimization utilities
export function optimizeImageLoading() {
  // Preload critical images
  const preloadImage = (src: string, priority: boolean = false) => {
    const link = document.createElement('link');
    link.rel = priority ? 'preload' : 'prefetch';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  };
  
  // Lazy load images with intersection observer
  const lazyLoadImages = () => {
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
      });
      
      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for browsers without IntersectionObserver
      images.forEach(img => {
        const imgElement = img as HTMLImageElement;
        imgElement.src = imgElement.dataset.src!;
      });
    }
  };
  
  return { preloadImage, lazyLoadImages };
}

// Bundle size optimization
export function optimizeBundleSize() {
  // Dynamic imports for heavy libraries
  const loadHeavyLibrary = async (libraryName: string) => {
    switch (libraryName) {
      case 'openai':
        return await import('openai');
      case 'localforage':
        return await import('localforage');
      default:
        throw new Error(`Unknown library: ${libraryName}`);
    }
  };
  
  // Tree-shake unused utilities
  const importOnlyNeeded = {
    lucide: {
      // Only import icons that are actually used
      Mic: () => import('lucide-react').then(mod => ({ default: mod.Mic })),
      Play: () => import('lucide-react').then(mod => ({ default: mod.Play })),
      Pause: () => import('lucide-react').then(mod => ({ default: mod.Pause })),
      Settings: () => import('lucide-react').then(mod => ({ default: mod.Settings })),
      History: () => import('lucide-react').then(mod => ({ default: mod.History })),
    }
  };
  
  return { loadHeavyLibrary, importOnlyNeeded };
}

// Memory optimization
export function optimizeMemoryUsage() {
  // Cleanup functions for preventing memory leaks
  const cleanupFunctions: (() => void)[] = [];
  
  const addCleanup = (fn: () => void) => {
    cleanupFunctions.push(fn);
  };
  
  const runCleanup = () => {
    cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    });
    cleanupFunctions.length = 0;
  };
  
  // Audio blob cleanup
  const cleanupAudioBlobs = (blobs: Blob[]) => {
    blobs.forEach(blob => {
      if (blob && typeof URL !== 'undefined') {
        URL.revokeObjectURL(URL.createObjectURL(blob));
      }
    });
  };
  
  // Event listener cleanup
  const createEventListenerCleanup = (
    element: EventTarget,
    event: string,
    handler: EventListener
  ) => {
    element.addEventListener(event, handler);
    return () => element.removeEventListener(event, handler);
  };
  
  return {
    addCleanup,
    runCleanup,
    cleanupAudioBlobs,
    createEventListenerCleanup
  };
}

// Performance monitoring integration
export function integratePerformanceMonitoring() {
  // Web Vitals measurement (simplified without external dependency)
  const measureWebVitals = () => {
    if (typeof window === 'undefined') return;
    
    // Measure basic performance metrics
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      console.log('Page Load Time:', navigation.loadEventEnd - navigation.startTime);
      console.log('DOM Content Loaded:', navigation.domContentLoadedEventEnd - navigation.startTime);
    }
    
    // Measure paint timing
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      console.log(`${entry.name}:`, entry.startTime);
    });
  };
  
  // Resource timing analysis
  const analyzeResourceTiming = () => {
    if (typeof window === 'undefined') return;
    
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const analysis = {
      totalResources: resources.length,
      totalSize: 0,
      slowResources: [] as PerformanceResourceTiming[],
      largeResources: [] as PerformanceResourceTiming[],
    };
    
    resources.forEach(resource => {
      const duration = resource.responseEnd - resource.requestStart;
      const size = resource.transferSize || 0;
      
      analysis.totalSize += size;
      
      if (duration > 1000) { // > 1 second
        analysis.slowResources.push(resource);
      }
      
      if (size > 100000) { // > 100KB
        analysis.largeResources.push(resource);
      }
    });
    
    return analysis;
  };
  
  return { measureWebVitals, analyzeResourceTiming };
}

// Service Worker optimization
export function optimizeServiceWorker() {
  // Efficient cache management
  const manageCaches = async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    
    const cacheNames = await caches.keys();
    const currentCaches = ['thoughts-to-text-v2', 'static-v2', 'dynamic-v2', 'api-v2'];
    
    // Delete old caches
    const deletePromises = cacheNames
      .filter(name => !currentCaches.includes(name))
      .map(name => caches.delete(name));
    
    await Promise.all(deletePromises);
  };
  
  // Preload critical resources
  const preloadCriticalResources = async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return;
    
    const cache = await caches.open('static-v2');
    const criticalResources = [
      '/',
      '/manifest.json',
      '/icon_192.png',
      '/icon_512.png'
    ];
    
    await cache.addAll(criticalResources);
  };
  
  return { manageCaches, preloadCriticalResources };
}

// React performance optimizations
export function optimizeReactPerformance() {
  // Memoization helpers
  const createMemoizedComponent = <P extends object>(
    Component: React.ComponentType<P>,
    areEqual?: (prevProps: P, nextProps: P) => boolean
  ) => {
    return React.memo(Component, areEqual);
  };
  
  // Callback optimization
  const useStableCallback = <T extends (...args: any[]) => any>(callback: T): T => {
    const callbackRef = React.useRef(callback);
    callbackRef.current = callback;
    
    return React.useCallback(
      ((...args) => callbackRef.current(...args)) as T,
      []
    );
  };
  
  // State optimization
  const useOptimizedState = <T>(initialState: T) => {
    const [state, setState] = React.useState(initialState);
    
    const optimizedSetState = React.useCallback((newState: T | ((prev: T) => T)) => {
      setState(prev => {
        const next = typeof newState === 'function' ? (newState as (prev: T) => T)(prev) : newState;
        return Object.is(prev, next) ? prev : next;
      });
    }, []);
    
    return [state, optimizedSetState] as const;
  };
  
  return {
    createMemoizedComponent,
    useStableCallback,
    useOptimizedState
  };
}

