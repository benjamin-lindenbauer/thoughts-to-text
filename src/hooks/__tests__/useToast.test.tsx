import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';
import { vi } from 'vitest';

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-123'),
  },
});

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });

  it('should add a success toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('Success message', 'Success description');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 'mock-uuid-123',
      type: 'success',
      title: 'Success message',
      description: 'Success description',
      duration: undefined,
    });
  });

  it('should add an error toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.error('Error message', 'Error description', 5000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 'mock-uuid-123',
      type: 'error',
      title: 'Error message',
      description: 'Error description',
      duration: 5000,
    });
  });

  it('should add an info toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.info('Info message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 'mock-uuid-123',
      type: 'info',
      title: 'Info message',
      description: undefined,
      duration: undefined,
    });
  });

  it('should remove a toast by id', () => {
    const mockUUIDs = ['uuid-1', 'uuid-2'];
    let callCount = 0;
    
    vi.mocked(crypto.randomUUID).mockImplementation(() => mockUUIDs[callCount++]);

    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('Toast 1');
      result.current.error('Toast 2');
    });

    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.removeToast('uuid-1');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Toast 2');
  });

  it('should clear all toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('Toast 1');
      result.current.error('Toast 2');
      result.current.info('Toast 3');
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should add multiple toasts with different ids', () => {
    const mockUUIDs = ['uuid-1', 'uuid-2', 'uuid-3'];
    let callCount = 0;
    
    vi.mocked(crypto.randomUUID).mockImplementation(() => mockUUIDs[callCount++]);

    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.success('Toast 1');
      result.current.error('Toast 2');
      result.current.info('Toast 3');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].id).toBe('uuid-1');
    expect(result.current.toasts[1].id).toBe('uuid-2');
    expect(result.current.toasts[2].id).toBe('uuid-3');
  });
});