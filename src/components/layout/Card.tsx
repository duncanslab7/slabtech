import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Card component for content grouping
 *
 * Variants:
 * - default: Thermal dark background with subtle border
 * - outlined: Thermal orange border with glow
 * - elevated: Thermal background with thermal glow shadow
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const baseStyles = 'bg-gradient-to-br from-thermal-dark/80 to-thermal-purple/80 rounded-lg backdrop-blur-sm';

  const variantStyles = {
    default: 'border border-thermal-orange/20',
    outlined: 'border-2 border-thermal-orange/50',
    elevated: 'shadow-thermal-glow-orange border border-thermal-orange/30',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`;

  return <div className={combinedStyles}>{children}</div>;
};
