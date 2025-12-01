import React from 'react';

export interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  variant?: 'primary' | 'secondary' | 'tagline';
  size?: 'xl' | 'lg' | 'md' | 'sm';
  className?: string;
  children: React.ReactNode;
}

/**
 * Heading component following SLAB brand typography guidelines
 *
 * Variants:
 * - primary: Midnight Blue (default for headers)
 * - secondary: Steel Gray (for subheadings)
 * - tagline: Midnight Blue with tagline styling
 *
 * Sizes:
 * - xl: 36px (28pt-36pt range from brand guide)
 * - lg: 28px (28pt-36pt range from brand guide)
 * - md: 20px (tagline size)
 * - sm: 16px (smaller tagline)
 */
export const Heading: React.FC<HeadingProps> = ({
  level = 1,
  variant = 'primary',
  size,
  className = '',
  children,
}) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  // Default size based on heading level if not specified
  const defaultSize = level === 1 ? 'xl' : level === 2 ? 'lg' : 'md';
  const finalSize = size || defaultSize;

  const baseStyles = 'font-bold';

  const variantStyles = {
    primary: 'text-midnight-blue',
    secondary: 'text-steel-gray',
    tagline: 'text-midnight-blue',
  };

  const sizeStyles = {
    xl: 'text-heading-xl',
    lg: 'text-heading-lg',
    md: 'text-tagline',
    sm: 'text-tagline-sm',
  };

  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[finalSize]} ${className}`;

  return <Tag className={combinedStyles}>{children}</Tag>;
};
