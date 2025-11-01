import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_ROUTE_ORDER } from '@/lib/nav-order';

interface Options {
  // Minimum horizontal distance (px) to treat as a swipe
  threshold?: number;
  // Ratio to ensure horizontal intent (|dx| >= |dy| * ratio)
  horizontalIntentRatio?: number;
  // Max time (ms) between touchstart and touchend to count as a swipe
  maxDurationMs?: number;
  // Whether swipe navigation is enabled
  enabled?: boolean;
}

export function useSwipeNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  options: Options = {}
) {
  const {
    threshold = 60,
    horizontalIntentRatio = 1.5,
    maxDurationMs = 800,
    enabled = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;
    let isHorizontalCandidate = false;

    const getActiveIndex = () => {
      const p = pathname || '/';
      // Map dynamic paths to their root tab, e.g. /notes/123 -> /notes
      const active = NAV_ROUTE_ORDER.find((route) => p === route || p.startsWith(route + '/')) ?? '/';
      return NAV_ROUTE_ORDER.indexOf(active as any);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // ignore multi-touch
      const target = e.target as HTMLElement | null;
      // Avoid swiping when interacting with inputs or textareas
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      isTracking = true;
      isHorizontalCandidate = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTracking || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Decide if this gesture is horizontally intended
      if (!isHorizontalCandidate) {
        if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy) * horizontalIntentRatio) {
          isHorizontalCandidate = true;
        } else if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          // Clearly vertical scroll; stop tracking to avoid interfering with scroll
          isTracking = false;
          return;
        }
      }

      if (isHorizontalCandidate) {
        // Prevent vertical scroll jitter while swiping horizontally
        // Note: requires { passive: false } when adding listener
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTracking) return;
      isTracking = false;
      const duration = Date.now() - startTime;
      if (duration > maxDurationMs) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!isHorizontalCandidate) return;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return;

      const currentIndex = getActiveIndex();
      if (currentIndex < 0) return;

      // Left swipe -> next tab; Right swipe -> previous tab
      let nextIndex = currentIndex;
      if (dx < 0) {
        nextIndex = Math.min(NAV_ROUTE_ORDER.length - 1, currentIndex + 1);
      } else if (dx > 0) {
        nextIndex = Math.max(0, currentIndex - 1);
      }

      if (nextIndex !== currentIndex) {
        router.push(NAV_ROUTE_ORDER[nextIndex]);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart as any);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd as any);
    };
  }, [
    containerRef,
    pathname,
    router,
    threshold,
    horizontalIntentRatio,
    maxDurationMs,
    enabled,
  ]);
}
