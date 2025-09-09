/**
 * Animation utilities and easing functions
 */

export interface AnimationOptions {
  duration: number;
  easing?: EasingFunction;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

export type EasingFunction = (t: number) => number;

/**
 * Animation controller class
 */
export class Animation {
  private startTime: number | null = null;
  private animationId: number | null = null;
  private isRunning = false;
  private isPaused = false;
  private pausedTime = 0;

  constructor(private options: AnimationOptions) {}

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = performance.now() - this.pausedTime;
    this.tick();
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.startTime) {
      this.pausedTime = performance.now() - this.startTime;
    }
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    
    this.isPaused = false;
    this.startTime = performance.now() - this.pausedTime;
    this.tick();
  }

  cancel(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.isPaused = false;
    this.pausedTime = 0;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.options.onCancel?.();
  }

  private tick = (): void => {
    if (!this.isRunning || this.isPaused) return;
    
    const currentTime = performance.now();
    if (!this.startTime) {
      this.startTime = currentTime;
    }
    
    const elapsed = currentTime - this.startTime;
    const progress = Math.min(elapsed / this.options.duration, 1);
    
    // Apply easing function
    const easedProgress = this.options.easing ? this.options.easing(progress) : progress;
    
    // Call update callback
    this.options.onUpdate?.(easedProgress);
    
    if (progress >= 1) {
      // Animation complete
      this.isRunning = false;
      this.options.onComplete?.();
    } else {
      // Continue animation
      this.animationId = requestAnimationFrame(this.tick);
    }
  };

  get running(): boolean {
    return this.isRunning;
  }

  get paused(): boolean {
    return this.isPaused;
  }
}

/**
 * Create a new animation
 */
export function createAnimation(options: AnimationOptions): Animation {
  return new Animation(options);
}

/**
 * Easing functions
 */
export const easing = {
  linear: (t: number): number => t,
  
  easeIn: (t: number): number => t * t,
  
  easeOut: (t: number): number => t * (2 - t),
  
  easeInOut: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  
  easeInQuad: (t: number): number => t * t,
  
  easeOutQuad: (t: number): number => t * (2 - t),
  
  easeInOutQuad: (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  
  easeInCubic: (t: number): number => t * t * t,
  
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  
  easeInQuart: (t: number): number => t * t * t * t,
  
  easeOutQuart: (t: number): number => 1 - (--t) * t * t * t,
  
  easeInOutQuart: (t: number): number => {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
  },
  
  easeInQuint: (t: number): number => t * t * t * t * t,
  
  easeOutQuint: (t: number): number => 1 + (--t) * t * t * t * t,
  
  easeInOutQuint: (t: number): number => {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t;
  },
  
  easeInSine: (t: number): number => 1 - Math.cos(t * Math.PI / 2),
  
  easeOutSine: (t: number): number => Math.sin(t * Math.PI / 2),
  
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  
  easeInExpo: (t: number): number => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  
  easeOutExpo: (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  
  easeInOutExpo: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - t * t),
  
  easeOutCirc: (t: number): number => Math.sqrt(1 - (--t) * t),
  
  easeInOutCirc: (t: number): number => {
    return t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2;
  },
  
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  
  easeInOutElastic: (t: number): number => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },
  
  easeInBounce: (t: number): number => 1 - easing.easeOutBounce(1 - t),
  
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  
  easeInOutBounce: (t: number): number => {
    return t < 0.5
      ? (1 - easing.easeOutBounce(1 - 2 * t)) / 2
      : (1 + easing.easeOutBounce(2 * t - 1)) / 2;
  }
};

/**
 * Animate a numeric value
 */
export function animateValue(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  easingFn: EasingFunction = easing.easeInOut
): Animation {
  return createAnimation({
    duration,
    easing: easingFn,
    onUpdate: (progress) => {
      const value = from + (to - from) * progress;
      onUpdate(value);
    }
  });
}

/**
 * Animate multiple values simultaneously
 */
export function animateValues(
  values: Array<{ from: number; to: number; onUpdate: (value: number) => void }>,
  duration: number,
  easingFn: EasingFunction = easing.easeInOut
): Animation {
  return createAnimation({
    duration,
    easing: easingFn,
    onUpdate: (progress) => {
      values.forEach(({ from, to, onUpdate }) => {
        const value = from + (to - from) * progress;
        onUpdate(value);
      });
    }
  });
}

/**
 * Spring animation system
 */
export class SpringAnimation {
  private position: number;
  private velocity = 0;
  private target: number;
  private stiffness: number;
  private damping: number;
  private mass: number;
  private animationId: number | null = null;
  private onUpdate?: (value: number) => void;
  private onComplete?: () => void;

  constructor(
    initialValue: number,
    options: {
      stiffness?: number;
      damping?: number;
      mass?: number;
      onUpdate?: (value: number) => void;
      onComplete?: () => void;
    } = {}
  ) {
    this.position = initialValue;
    this.target = initialValue;
    this.stiffness = options.stiffness ?? 100;
    this.damping = options.damping ?? 10;
    this.mass = options.mass ?? 1;
    this.onUpdate = options.onUpdate;
    this.onComplete = options.onComplete;
  }

  setTarget(target: number): void {
    this.target = target;
    if (!this.animationId) {
      this.start();
    }
  }

  private start(): void {
    const tick = () => {
      const deltaTime = 1 / 60; // Assume 60fps
      
      // Spring physics
      const force = -this.stiffness * (this.position - this.target);
      const damping = -this.damping * this.velocity;
      const acceleration = (force + damping) / this.mass;
      
      this.velocity += acceleration * deltaTime;
      this.position += this.velocity * deltaTime;
      
      this.onUpdate?.(this.position);
      
      // Check if animation should continue
      const isAtRest = Math.abs(this.velocity) < 0.01 && Math.abs(this.position - this.target) < 0.01;
      
      if (isAtRest) {
        this.position = this.target;
        this.velocity = 0;
        this.animationId = null;
        this.onUpdate?.(this.position);
        this.onComplete?.();
      } else {
        this.animationId = requestAnimationFrame(tick);
      }
    };
    
    this.animationId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getCurrentValue(): number {
    return this.position;
  }
}

/**
 * Stagger animations for multiple elements
 */
export function staggerAnimations(
  elements: HTMLElement[],
  animationFn: (element: HTMLElement, index: number) => Animation,
  staggerDelay: number = 100
): Animation[] {
  return elements.map((element, index) => {
    const animation = animationFn(element, index);
    
    // Delay the start of each animation
    setTimeout(() => {
      animation.start();
    }, index * staggerDelay);
    
    return animation;
  });
}

/**
 * Parallax scrolling utility
 */
export class ParallaxController {
  private elements: Array<{
    element: HTMLElement;
    speed: number;
    offset: number;
  }> = [];

  addElement(element: HTMLElement, speed: number = 0.5): void {
    this.elements.push({
      element,
      speed,
      offset: element.offsetTop
    });
  }

  removeElement(element: HTMLElement): void {
    this.elements = this.elements.filter(item => item.element !== element);
  }

  update(scrollY: number): void {
    this.elements.forEach(({ element, speed, offset }) => {
      const yPos = -(scrollY - offset) * speed;
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  destroy(): void {
    this.elements = [];
  }
}

/**
 * Morphing animation between shapes
 */
export function morphPath(
  fromPath: string,
  toPath: string,
  duration: number,
  onUpdate: (path: string) => void,
  easingFn: EasingFunction = easing.easeInOut
): Animation {
  // Simple path morphing - in production, use a proper SVG morphing library
  return createAnimation({
    duration,
    easing: easingFn,
    onUpdate: (progress) => {
      // This is a simplified implementation
      // Real path morphing requires complex path interpolation
      const path = progress < 0.5 ? fromPath : toPath;
      onUpdate(path);
    }
  });
}

/**
 * CSS Animation classes for common UI animations
 */
export const animations = {
  fadeIn: 'animate-in fade-in duration-500',
  fadeOut: 'animate-out fade-out duration-300',
  slideInFromTop: 'animate-in slide-in-from-top-4 duration-500',
  slideInFromBottom: 'animate-in slide-in-from-bottom-4 duration-500',
  slideInFromLeft: 'animate-in slide-in-from-left-4 duration-500',
  slideInFromRight: 'animate-in slide-in-from-right-4 duration-500',
  slideOutToTop: 'animate-out slide-out-to-top-4 duration-300',
  slideOutToBottom: 'animate-out slide-out-to-bottom-4 duration-300',
  slideOutToLeft: 'animate-out slide-out-to-left-4 duration-300',
  slideOutToRight: 'animate-out slide-out-to-right-4 duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-500',
  scaleOut: 'animate-out zoom-out-95 duration-300',
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
};

/**
 * Animation presets for common UI components
 */
export const animationPresets = {
  button: {
    idle: 'transition-all duration-200 ease-in-out',
    hover: 'hover:scale-105 hover:shadow-md',
    active: 'active:scale-95',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  card: {
    idle: 'transition-all duration-300 ease-in-out',
    hover: 'hover:shadow-md hover:-translate-y-1',
    active: 'active:scale-98',
  },
  modal: {
    backdrop: 'animate-in fade-in duration-300',
    content: 'animate-in fade-in zoom-in-95 duration-300',
    exit: 'animate-out fade-out zoom-out-95 duration-200',
  },
  tooltip: {
    enter: 'animate-in fade-in zoom-in-95 duration-200',
    exit: 'animate-out fade-out zoom-out-95 duration-150',
  },
  dropdown: {
    enter: 'animate-in fade-in slide-in-from-top-2 duration-200',
    exit: 'animate-out fade-out slide-out-to-top-2 duration-150',
  },
};