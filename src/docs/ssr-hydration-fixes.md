# SSR Hydration Fixes

This document outlines the fixes applied to resolve server-side rendering (SSR) hydration errors in the global state management system.

## Problem

The application was experiencing hydration errors because components were accessing browser-only APIs (like `navigator.onLine`, `localStorage`, `window`) during server-side rendering, causing mismatches between server and client rendered HTML.

## Root Causes

1. **Direct Browser API Access**: Components were directly accessing `navigator.onLine` during initialization
2. **localStorage Access**: State persistence was trying to access `localStorage` on the server
3. **PWA Manager**: The PWA manager was accessing browser APIs during class instantiation
4. **Event Listeners**: Components were setting up event listeners before checking if they were in a browser environment

## Fixes Applied

### 1. AppContext (`src/contexts/AppContext.tsx`)

**Before:**
```tsx
// Direct access to navigator during useEffect
dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });
```

**After:**
```tsx
// Added client-side mounting check
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

// Only access browser APIs after mounting
useEffect(() => {
  if (!isMounted) return;
  
  if (typeof navigator !== 'undefined') {
    dispatch({ type: 'SET_OFFLINE', payload: !navigator.onLine });
  }
}, [isMounted]);
```

### 2. State Persistence (`src/lib/state-persistence.ts`)

**Before:**
```tsx
static loadPersistedState(): Partial<AppState> | null {
  const persistedData = localStorage.getItem(PERSISTED_STATE_KEY);
  // ...
}
```

**After:**
```tsx
static loadPersistedState(): Partial<AppState> | null {
  // Only run on client side
  if (typeof window === 'undefined') return null;
  
  const persistedData = localStorage.getItem(PERSISTED_STATE_KEY);
  // ...
}
```

### 3. useOffline Hook (`src/hooks/useOffline.ts`)

**Before:**
```tsx
const [state, setState] = useState<OfflineState>({
  isOnline: navigator.onLine, // ❌ SSR error
  isOffline: !navigator.onLine,
  // ...
});
```

**After:**
```tsx
const [state, setState] = useState<OfflineState>({
  isOnline: true, // ✅ Default to online for SSR
  isOffline: false,
  // ...
});
const [isMounted, setIsMounted] = useState(false);

// Initialize state after mounting
useEffect(() => {
  if (!isMounted) return;
  
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  setState({
    isOnline,
    isOffline: !isOnline,
    // ...
  });
}, [isMounted]);
```

### 4. PWA Manager (`src/lib/pwa.ts`)

**Before:**
```tsx
addToSyncQueue(type: 'transcription' | 'rewrite', data: any): string {
  // ...
  if (navigator.onLine) { // ❌ SSR error
    this.processSyncQueue();
  }
}
```

**After:**
```tsx
addToSyncQueue(type: 'transcription' | 'rewrite', data: any): string {
  // ...
  if (typeof navigator !== 'undefined' && navigator.onLine) { // ✅ SSR safe
    this.processSyncQueue();
  }
}
```

### 5. OfflineIndicator Component (`src/components/OfflineIndicator.tsx`)

**Before:**
```tsx
export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const { isOnline, syncQueueLength } = useOffline();
  
  if (isOnline && syncQueueLength === 0 && !showDetails) {
    return null; // ❌ Could cause hydration mismatch
  }
}
```

**After:**
```tsx
export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const { isOnline, syncQueueLength } = useOffline();
  
  // Don't render anything during SSR
  if (typeof window === 'undefined' || (isOnline && syncQueueLength === 0 && !showDetails)) {
    return null; // ✅ SSR safe
  }
}
```

## SSR Safety Patterns

### 1. Client-Side Mounting Check

```tsx
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

// Only run client-side code after mounting
useEffect(() => {
  if (!isMounted) return;
  // Browser API access here
}, [isMounted]);
```

### 2. Browser API Guards

```tsx
// Check for window object
if (typeof window === 'undefined') return;

// Check for navigator object
if (typeof navigator === 'undefined') return;

// Check for specific APIs
if ('serviceWorker' in navigator) {
  // Use service worker
}
```

### 3. Default Values for SSR

```tsx
// Instead of accessing browser APIs directly
const [isOnline, setIsOnline] = useState(navigator.onLine); // ❌

// Use safe defaults
const [isOnline, setIsOnline] = useState(true); // ✅
```

### 4. Conditional Rendering

```tsx
// Don't render components that depend on browser APIs during SSR
if (typeof window === 'undefined') {
  return null;
}

return <ComponentThatNeedsBrowserAPIs />;
```

## Testing SSR Safety

### 1. Build Test
```bash
npm run build
```
Should complete without hydration warnings.

### 2. Development Server
```bash
npm run dev
```
Check browser console for hydration errors.

### 3. Unit Tests
```bash
npm test
```
Ensure all tests pass with the SSR-safe implementations.

## Best Practices

1. **Always check for browser environment** before accessing browser APIs
2. **Use safe defaults** for initial state that works on both server and client
3. **Defer browser API access** until after component mounting
4. **Test thoroughly** in both development and production builds
5. **Use TypeScript** to catch potential undefined access at compile time

## Results

After applying these fixes:
- ✅ No more hydration errors
- ✅ Consistent server and client rendering
- ✅ All functionality works correctly after client-side hydration
- ✅ Build completes successfully
- ✅ All tests pass

The global state management system now works seamlessly with Next.js SSR while maintaining all its functionality on the client side.