'use client';

import React, { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeMode } from '@/types';
import { cn } from '@/lib/utils';

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const themeOptions: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
  },
  {
    value: 'auto',
    label: 'Auto',
    icon: Monitor,
  },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-indigo-500" />
          <label className="text-lg font-semibold text-foreground">Appearance</label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.value}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card text-muted-foreground min-h-[88px]"
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{option.label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Auto mode follows your device&apos;s system preference
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5 text-indigo-500" />
        <label className="text-lg font-semibold text-foreground">Appearance</label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-200',
                'min-h-[88px] touch-manipulation active:scale-95',
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500 shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent-foreground/20'
              )}
            >
              <Icon className={cn(
                'transition-all duration-200',
                isSelected ? 'h-6 w-6' : 'h-5 w-5'
              )} />
              <span className={cn(
                'text-xs font-medium transition-all duration-200',
                isSelected ? 'font-semibold' : ''
              )}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Auto mode follows your device&apos;s system preference
      </p>
    </div>
  );
}