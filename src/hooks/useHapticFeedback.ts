import { useCallback, useRef } from 'react';

interface HapticFeedbackOptions {
  enabled?: boolean;
  intensity?: 'light' | 'medium' | 'heavy';
}

export function useHapticFeedback(options: HapticFeedbackOptions = {}) {
  const { enabled = true, intensity = 'medium' } = options;
  const lastFeedbackTime = useRef(0);
  const minInterval = 50; // Minimum time between haptic feedback (ms)

  const triggerHaptic = useCallback((type: 'impact' | 'selection' | 'notification' = 'impact') => {
    if (!enabled) return;

    const now = Date.now();
    if (now - lastFeedbackTime.current < minInterval) return;
    
    lastFeedbackTime.current = now;

    // Check if device supports haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      let pattern: number | number[];

      switch (type) {
        case 'impact':
          switch (intensity) {
            case 'light':
              pattern = 10;
              break;
            case 'heavy':
              pattern = 50;
              break;
            default:
              pattern = 25;
          }
          break;
        case 'selection':
          pattern = 5;
          break;
        case 'notification':
          pattern = [25, 10, 25];
          break;
        default:
          pattern = 25;
      }

      navigator.vibrate(pattern);
    }

    // iOS Haptic Feedback API (if available)
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      try {
        // Check for iOS Haptic Feedback
        const hapticFeedback = (window as any).TapticEngine || (window as any).AudioServicesPlaySystemSound;
        
        if (hapticFeedback) {
          switch (type) {
            case 'impact':
              switch (intensity) {
                case 'light':
                  hapticFeedback(1519); // Light impact
                  break;
                case 'heavy':
                  hapticFeedback(1521); // Heavy impact
                  break;
                default:
                  hapticFeedback(1520); // Medium impact
              }
              break;
            case 'selection':
              hapticFeedback(1519); // Selection feedback
              break;
            case 'notification':
              hapticFeedback(1016); // Notification feedback
              break;
          }
        }
      } catch (error) {
        // Silently fail if haptic feedback is not available
      }
    }
  }, [enabled, intensity]);

  const impactLight = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastFeedbackTime.current < minInterval) return;
    lastFeedbackTime.current = now;
    
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [enabled]);
  
  const impactMedium = useCallback(() => triggerHaptic('impact'), [triggerHaptic]);
  
  const impactHeavy = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastFeedbackTime.current < minInterval) return;
    lastFeedbackTime.current = now;
    
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [enabled]);
  const selection = useCallback(() => triggerHaptic('selection'), [triggerHaptic]);
  const notification = useCallback(() => triggerHaptic('notification'), [triggerHaptic]);

  // Recording-specific haptic patterns
  const recordingStart = useCallback(() => {
    triggerHaptic('impact');
    // Double tap pattern for recording start
    setTimeout(() => triggerHaptic('impact'), 100);
  }, [triggerHaptic]);

  const recordingStop = useCallback(() => {
    triggerHaptic('notification');
  }, [triggerHaptic]);

  const recordingError = useCallback(() => {
    // Error pattern: three short vibrations
    if (enabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  }, [enabled]);

  const buttonPress = useCallback(() => {
    triggerHaptic('selection');
  }, [triggerHaptic]);

  return {
    triggerHaptic,
    impactLight,
    impactMedium,
    impactHeavy,
    selection,
    notification,
    recordingStart,
    recordingStop,
    recordingError,
    buttonPress
  };
}