import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { soundManager } from '../lib/SoundManager';

type ButtonVariant = 'yellow' | 'pink' | 'blue' | 'green';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  yellow: 'btn-cartoon btn-yellow',
  pink: 'btn-cartoon btn-pink',
  blue: 'btn-cartoon btn-blue',
  green: 'btn-cartoon btn-green',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm py-2 px-4',
  md: 'text-base py-3 px-6',
  lg: 'text-xl py-4 px-8',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'yellow',
  size = 'md',
  fullWidth = false,
  loading = false,
  className,
  disabled,
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading) {
      soundManager.play('click');
    }
    onClick?.(e);
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={clsx(
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <div className="loading-cartoon justify-center">
          <span></span>
          <span></span>
          <span></span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
};
