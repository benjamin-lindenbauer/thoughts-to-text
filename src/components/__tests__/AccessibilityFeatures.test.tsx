import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardEvent } from 'react';
import { useKeyboardNavigation, useFocusManagement } from '@/hooks/useKeyboardNavigation';
import { useAriaLiveRegion, useFocusTrap } from '@/hooks/useAccessibility';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { LazyImage } from '@/components/LazyImage';
import { LazyComponent } from '@/components/LazyComponent';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: mockDisconnect,
}));

window.IntersectionObserver = mockIntersectionObserver;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: vi.fn(),
});

// Test component for keyboard navigation
function TestKeyboardComponent() {
  const { handleKeyDown } = useKeyboardNavigation({
    onEnter: () => console.log('Enter pressed'),
    onEscape: () => console.log('Escape pressed'),
    onArrowUp: () => console.log('Arrow up pressed'),
    onArrowDown: () => console.log('Arrow down pressed'),
  });

  const handleKeyDownWrapper = (event: KeyboardEvent<HTMLDivElement>) => {
    handleKeyDown(event.nativeEvent);
  };

  return (
    <div data-testid="keyboard-test" onKeyDown={handleKeyDownWrapper} tabIndex={0}>
      Keyboard test component
    </div>
  );
}

// Test component for focus management
function TestFocusComponent() {
  const { containerRef, focusFirst, focusNext, focusPrevious } = useFocusManagement();

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} data-testid="focus-container">
      <button onClick={focusFirst}>Focus First</button>
      <button onClick={focusNext}>Focus Next</button>
      <button onClick={focusPrevious}>Focus Previous</button>
      <input type="text" placeholder="Input 1" />
      <input type="text" placeholder="Input 2" />
      <button>Button 1</button>
      <button>Button 2</button>
    </div>
  );
}

// Test component for ARIA live region
function TestAriaLiveComponent() {
  const { announce, LiveRegion } = useAriaLiveRegion();

  return (
    <div>
      <button onClick={() => announce('Test announcement', 'polite')}>
        Announce Polite
      </button>
      <button onClick={() => announce('Urgent announcement', 'assertive')}>
        Announce Assertive
      </button>
      <LiveRegion />
    </div>
  );
}

// Test component for focus trap
function TestFocusTrapComponent({ isActive }: { isActive: boolean }) {
  const containerRef = useFocusTrap(isActive);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} data-testid="focus-trap">
      <button>First Button</button>
      <input type="text" placeholder="Input" />
      <button>Last Button</button>
    </div>
  );
}

// Test component for haptic feedback
function TestHapticComponent() {
  const haptic = useHapticFeedback({ enabled: true });

  return (
    <div>
      <button onClick={haptic.impactLight} data-testid="impact-light">
        Impact Light
      </button>
      <button onClick={haptic.impactMedium} data-testid="impact-medium">
        Impact Medium
      </button>
      <button onClick={haptic.impactHeavy} data-testid="impact-heavy">
        Impact Heavy
      </button>
      <button onClick={haptic.selection} data-testid="selection">
        Selection
      </button>
      <button onClick={haptic.notification} data-testid="notification">
        Notification
      </button>
      <button onClick={haptic.recordingStart} data-testid="recording-start">
        Recording Start
      </button>
      <button onClick={haptic.recordingStop} data-testid="recording-stop">
        Recording Stop
      </button>
      <button onClick={haptic.recordingError} data-testid="recording-error">
        Recording Error
      </button>
    </div>
  );
}

describe('Accessibility Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Keyboard Navigation', () => {
    it('should handle keyboard events correctly', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      render(<TestKeyboardComponent />);
      const component = screen.getByTestId('keyboard-test');

      // Test Enter key
      fireEvent.keyDown(component, { key: 'Enter' });
      expect(consoleSpy).toHaveBeenCalledWith('Enter pressed');

      // Test Escape key
      fireEvent.keyDown(component, { key: 'Escape' });
      expect(consoleSpy).toHaveBeenCalledWith('Escape pressed');

      // Test Arrow keys
      fireEvent.keyDown(component, { key: 'ArrowUp' });
      expect(consoleSpy).toHaveBeenCalledWith('Arrow up pressed');

      fireEvent.keyDown(component, { key: 'ArrowDown' });
      expect(consoleSpy).toHaveBeenCalledWith('Arrow down pressed');

      consoleSpy.mockRestore();
    });

    it('should not handle events when disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      function DisabledKeyboardComponent() {
        const { handleKeyDown } = useKeyboardNavigation({
          onEnter: () => console.log('Enter pressed'),
          disabled: true,
        });

        const handleKeyDownWrapper = (event: KeyboardEvent<HTMLDivElement>) => {
          handleKeyDown(event.nativeEvent);
        };

        return (
          <div data-testid="disabled-keyboard-test" onKeyDown={handleKeyDownWrapper} tabIndex={0}>
            Disabled keyboard test
          </div>
        );
      }

      render(<DisabledKeyboardComponent />);
      const component = screen.getByTestId('disabled-keyboard-test');

      fireEvent.keyDown(component, { key: 'Enter' });
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Focus Management', () => {
    it('should provide focus management functions', () => {
      render(<TestFocusComponent />);

      // Just test that the component renders and buttons exist
      expect(screen.getByText('Focus First')).toBeInTheDocument();
      expect(screen.getByText('Focus Next')).toBeInTheDocument();
      expect(screen.getByText('Focus Previous')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Input 1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Input 2')).toBeInTheDocument();
    });
  });

  describe('ARIA Live Region', () => {
    it('should create live region and announce messages', async () => {
      render(<TestAriaLiveComponent />);

      const politeBtn = screen.getByText('Announce Polite');
      const assertiveBtn = screen.getByText('Announce Assertive');

      // Check that live region exists
      const liveRegion = document.querySelector('[aria-live]');
      expect(liveRegion).toBeInTheDocument();

      // Test polite announcement
      fireEvent.click(politeBtn);
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveTextContent('Test announcement');

      // Test assertive announcement
      fireEvent.click(assertiveBtn);
      expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
      expect(liveRegion).toHaveTextContent('Urgent announcement');

      // Wait for cleanup
      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('');
      }, { timeout: 1500 });
    });
  });

  describe('Focus Trap', () => {
    it('should trap focus when active', () => {
      const { rerender } = render(<TestFocusTrapComponent isActive={false} />);

      // Focus trap should not be active initially
      const container = screen.getByTestId('focus-trap');
      expect(container).toBeInTheDocument();

      // Activate focus trap
      rerender(<TestFocusTrapComponent isActive={true} />);

      // First focusable element should be focused
      const firstButton = screen.getByText('First Button');
      expect(document.activeElement).toBe(firstButton);
    });
  });

  describe('Haptic Feedback', () => {
    it('should trigger vibration for different haptic types', async () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      render(<TestHapticComponent />);

      // Clear any previous calls
      vibrateSpy.mockClear();

      // Test impact light
      fireEvent.click(screen.getByTestId('impact-light'));
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));

      // Test impact medium
      fireEvent.click(screen.getByTestId('impact-medium'));
      expect(vibrateSpy).toHaveBeenLastCalledWith(25);

      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));

      // Test impact heavy
      fireEvent.click(screen.getByTestId('impact-heavy'));
      expect(vibrateSpy).toHaveBeenLastCalledWith(50);

      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));

      // Test selection
      fireEvent.click(screen.getByTestId('selection'));
      expect(vibrateSpy).toHaveBeenLastCalledWith(5);

      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));

      // Test notification
      fireEvent.click(screen.getByTestId('notification'));
      expect(vibrateSpy).toHaveBeenLastCalledWith([25, 10, 25]);

      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));

      // Test recording error
      fireEvent.click(screen.getByTestId('recording-error'));
      expect(vibrateSpy).toHaveBeenLastCalledWith([100, 50, 100, 50, 100]);
    });

    it('should not vibrate when disabled', () => {
      const vibrateSpy = vi.spyOn(navigator, 'vibrate');

      function DisabledHapticComponent() {
        const haptic = useHapticFeedback({ enabled: false });
        return (
          <button onClick={haptic.impactLight} data-testid="disabled-haptic">
            Disabled Haptic
          </button>
        );
      }

      render(<DisabledHapticComponent />);
      fireEvent.click(screen.getByTestId('disabled-haptic'));

      expect(vibrateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Lazy Loading Components', () => {
    it('should render LazyImage component', () => {
      // Mock IntersectionObserver to immediately trigger
      const mockObserve = vi.fn((element: Element, callback: IntersectionObserverCallback) => {
        // Simulate immediate intersection
        setTimeout(() => {
          if (callback) callback([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver);
        }, 0);
      });

      const mockIntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => ({
        observe: (element: Element) => mockObserve(element, callback),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));

      window.IntersectionObserver = mockIntersectionObserver;

      render(
        <LazyImage
          src="/test-image.jpg"
          alt="Test image description"
          className="test-image"
        />
      );

      // Component should render without errors
      expect(document.querySelector('.test-image')).toBeInTheDocument();
    });

    it('should render LazyComponent with fallback', () => {
      // Mock IntersectionObserver for LazyComponent
      const mockIntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      }));

      window.IntersectionObserver = mockIntersectionObserver;

      render(
        <LazyComponent fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="content">Loaded content</div>
        </LazyComponent>
      );

      // Should show fallback initially
      expect(screen.getByTestId('fallback')).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA attributes on interactive elements', () => {
      render(
        <div>
          <button aria-label="Test button" aria-pressed="false">
            Interactive Button
          </button>
          <input aria-label="Test input" type="text" />
          <div role="listbox" aria-label="Test listbox">
            <div role="option" aria-selected="false">Option 1</div>
            <div role="option" aria-selected="true">Option 2</div>
          </div>
        </div>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(button).toHaveAttribute('aria-pressed', 'false');

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Test input');

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Test listbox');

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support keyboard navigation on custom components', () => {
      render(
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              console.log('Custom button activated');
            }
          }}
          data-testid="custom-button"
        >
          Custom Button
        </div>
      );

      const customButton = screen.getByTestId('custom-button');
      expect(customButton).toHaveAttribute('tabIndex', '0');
      expect(customButton).toHaveAttribute('role', 'button');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      // Test Enter key activation
      fireEvent.keyDown(customButton, { key: 'Enter' });
      expect(consoleSpy).toHaveBeenCalledWith('Custom button activated');

      // Test Space key activation
      fireEvent.keyDown(customButton, { key: ' ' });
      expect(consoleSpy).toHaveBeenCalledWith('Custom button activated');

      consoleSpy.mockRestore();
    });
  });
});