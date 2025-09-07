'use client';

import React, { useEffect, useRef } from 'react';
import { performanceMonitor } from '@/lib/performance';

interface PerformanceOptimizerProps {
  children: React.ReactNode;
  componentName?: string;
  enableMetrics?: boolean;
}

export function PerformanceOptimizer({ 
  children, 
  componentName = 'Component',
  enableMetrics = process.env.NODE_ENV === 'development'
}: PerformanceOptimizerProps) {
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);

  useEffect(() => {
    if (!enableMetrics) return;

    mountTime.current = performance.now();
    
    // Measure component mount time
    const mountDuration = mountTime.current - (renderStartTime.current || mountTime.current);
    performanceMonitor.recordMetric(`${componentName}-mount`, mountDuration, 'timing');

    // Measure memory usage periodically
    const memoryInterval = setInterval(() => {
      performanceMonitor.recordMemoryUsage();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(memoryInterval);
      
      // Record unmount time
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - (mountTime.current || unmountTime);
      performanceMonitor.recordMetric(`${componentName}-lifetime`, totalLifetime, 'timing');
    };
  }, [componentName, enableMetrics]);

  // Record render start time
  if (enableMetrics) {
    renderStartTime.current = performance.now();
  }

  return <>{children}</>;
}

// Higher-order component for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const PerformanceMonitoredComponent = (props: P) => {
    return (
      <PerformanceOptimizer componentName={displayName}>
        <WrappedComponent {...props} />
      </PerformanceOptimizer>
    );
  };

  PerformanceMonitoredComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  
  return PerformanceMonitoredComponent;
}

// Hook for component-level performance monitoring
export function usePerformanceMonitoring(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
    const currentTime = performance.now();
    
    if (lastRenderTime.current) {
      const timeSinceLastRender = currentTime - lastRenderTime.current;
      performanceMonitor.recordMetric(
        `${componentName}-render-interval`, 
        timeSinceLastRender, 
        'timing'
      );
    }
    
    lastRenderTime.current = currentTime;
    
    // Record render count
    performanceMonitor.recordMetric(
      `${componentName}-render-count`, 
      renderCount.current, 
      'custom'
    );
  });

  const measureOperation = (operationName: string, operation: () => void) => {
    const startTime = performance.now();
    operation();
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric(
      `${componentName}-${operationName}`, 
      duration, 
      'timing'
    );
  };

  const measureAsyncOperation = async (operationName: string, operation: () => Promise<void>) => {
    const startTime = performance.now();
    await operation();
    const duration = performance.now() - startTime;
    performanceMonitor.recordMetric(
      `${componentName}-${operationName}`, 
      duration, 
      'timing'
    );
  };

  return {
    measureOperation,
    measureAsyncOperation,
    renderCount: renderCount.current
  };
}

// Performance debugging component (development only)
export function PerformanceDebugger() {
  const [metrics, setMetrics] = React.useState<any[]>([]);
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      const currentMetrics = performanceMonitor.getAllMetrics();
      setMetrics(currentMetrics.slice(-20)); // Show last 20 metrics
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 left-4 z-50 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        title="Toggle Performance Debugger"
      >
        📊
      </button>
      
      {isVisible && (
        <div className="fixed bottom-16 left-4 z-50 bg-black/90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto text-xs">
          <h3 className="font-bold mb-2">Performance Metrics</h3>
          <div className="space-y-1">
            {metrics.map((metric, index) => (
              <div key={index} className="flex justify-between">
                <span className="truncate mr-2">{metric.name}</span>
                <span className="text-yellow-300">
                  {metric.type === 'timing' ? `${metric.value.toFixed(2)}ms` : metric.value}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              performanceMonitor.clearMetrics();
              setMetrics([]);
            }}
            className="mt-2 bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-xs"
          >
            Clear Metrics
          </button>
        </div>
      )}
    </>
  );
}

// Lazy loading wrapper with performance monitoring
export function LazyWrapper({ 
  children, 
  fallback, 
  componentName = 'LazyComponent' 
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
}) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const loadStartTime = useRef<number>(0);

  useEffect(() => {
    loadStartTime.current = performance.now();
    
    // Simulate component loading
    const timer = setTimeout(() => {
      setIsLoaded(true);
      const loadTime = performance.now() - (loadStartTime.current || 0);
      performanceMonitor.recordMetric(`${componentName}-lazy-load`, loadTime, 'timing');
    }, 0);

    return () => clearTimeout(timer);
  }, [componentName]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-4">
        {fallback || (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
        )}
      </div>
    );
  }

  return (
    <PerformanceOptimizer componentName={componentName}>
      {children}
    </PerformanceOptimizer>
  );
}