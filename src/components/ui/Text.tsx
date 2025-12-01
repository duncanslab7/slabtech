import React from 'react';

export interface TextProps {
  as?: 'p' | 'span' | 'div';
  variant?: 'body' | 'emphasis' | 'muted';
  size?: 'sm' | 'base' | 'lg';
  className?: string;
  children: React.ReactNode;
}

/**
 * Text component following SLAB brand typography guidelines
 *
 * Variants:
 * - body: Standard Charcoal text (default)
 * - emphasis: Midnight Blue for emphasized text
 * - muted: Steel Gray for de-emphasized text
 *
 * Sizes:
 * - sm: 11px
 * - base: 12px (brand standard body text)
 * - lg: 14px
 */
export const Text: React.FC<TextProps> = ({
  as = 'p',
  variant = 'body',
  size = 'base',
  className = '',
  children,
}) => {
  const Tag = as;

  const baseStyles = 'leading-relaxed';

  const variantStyles = {
    body: 'text-charcoal',
    emphasis: 'text-midnight-blue font-semibold',
    muted: 'text-steel-gray',
  };

  const sizeStyles = {
    sm: 'text-[11px]',
    base: 'text-body',
    lg: 'text-[14px]',
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return <Tag className={combinedStyles}>{children}</Tag>;
};
