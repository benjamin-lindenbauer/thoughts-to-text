'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings, RewritePrompt } from '@/types';
import { storeSettings, retrieveSettings } from '@/lib/storage';
import { DEFAULT_REWRITE_PROMPTS, LANGUAGE_OPTIONS } from '@/lib/utils';

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: '',
  defaultLanguage: 'en',
  theme: 'auto',
  rewritePrompts: DEFAULT_REWRITE_PROMPTS,
  defaultRewritePrompt: 'default',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const savedSettings = await retrieveSettings();
        if (savedSettings) {
          // Merge with defaults to ensure all properties exist
          const mergedSettings: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...savedSettings,
            // Ensure rewrite prompts include defaults
            rewritePrompts: [
              ...DEFAULT_REWRITE_PROMPTS,
              ...savedSettings.rewritePrompts.filter(
                prompt => !DEFAULT_REWRITE_PROMPTS.some(defaultPrompt => defaultPrompt.id === prompt.id)
              ),
            ],
          };
          setSettings(mergedSettings);
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      setError(null);
      await storeSettings(newSettings);
      setSettings(newSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Update specific setting
  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // API Key management
  const updateApiKey = useCallback(async (apiKey: string) => {
    await updateSetting('openaiApiKey', apiKey);
  }, [updateSetting]);

  // Language management
  const updateDefaultLanguage = useCallback(async (language: string) => {
    await updateSetting('defaultLanguage', language);
  }, [updateSetting]);

  // Theme management
  const updateTheme = useCallback(async (theme: 'light' | 'dark' | 'auto') => {
    await updateSetting('theme', theme);
  }, [updateSetting]);

  // Rewrite prompt management
  const addRewritePrompt = useCallback(async (prompt: Omit<RewritePrompt, 'id'>) => {
    const newPrompt: RewritePrompt = {
      ...prompt,
      id: crypto.randomUUID(),
    };
    
    const newPrompts = [...settings.rewritePrompts, newPrompt];
    await updateSetting('rewritePrompts', newPrompts);
    
    return newPrompt.id;
  }, [settings.rewritePrompts, updateSetting]);

  const updateRewritePrompt = useCallback(async (id: string, updates: Partial<Omit<RewritePrompt, 'id'>>) => {
    const newPrompts = settings.rewritePrompts.map(prompt =>
      prompt.id === id ? { ...prompt, ...updates } : prompt
    );
    await updateSetting('rewritePrompts', newPrompts);
  }, [settings.rewritePrompts, updateSetting]);

  const deleteRewritePrompt = useCallback(async (id: string) => {
    // Prevent deletion of default prompts
    const promptToDelete = settings.rewritePrompts.find(p => p.id === id);
    if (promptToDelete && DEFAULT_REWRITE_PROMPTS.some(defaultPrompt => defaultPrompt.id === id)) {
      throw new Error('Cannot delete default rewrite prompts');
    }

    const newPrompts = settings.rewritePrompts.filter(prompt => prompt.id !== id);
    
    // If the deleted prompt was the default, reset to 'default'
    let newDefaultPrompt = settings.defaultRewritePrompt;
    if (settings.defaultRewritePrompt === id) {
      newDefaultPrompt = 'default';
    }
    
    await saveSettings({
      ...settings,
      rewritePrompts: newPrompts,
      defaultRewritePrompt: newDefaultPrompt,
    });
  }, [settings, saveSettings]);

  const setDefaultRewritePrompt = useCallback(async (promptId: string) => {
    // Update the isDefault flag for all prompts
    const newPrompts = settings.rewritePrompts.map(prompt => ({
      ...prompt,
      isDefault: prompt.id === promptId,
    }));
    
    await saveSettings({
      ...settings,
      rewritePrompts: newPrompts,
      defaultRewritePrompt: promptId,
    });
  }, [settings, saveSettings]);

  // Validation helpers
  const validateApiKey = useCallback((apiKey: string): boolean => {
    return apiKey.startsWith('sk-') && apiKey.length > 20;
  }, []);

  const getLanguageDisplayName = useCallback((code: string): string => {
    const language = LANGUAGE_OPTIONS.find(lang => lang.code === code);
    return language ? `${language.nativeName} (${language.name})` : code;
  }, []);

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    updateSetting,
    updateApiKey,
    updateDefaultLanguage,
    updateTheme,
    addRewritePrompt,
    updateRewritePrompt,
    deleteRewritePrompt,
    setDefaultRewritePrompt,
    validateApiKey,
    getLanguageDisplayName,
    languageOptions: LANGUAGE_OPTIONS,
    defaultRewritePrompts: DEFAULT_REWRITE_PROMPTS,
  };
}