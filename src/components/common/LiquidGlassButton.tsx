import React from 'react';
import { motion, TargetAndTransition } from 'motion/react';

type LiquidGlassButtonProps = React.PropsWithChildren<{
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  whileHover?: TargetAndTransition;
  whileTap?: TargetAndTransition;
}>;

// Apple Liquid Glass capsule button - material lives in globals.css
// (.liquid-glass + .lg-btn), motion only handles the spring physics.
export function LiquidGlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  onTouchStart,
  onTouchEnd,
  whileHover: customWhileHover,
  whileTap: customWhileTap
}: LiquidGlassButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-2 sm:px-4 text-sm',
    md: 'px-4 py-3 sm:px-6',
    lg: 'px-6 py-4 sm:px-8'
  };

  const variantClasses = {
    primary: '',
    secondary: 'lg-btn--secondary'
  } as const;

  return (
    <motion.button
      type={type}
      onClick={disabled ? undefined : onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      disabled={disabled}
      className={`
        lg-btn liquid-glass liquid-glass-interactive touch-manipulation
        ${sizeClasses[size]} ${variantClasses[variant]} ${className}
      `}
      whileHover={disabled ? undefined : (customWhileHover ?? { scale: 1.04, y: -1 })}
      whileTap={disabled ? undefined : (customWhileTap ?? { scale: 0.96 })}
      transition={{
        scale: { type: 'spring', stiffness: 320, damping: 22, mass: 0.7 },
        y: { type: 'spring', stiffness: 320, damping: 24 }
      }}
    >
      <span className="relative z-10 inline-flex items-center justify-center">
        {children}
      </span>
      <span aria-hidden className="lg-btn-sheen" />
    </motion.button>
  );
}
