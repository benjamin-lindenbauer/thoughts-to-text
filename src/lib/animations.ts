// Animation utilities for smooth UI interactions

export const animations = {
  // Fade animations
  fadeIn: 'animate-in fade-in duration-300',
  fadeOut: 'animate-out fade-out duration-200',
  
  // Slide animations
  slideInFromBottom: 'animate-in slide-in-from-bottom-4 duration-300',
  slideInFromTop: 'animate-in slide-in-from-top-4 duration-300',
  slideInFromLeft: 'animate-in slide-in-from-left-4 duration-300',
  slideInFromRight: 'animate-in slide-in-from-right-4 duration-300',
  
  // Scale animations
  scaleIn: 'animate-in zoom-in-95 duration-200',
  scaleOut: 'animate-out zoom-out-95 duration-150',
  
  // Bounce animations for buttons
  bounceIn: 'animate-in zoom-in-95 duration-200 ease-out',
  
  // Recording specific animations
  recordingPulse: 'animate-pulse',
  recordingScale: 'animate-bounce',
  
  // Loading animations
  spin: 'animate-spin',
  ping: 'animate-ping',
  
  // Transition classes
  transition: 'transition-all duration-200 ease-in-out',
  transitionFast: 'transition-all duration-150 ease-in-out',
  transitionSlow: 'transition-all duration-300 ease-in-out',
} as const;

// Animation presets for common UI patterns
export const animationPresets = {
  // Button interactions
  button: {
    idle: 'transform transition-all duration-150 ease-in-out',
    hover: 'transform scale-105 transition-all duration-150 ease-in-out',
    active: 'transform scale-95 transition-all duration-100 ease-in-out',
  },
  
  // Card interactions
  card: {
    idle: 'transform transition-all duration-200 ease-in-out',
    hover: 'transform translate-y-[-2px] shadow-lg transition-all duration-200 ease-in-out',
  },
  
  // Modal/Dialog animations
  modal: {
    overlay: 'animate-in fade-in duration-200',
    content: 'animate-in fade-in zoom-in-95 duration-200',
    exit: 'animate-out fade-out zoom-out-95 duration-150',
  },
  
  // Toast notifications
  toast: {
    enter: 'animate-in slide-in-from-top-full duration-300',
    exit: 'animate-out slide-out-to-top-full duration-200',
  },
  
  // Recording interface
  recording: {
    button: {
      idle: 'transform transition-all duration-200 ease-in-out',
      recording: 'transform scale-110 animate-pulse transition-all duration-200 ease-in-out',
      stopping: 'transform scale-95 transition-all duration-150 ease-in-out',
    },
    waveform: 'animate-pulse',
    duration: 'animate-in fade-in duration-300',
  },
  
  // List animations
  list: {
    item: 'animate-in fade-in slide-in-from-left-4 duration-300',
    stagger: (index: number) => `animate-in fade-in slide-in-from-left-4 duration-300 delay-${Math.min(index * 50, 300)}`,
  },
} as const;

// Utility functions for dynamic animations
export function getStaggerDelay(index: number, baseDelay: number = 50, maxDelay: number = 300): string {
  const delay = Math.min(index * baseDelay, maxDelay);
  return `delay-${delay}`;
}

export function combineAnimations(...animations: string[]): string {
  return animations.filter(Boolean).join(' ');
}

// React hook for managing animation states
export function useAnimationState(initialState: string = 'idle') {
  const [animationState, setAnimationState] = React.useState(initialState);
  
  const triggerAnimation = (newState: string, duration?: number) => {
    setAnimationState(newState);
    
    if (duration) {
      setTimeout(() => {
        setAnimationState('idle');
      }, duration);
    }
  };
  
  return [animationState, triggerAnimation] as const;
}

// Performance-optimized animation utilities
export const performantAnimations = {
  // Use transform and opacity for better performance
  slideUp: 'transform translate-y-0 opacity-100 transition-all duration-300 ease-out',
  slideDown: 'transform translate-y-full opacity-0 transition-all duration-300 ease-out',
  
  // GPU-accelerated animations
  gpuAccelerated: 'transform-gpu will-change-transform',
  
  // Reduced motion support
  respectMotion: 'motion-safe:animate-in motion-reduce:animate-none',
};

// Animation timing functions
export const easings = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// CSS-in-JS animation keyframes for complex animations
export const keyframes = {
  recordingPulse: {
    '0%, 100%': { transform: 'scale(1)', opacity: '1' },
    '50%': { transform: 'scale(1.05)', opacity: '0.8' },
  },
  
  waveform: {
    '0%, 100%': { height: '20%' },
    '50%': { height: '100%' },
  },
  
  shimmer: {
    '0%': { backgroundPosition: '-200px 0' },
    '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
  },
} as const;

import React from 'react';