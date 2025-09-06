import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onSpace?: () => void;
  onTab?: (shiftKey: boolean) => void;
  disabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onEnter,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onSpace,
    onTab,
    disabled = false
  } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        break;
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
      case 'ArrowUp':
        if (onArrowUp) {
          event.preventDefault();
          onArrowUp();
        }
        break;
      case 'ArrowDown':
        if (onArrowDown) {
          event.preventDefault();
          onArrowDown();
        }
        break;
      case 'ArrowLeft':
        if (onArrowLeft) {
          event.preventDefault();
          onArrowLeft();
        }
        break;
      case 'ArrowRight':
        if (onArrowRight) {
          event.preventDefault();
          onArrowRight();
        }
        break;
      case ' ':
        if (onSpace) {
          event.preventDefault();
          onSpace();
        }
        break;
      case 'Tab':
        if (onTab) {
          onTab(event.shiftKey);
        }
        break;
    }
  }, [onEnter, onEscape, onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onSpace, onTab, disabled]);

  useEffect(() => {
    if (disabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, disabled]);

  return { handleKeyDown };
}

// Hook for managing focus within a container
export function useFocusManagement() {
  const containerRef = useRef<HTMLElement>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
    }
  }, [getFocusableElements]);

  const focusNext = useCallback(() => {
    const elements = getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (currentIndex + 1) % elements.length;
    if (elements[nextIndex]) {
      elements[nextIndex].focus();
    }
  }, [getFocusableElements]);

  const focusPrevious = useCallback(() => {
    const elements = getFocusableElements();
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
    const previousIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
    if (elements[previousIndex]) {
      elements[previousIndex].focus();
    }
  }, [getFocusableElements]);

  return {
    containerRef,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    getFocusableElements
  };
}