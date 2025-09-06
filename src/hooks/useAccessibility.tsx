import React, { useEffect, useRef, useCallback } from 'react';

// Hook for managing ARIA live regions
export function useAriaLiveRegion() {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) return;

    liveRegionRef.current.setAttribute('aria-live', priority);
    liveRegionRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  const LiveRegion = useCallback(() => {
    return (
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    );
  }, []);

  return { announce, LiveRegion };
}

// Hook for managing focus trapping in modals/dialogs
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element when trap becomes active
    firstElement?.focus();

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isActive]);

  return containerRef;
}

// Hook for managing reduced motion preferences
export function useReducedMotion() {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion.current;
}

// Hook for managing screen reader announcements
export function useScreenReader() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
}

// Hook for managing high contrast mode detection
export function useHighContrast() {
  const isHighContrast = useRef(false);

  useEffect(() => {
    const checkHighContrast = () => {
      // Check for Windows high contrast mode
      const testElement = document.createElement('div');
      testElement.style.border = '1px solid';
      testElement.style.borderColor = 'red green';
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      const borderTopColor = computedStyle.borderTopColor;
      const borderRightColor = computedStyle.borderRightColor;

      isHighContrast.current = borderTopColor === borderRightColor;
      document.body.removeChild(testElement);
    };

    checkHighContrast();

    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    const handleChange = () => {
      checkHighContrast();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isHighContrast.current;
}