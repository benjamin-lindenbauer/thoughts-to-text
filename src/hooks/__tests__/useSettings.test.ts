import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSettings } from '../useSettings';
import * as storageModule from '@/lib/storage';

// Mock the storage module
vi.mock('@/lib/storage', () => ({
  storeSettings: vi.fn(),
  retrieveSettings: vi.fn(),
  storeApiKey: vi.fn(),
  retrieveApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}));

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock default behavior
    vi.mocked(storageModule.retrieveSettings).mockResolvedValue(null);
    vi.mocked(storageModule.retrieveApiKey).mockResolvedValue(null);
    vi.mocked(storageModule.storeSettings).mockResolvedValue();
  });

  it('initializes with default settings when no saved settings exist', async () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.defaultLanguage).toBe('en');
    expect(result.current.settings.theme).toBe('auto');
    expect(result.current.settings.rewritePrompts).toHaveLength(4); // Default prompts
    expect(result.current.settings.defaultRewritePrompt).toBe('default');
  });

  it('loads saved settings on initialization', async () => {
    const savedSettings = {
      openaiApiKey: 'sk-test-key', // API key should be in settings object
      defaultLanguage: 'es',
      theme: 'dark' as const,
      rewritePrompts: [
        {
          id: 'default',
          name: 'Default',
          prompt: 'Test prompt',
          isDefault: true,
        },
      ],
      defaultRewritePrompt: 'default',
    };

    vi.mocked(storageModule.retrieveSettings).mockResolvedValue(savedSettings);
    vi.mocked(storageModule.retrieveApiKey).mockResolvedValue('sk-test-key');

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.defaultLanguage).toBe('es');
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.openaiApiKey).toBe('sk-test-key');
  });

  it('validates API keys correctly', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Valid API key
    expect(result.current.validateApiKey('sk-1234567890abcdef1234567890abcdef')).toBe(true);
    
    // Invalid API keys
    expect(result.current.validateApiKey('invalid-key')).toBe(false);
    expect(result.current.validateApiKey('sk-short')).toBe(false);
    expect(result.current.validateApiKey('')).toBe(false);
  });

  it('updates API key', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateApiKey('sk-new-api-key');
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        openaiApiKey: 'sk-new-api-key',
      })
    );
  });

  it('updates default language', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateDefaultLanguage('fr');
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLanguage: 'fr',
      })
    );
  });

  it('adds custom rewrite prompt', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newPrompt = {
      name: 'Custom Prompt',
      prompt: 'Custom prompt text',
      isDefault: false,
    };

    let promptId: string;
    await act(async () => {
      promptId = await result.current.addRewritePrompt(newPrompt);
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        rewritePrompts: expect.arrayContaining([
          expect.objectContaining({
            name: 'Custom Prompt',
            prompt: 'Custom prompt text',
            isDefault: false,
          }),
        ]),
      })
    );
  });

  it('updates rewrite prompt', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.updateRewritePrompt('default', {
        name: 'Updated Default',
      });
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        rewritePrompts: expect.arrayContaining([
          expect.objectContaining({
            id: 'default',
            name: 'Updated Default',
          }),
        ]),
      })
    );
  });

  it('deletes custom rewrite prompt', async () => {
    // First add a custom prompt
    const savedSettings = {
      openaiApiKey: '',
      defaultLanguage: 'en',
      theme: 'auto' as const,
      rewritePrompts: [
        {
          id: 'default',
          name: 'Default',
          prompt: 'Default prompt',
          isDefault: true,
        },
        {
          id: 'custom',
          name: 'Custom',
          prompt: 'Custom prompt',
          isDefault: false,
        },
      ],
      defaultRewritePrompt: 'default',
    };

    vi.mocked(storageModule.retrieveSettings).mockResolvedValue(savedSettings);

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteRewritePrompt('custom');
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        rewritePrompts: expect.not.arrayContaining([
          expect.objectContaining({ id: 'custom' }),
        ]),
      })
    );
  });

  it('prevents deletion of default prompts', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.deleteRewritePrompt('default');
      })
    ).rejects.toThrow('Cannot delete default rewrite prompts');
  });

  it('sets default rewrite prompt', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setDefaultRewritePrompt('concise');
    });

    expect(storageModule.storeSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRewritePrompt: 'concise',
        rewritePrompts: expect.arrayContaining([
          expect.objectContaining({
            id: 'concise',
            isDefault: true,
          }),
        ]),
      })
    );
  });

  it('handles errors when loading settings', async () => {
    vi.mocked(storageModule.retrieveSettings).mockRejectedValue(
      new Error('Storage error')
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Storage error');
    expect(result.current.settings).toEqual(expect.objectContaining({
      defaultLanguage: 'en', // Should fall back to defaults
    }));
  });

  it('handles errors when saving settings', async () => {
    vi.mocked(storageModule.storeSettings).mockRejectedValue(
      new Error('Save error')
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.updateApiKey('sk-test-key');
      })
    ).rejects.toThrow('Save error');
  });

  it('gets language display name correctly', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getLanguageDisplayName('en')).toBe('English (English)');
    expect(result.current.getLanguageDisplayName('es')).toBe('Español (Spanish)');
    expect(result.current.getLanguageDisplayName('unknown')).toBe('unknown');
  });
});