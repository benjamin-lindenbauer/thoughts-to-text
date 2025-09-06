// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'memory' | 'custom';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.setupObservers();
  }

  private setupObservers() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) return;

    try {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('page-load', navEntry.loadEventEnd - navEntry.navigationStart, 'timing');
            this.recordMetric('dom-content-loaded', navEntry.domContentLoadedEventEnd - navEntry.navigationStart, 'timing');
            this.recordMetric('first-paint', navEntry.loadEventStart - navEntry.navigationStart, 'timing');
          }
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            // Only track significant resources
            if (resourceEntry.transferSize > 10000) { // > 10KB
              this.recordMetric(
                `resource-${resourceEntry.name.split('/').pop()}`,
                resourceEntry.responseEnd - resourceEntry.requestStart,
                'timing'
              );
            }
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.recordMetric('largest-contentful-paint', entry.startTime, 'timing');
          }
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // Observe first input delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'first-input') {
            const fidEntry = entry as PerformanceEventTiming;
            this.recordMetric('first-input-delay', fidEntry.processingStart - fidEntry.startTime, 'timing');
          }
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

    } catch (error) {
      console.warn('Performance monitoring setup failed:', error);
    }
  }

  recordMetric(name: string, value: number, type: PerformanceMetric['type'] = 'custom') {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log significant performance issues
    if (type === 'timing' && value > 3000) { // > 3 seconds
      console.warn(`Performance warning: ${name} took ${value}ms`);
    }
  }

  measureAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return asyncFn().then(
      (result) => {
        this.recordMetric(name, performance.now() - startTime, 'timing');
        return result;
      },
      (error) => {
        this.recordMetric(`${name}-error`, performance.now() - startTime, 'timing');
        throw error;
      }
    );
  }

  measureSync<T>(name: string, syncFn: () => T): T {
    const startTime = performance.now();
    try {
      const result = syncFn();
      this.recordMetric(name, performance.now() - startTime, 'timing');
      return result;
    } catch (error) {
      this.recordMetric(`${name}-error`, performance.now() - startTime, 'timing');
      throw error;
    }
  }

  recordMemoryUsage() {
    if (typeof window === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    this.recordMetric('memory-used', memory.usedJSHeapSize, 'memory');
    this.recordMetric('memory-total', memory.totalJSHeapSize, 'memory');
    this.recordMetric('memory-limit', memory.jsHeapSizeLimit, 'memory');
  }

  getMetrics(type?: PerformanceMetric['type']): PerformanceMetric[] {
    if (type) {
      return this.metrics.filter(m => m.type === type);
    }
    return [...this.metrics];
  }

  getAverageMetric(name: string): number {
    const matchingMetrics = this.metrics.filter(m => m.name === name);
    if (matchingMetrics.length === 0) return 0;
    
    const sum = matchingMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / matchingMetrics.length;
  }

  clearMetrics() {
    this.metrics = [];
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }

  // Get Core Web Vitals
  getCoreWebVitals() {
    return {
      lcp: this.getAverageMetric('largest-contentful-paint'),
      fid: this.getAverageMetric('first-input-delay'),
      cls: this.getAverageMetric('cumulative-layout-shift') // Would need additional setup
    };
  }

  // Generate performance report
  generateReport(): string {
    const timingMetrics = this.getMetrics('timing');
    const memoryMetrics = this.getMetrics('memory');
    
    let report = '=== Performance Report ===\n\n';
    
    if (timingMetrics.length > 0) {
      report += 'Timing Metrics:\n';
      timingMetrics.forEach(metric => {
        report += `  ${metric.name}: ${metric.value.toFixed(2)}ms\n`;
      });
      report += '\n';
    }
    
    if (memoryMetrics.length > 0) {
      report += 'Memory Metrics:\n';
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      report += `  Memory Used: ${(latestMemory.value / 1024 / 1024).toFixed(2)}MB\n`;
      report += '\n';
    }
    
    const coreVitals = this.getCoreWebVitals();
    report += 'Core Web Vitals:\n';
    report += `  LCP: ${coreVitals.lcp.toFixed(2)}ms\n`;
    report += `  FID: ${coreVitals.fid.toFixed(2)}ms\n`;
    
    return report;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions
export function measurePerformance<T>(name: string, fn: () => T): T {
  return performanceMonitor.measureSync(name, fn);
}

export function measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return performanceMonitor.measureAsync(name, fn);
}

export function recordCustomMetric(name: string, value: number) {
  performanceMonitor.recordMetric(name, value, 'custom');
}

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const recordMetric = (name: string, value: number, type: PerformanceMetric['type'] = 'custom') => {
    performanceMonitor.recordMetric(name, value, type);
  };

  const measureRender = (componentName: string) => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      recordMetric(`render-${componentName}`, endTime - startTime, 'timing');
    };
  };

  const getMetrics = () => performanceMonitor.getMetrics();
  const generateReport = () => performanceMonitor.generateReport();

  return {
    recordMetric,
    measureRender,
    getMetrics,
    generateReport
  };
}

// Bundle size analyzer (development only)
export function analyzeBundleSize() {
  if (process.env.NODE_ENV !== 'development') return;

  // Estimate bundle size based on loaded scripts
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  let totalSize = 0;

  scripts.forEach(script => {
    const src = (script as HTMLScriptElement).src;
    if (src.includes('/_next/')) {
      // Estimate size based on typical Next.js bundle patterns
      if (src.includes('chunks/pages')) {
        totalSize += 50000; // ~50KB estimate for page chunks
      } else if (src.includes('chunks/main')) {
        totalSize += 200000; // ~200KB estimate for main bundle
      } else if (src.includes('chunks/framework')) {
        totalSize += 150000; // ~150KB estimate for React
      }
    }
  });

  console.log(`Estimated bundle size: ${(totalSize / 1024).toFixed(2)}KB`);
  performanceMonitor.recordMetric('bundle-size-estimate', totalSize, 'custom');
}