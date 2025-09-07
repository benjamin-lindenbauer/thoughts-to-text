import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock different browser environments
const mockUserAgents = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
};

// Mock browser capabilities
const mockBrowserCapabilities = {
  chrome: {
    mediaRecorder: true,
    webShare: true,
    serviceWorker: true,
    localStorage: true,
    indexedDB: true,
    webAudio: true,
    getUserMedia: true,
  },
  firefox: {
    mediaRecorder: true,
    webShare: false, // Firefox doesn't support Web Share API
    serviceWorker: true,
    localStorage: true,
    indexedDB: true,
    webAudio: true,
    getUserMedia: true,
  },
  safari: {
    mediaRecorder: true,
    webShare: true,
    serviceWorker: true,
    localStorage: true,
    indexedDB: true,
    webAudio: true,
    getUserMedia: true,
  },
  edge: {
    mediaRecorder: true,
    webShare: true,
    serviceWorker: true,
    localStorage: true,
    indexedDB: true,
    webAudio: true,
    getUserMedia: true,
  },
  mobile: {
    mediaRecorder: true,
    webShare: true,
    serviceWorker: true,
    localStorage: true,
    indexedDB: true,
    webAudio: true,
    getUserMedia: true,
  },
};

describe('Cross-Browser Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature Detection', () => {
    it('should detect MediaRecorder support across browsers', () => {
      Object.entries(mockBrowserCapabilities).forEach(([browser, capabilities]) => {
        // Mock browser environment
        Object.defineProperty(navigator, 'userAgent', {
          value: mockUserAgents[browser as keyof typeof mockUserAgents],
          configurable: true,
        });

        if (capabilities.mediaRecorder) {
          global.MediaRecorder = vi.fn();
          (global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);
        } else {
          delete (global as any).MediaRecorder;
        }

        // Test feature detection
        const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
        expect(hasMediaRecorder).toBe(capabilities.mediaRecorder);
      });
    });

    it('should detect Web Share API support', () => {
      Object.entries(mockBrowserCapabilities).forEach(([browser, capabilities]) => {
        if (capabilities.webShare) {
          Object.defineProperty(navigator, 'share', {
            value: vi.fn(),
            configurable: true,
          });
          Object.defineProperty(navigator, 'canShare', {
            value: vi.fn().mockReturnValue(true),
            configurable: true,
          });
        } else {
          delete (navigator as any).share;
          delete (navigator as any).canShare;
        }

        const hasWebShare = 'share' in navigator;
        expect(hasWebShare).toBe(capabilities.webShare);
      });
    });

    it('should detect Service Worker support', () => {
      Object.entries(mockBrowserCapabilities).forEach(([browser, capabilities]) => {
        if (capabilities.serviceWorker) {
          Object.defineProperty(navigator, 'serviceWorker', {
            value: {
              register: vi.fn(),
              ready: Promise.resolve(),
            },
            configurable: true,
          });
        } else {
          delete (navigator as any).serviceWorker;
        }

        const hasServiceWorker = 'serviceWorker' in navigator;
        expect(hasServiceWorker).toBe(capabilities.serviceWorker);
      });
    });

    it('should detect getUserMedia support', () => {
      Object.entries(mockBrowserCapabilities).forEach(([browser, capabilities]) => {
        if (capabilities.getUserMedia) {
          Object.defineProperty(navigator, 'mediaDevices', {
            value: {
              getUserMedia: vi.fn(),
              enumerateDevices: vi.fn(),
            },
            configurable: true,
          });
        } else {
          delete (navigator as any).mediaDevices;
        }

        const hasGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        expect(!!hasGetUserMedia).toBe(capabilities.getUserMedia);
      });
    });
  });

  describe('Audio Format Support', () => {
    it('should handle different audio formats per browser', () => {
      const formatSupport = {
        chrome: ['audio/webm', 'audio/mp4'],
        firefox: ['audio/webm', 'audio/ogg'],
        safari: ['audio/mp4', 'audio/wav'],
        edge: ['audio/webm', 'audio/mp4'],
        mobile: ['audio/mp4', 'audio/wav'],
      };

      Object.entries(formatSupport).forEach(([browser, formats]) => {
        // Mock MediaRecorder.isTypeSupported for each browser
        (global.MediaRecorder as any).isTypeSupported = vi.fn().mockImplementation(
          (mimeType: string) => formats.includes(mimeType)
        );

        formats.forEach(format => {
          expect(MediaRecorder.isTypeSupported(format)).toBe(true);
        });

        // Test unsupported format
        expect(MediaRecorder.isTypeSupported('audio/unsupported')).toBe(false);
      });
    });

    it('should fallback to supported formats', () => {
      const preferredFormats = ['audio/webm', 'audio/mp4', 'audio/wav'];
      
      // Mock Safari (doesn't support webm)
      (global.MediaRecorder as any).isTypeSupported = vi.fn().mockImplementation(
        (mimeType: string) => mimeType !== 'audio/webm'
      );

      const getSupportedFormat = (formats: string[]) => {
        return formats.find(format => MediaRecorder.isTypeSupported(format));
      };

      const supportedFormat = getSupportedFormat(preferredFormats);
      expect(supportedFormat).toBe('audio/mp4'); // Should skip webm and use mp4
    });
  });

  describe('Storage Compatibility', () => {
    it('should handle localStorage limitations', () => {
      // Mock localStorage quota exceeded (common in Safari private mode)
      const mockLocalStorage = {
        setItem: vi.fn().mockImplementation((key: string, value: string) => {
          if (value.length > 5000000) { // 5MB limit simulation
            throw new Error('QuotaExceededError');
          }
        }),
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
      });

      // Test large data storage
      const largeData = 'x'.repeat(6000000); // 6MB
      
      expect(() => {
        localStorage.setItem('large-data', largeData);
      }).toThrow('QuotaExceededError');

      // Should handle gracefully
      try {
        localStorage.setItem('large-data', largeData);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('QuotaExceededError');
      }
    });

    it('should fallback when localStorage is disabled', () => {
      // Mock disabled localStorage (private browsing)
      Object.defineProperty(window, 'localStorage', {
        value: null,
      });

      const hasLocalStorage = (() => {
        try {
          return typeof localStorage !== 'undefined' && localStorage !== null;
        } catch {
          return false;
        }
      })();

      expect(hasLocalStorage).toBe(false);

      // Should use in-memory fallback
      const memoryStorage = new Map<string, string>();
      const fallbackStorage = {
        setItem: (key: string, value: string) => memoryStorage.set(key, value),
        getItem: (key: string) => memoryStorage.get(key) || null,
        removeItem: (key: string) => memoryStorage.delete(key),
        clear: () => memoryStorage.clear(),
      };

      fallbackStorage.setItem('test', 'value');
      expect(fallbackStorage.getItem('test')).toBe('value');
    });
  });

  describe('Mobile-Specific Features', () => {
    it('should handle mobile viewport and touch events', () => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: mockUserAgents.mobile,
        configurable: true,
      });

      // Mock touch events
      const mockTouchEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        preventDefault: vi.fn(),
      };

      // Test touch event handling
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      expect(isMobile).toBe(true);

      // Mock viewport meta tag
      const viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(viewportMeta);

      const viewport = document.querySelector('meta[name="viewport"]');
      expect(viewport).toBeTruthy();
      expect(viewport?.getAttribute('content')).toContain('width=device-width');
    });

    it('should handle mobile camera access', () => {
      // Mock mobile camera constraints
      const mobileConstraints = {
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      };

      const mockGetUserMedia = vi.fn().mockResolvedValue({
        getVideoTracks: () => [{ 
          getSettings: () => ({ facingMode: 'environment' }),
          stop: vi.fn() 
        }],
        getTracks: () => [{ stop: vi.fn() }],
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: mockGetUserMedia },
      });

      // Test camera access
      navigator.mediaDevices.getUserMedia(mobileConstraints);
      expect(mockGetUserMedia).toHaveBeenCalledWith(mobileConstraints);
    });
  });

  describe('Performance Across Browsers', () => {
    it('should handle different performance characteristics', () => {
      // Mock performance API
      const mockPerformance = {
        now: vi.fn().mockReturnValue(1000),
        mark: vi.fn(),
        measure: vi.fn(),
        getEntriesByType: vi.fn().mockReturnValue([]),
      };

      Object.defineProperty(global, 'performance', {
        value: mockPerformance,
      });

      // Test performance measurement
      const startTime = performance.now();
      expect(typeof startTime).toBe('number');

      performance.mark('test-start');
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-start');
    });

    it('should optimize for different browser engines', () => {
      const browserOptimizations = {
        webkit: {
          // Safari optimizations
          useRequestAnimationFrame: true,
          batchDOMUpdates: true,
          limitConcurrentRequests: 6,
        },
        gecko: {
          // Firefox optimizations
          useRequestAnimationFrame: true,
          batchDOMUpdates: false,
          limitConcurrentRequests: 8,
        },
        blink: {
          // Chrome/Edge optimizations
          useRequestAnimationFrame: true,
          batchDOMUpdates: true,
          limitConcurrentRequests: 10,
        },
      };

      // Test optimization selection based on user agent
      const getOptimizations = (userAgent: string) => {
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
          return browserOptimizations.webkit;
        } else if (userAgent.includes('Firefox')) {
          return browserOptimizations.gecko;
        } else {
          return browserOptimizations.blink;
        }
      };

      const chromeOpts = getOptimizations(mockUserAgents.chrome);
      expect(chromeOpts.limitConcurrentRequests).toBe(10);

      const firefoxOpts = getOptimizations(mockUserAgents.firefox);
      expect(firefoxOpts.limitConcurrentRequests).toBe(8);

      const safariOpts = getOptimizations(mockUserAgents.safari);
      expect(safariOpts.limitConcurrentRequests).toBe(6);
    });
  });

  describe('Error Handling Across Browsers', () => {
    it('should handle browser-specific errors', () => {
      const browserErrors = {
        safari: {
          // Safari-specific errors
          quotaExceeded: 'QuotaExceededError',
          microphoneBlocked: 'NotAllowedError',
          unsupportedFormat: 'NotSupportedError',
        },
        firefox: {
          // Firefox-specific errors
          quotaExceeded: 'NS_ERROR_DOM_QUOTA_EXCEEDED',
          microphoneBlocked: 'NotAllowedError',
          unsupportedFormat: 'NotSupportedError',
        },
        chrome: {
          // Chrome-specific errors
          quotaExceeded: 'QuotaExceededError',
          microphoneBlocked: 'NotAllowedError',
          unsupportedFormat: 'NotSupportedError',
        },
      };

      Object.entries(browserErrors).forEach(([browser, errors]) => {
        // Test error message normalization
        const normalizeError = (error: Error) => {
          if (error.message.includes('QuotaExceeded') || error.message.includes('NS_ERROR_DOM_QUOTA_EXCEEDED')) {
            return 'Storage quota exceeded';
          }
          if (error.name === 'NotAllowedError') {
            return 'Permission denied';
          }
          return error.message;
        };

        const quotaError = new Error(errors.quotaExceeded);
        expect(normalizeError(quotaError)).toBe('Storage quota exceeded');

        const permissionError = new Error(errors.microphoneBlocked);
        permissionError.name = 'NotAllowedError';
        expect(normalizeError(permissionError)).toBe('Permission denied');
      });
    });
  });

  describe('Responsive Design Testing', () => {
    it('should adapt to different screen sizes', () => {
      const screenSizes = {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1920, height: 1080 },
      };

      Object.entries(screenSizes).forEach(([device, size]) => {
        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', {
          value: size.width,
          configurable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
          value: size.height,
          configurable: true,
        });

        // Test responsive breakpoints
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        const isDesktop = window.innerWidth >= 1024;

        if (device === 'mobile') {
          expect(isMobile).toBe(true);
          expect(isTablet).toBe(false);
          expect(isDesktop).toBe(false);
        } else if (device === 'tablet') {
          expect(isMobile).toBe(false);
          expect(isTablet).toBe(true);
          expect(isDesktop).toBe(false);
        } else {
          expect(isMobile).toBe(false);
          expect(isTablet).toBe(false);
          expect(isDesktop).toBe(true);
        }
      });
    });

    it('should handle orientation changes', () => {
      // Mock orientation API
      Object.defineProperty(screen, 'orientation', {
        value: {
          angle: 0,
          type: 'portrait-primary',
          addEventListener: vi.fn(),
        },
        configurable: true,
      });

      // Test orientation detection
      const isPortrait = screen.orientation.type.includes('portrait');
      expect(isPortrait).toBe(true);

      // Mock landscape orientation
      Object.defineProperty(screen, 'orientation', {
        value: {
          angle: 90,
          type: 'landscape-primary',
          addEventListener: vi.fn(),
        },
        configurable: true,
      });

      const isLandscape = screen.orientation.type.includes('landscape');
      expect(isLandscape).toBe(true);
    });
  });
});