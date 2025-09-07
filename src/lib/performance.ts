/**
 * Performance monitoring and optimization utilities
 */

export interface PerformanceMetrics {
  duration: number;
  memoryUsage?: MemoryInfo;
  timestamp: number;
  type?: string;
}

export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  percentage: number;
}

/**
 * Measure execution time of a synchronous function
 */
export function measurePerformance<T>(
  operationName: string,
  operation: () => T
): T {
  const startTime = performance.now();
  performance.mark(`${operationName}-start`);
  
  try {
    const result = operation();
    
    const endTime = performance.now();
    performance.mark(`${operationName}-end`);
    performance.measure(operationName, `${operationName}-start`, `${operationName}-end`);
    
    console.debug(`Performance: ${operationName} took ${endTime - startTime}ms`);
    
    return result;
  } catch (error) {
    performance.mark(`${operationName}-error`);
    throw error;
  }
}

/**
 * Measure execution time of an asynchronous function
 */
export async function measurePerformanceAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  performance.mark(`${operationName}-start`);
  
  try {
    const result = await operation();
    
    const endTime = performance.now();
    performance.mark(`${operationName}-end`);
    performance.measure(operationName, `${operationName}-start`, `${operationName}-end`);
    
    console.debug(`Performance: ${operationName} took ${endTime - startTime}ms`);
    
    return result;
  } catch (error) {
    performance.mark(`${operationName}-error`);
    throw error;
  }
}

/**
 * Get current memory usage information
 */
export function getMemoryUsage(): MemoryInfo {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  
  // Fallback for browsers without memory API
  return {
    used: 0,
    total: 0,
    limit: 0,
    percentage: 0
  };
}

/**
 * Performance monitoring class
 */
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics[]>();
  private maxMetricsPerOperation = 100;

  recordMetric(operationName: string, duration: number, type?: string): void {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const operationMetrics = this.metrics.get(operationName)!;
    
    const metric: PerformanceMetrics = {
      duration,
      memoryUsage: getMemoryUsage(),
      timestamp: Date.now(),
      type
    };
    
    operationMetrics.push(metric);
    
    // Keep only the most recent metrics
    if (operationMetrics.length > this.maxMetricsPerOperation) {
      operationMetrics.shift();
    }
  }

  getMetrics(operationName: string): PerformanceMetrics[] {
    return this.metrics.get(operationName) || [];
  }

  getAverageTime(operationName: string): number {
    const metrics = this.getMetrics(operationName);
    if (metrics.length === 0) return 0;
    
    const totalTime = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / metrics.length;
  }

  getSlowOperations(threshold: number = 1000): Array<{ name: string; averageTime: number }> {
    const slowOps: Array<{ name: string; averageTime: number }> = [];
    
    for (const [name] of this.metrics) {
      const avgTime = this.getAverageTime(name);
      if (avgTime > threshold) {
        slowOps.push({ name, averageTime: avgTime });
      }
    }
    
    return slowOps.sort((a, b) => b.averageTime - a.averageTime);
  }

  clear(): void {
    this.metrics.clear();
  }

  cleanup(): void {
    this.clear();
  }

  recordMemoryUsage(): void {
    const memoryInfo = getMemoryUsage();
    this.recordMetric('memory-used-mb', memoryInfo.used / 1024 / 1024, 'memory');
    this.recordMetric('memory-total-mb', memoryInfo.total / 1024 / 1024, 'memory');
    this.recordMetric('memory-percentage', memoryInfo.percentage, 'memory');
  }

  getAllMetrics(): Array<{ name: string; value: number; type?: string; timestamp: number }> {
    const allMetrics: Array<{ name: string; value: number; type?: string; timestamp: number }> = [];
    
    for (const [name, metrics] of this.metrics) {
      const latestMetric = metrics[metrics.length - 1];
      if (latestMetric) {
        allMetrics.push({
          name,
          value: latestMetric.duration,
          type: latestMetric.type,
          timestamp: latestMetric.timestamp
        });
      }
    }
    
    return allMetrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  clearMetrics(): void {
    this.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring method performance
 */
export function measureMethod(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const className = target.constructor.name;
    const operationName = `${className}.${propertyName}`;
    
    return measurePerformance(operationName, () => method.apply(this, args));
  };
  
  return descriptor;
}

/**
 * Async decorator for measuring method performance
 */
export function measureAsyncMethod(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const className = target.constructor.name;
    const operationName = `${className}.${propertyName}`;
    
    return await measurePerformanceAsync(operationName, () => method.apply(this, args));
  };
  
  return descriptor;
}

/**
 * Resource monitoring utilities
 */
export class ResourceMonitor {
  private observers: PerformanceObserver[] = [];

  startMonitoring(): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn(`Long task detected: ${entry.duration}ms`, entry);
          }
        }
      });
      
      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        // longtask not supported in all browsers
      }

      // Monitor layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).value > 0.1) { // Significant layout shift
            console.warn(`Layout shift detected: ${(entry as any).value}`, entry);
          }
        }
      });
      
      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (e) {
        // layout-shift not supported in all browsers
      }
    }
  }

  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

/**
 * Frame rate monitoring
 */
export class FrameRateMonitor {
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;
  private isRunning = false;
  private animationId: number | null = null;

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  private tick = (): void => {
    if (!this.isRunning) return;
    
    this.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - this.lastTime >= 1000) { // Update every second
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
    
    this.animationId = requestAnimationFrame(this.tick);
  };
}

/**
 * Bundle size and loading performance utilities
 */
export function measureBundleSize(): Promise<number> {
  return new Promise((resolve) => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      // Estimate based on connection info
      resolve(connection.downlink * 1024 * 1024); // Convert Mbps to bytes
    } else {
      // Fallback estimation
      resolve(2 * 1024 * 1024); // 2MB default
    }
  });
}

/**
 * Critical rendering path optimization
 */
export function optimizeCriticalRenderingPath(): void {
  // Preload critical resources
  const criticalResources = [
    '/fonts/inter.woff2',
    '/icons/sprite.svg'
  ];
  
  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    link.as = resource.endsWith('.woff2') ? 'font' : 'image';
    if (link.as === 'font') {
      link.crossOrigin = 'anonymous';
    }
    document.head.appendChild(link);
  });
}

/**
 * Lazy loading utilities
 */
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  };
  
  return new IntersectionObserver(callback, defaultOptions);
}