import React from 'react';

export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'button' | 'row';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circle':
        return 'rounded-full w-9 h-9';
      case 'button':
        return 'rounded h-9 w-24';
      case 'row':
        return 'rounded h-11 w-full';
      case 'rect':
        return 'rounded h-24 w-full';
      case 'text':
      default:
        return 'rounded h-4 w-full';
    }
  };

  const items = Array.from({ length: count }, (_, idx) => (
    <div
      key={idx}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      className={`bg-border/70 animate-pulse ${getVariantStyles()} ${className}`}
      aria-hidden="true"
    />
  ));

  if (count === 1) {
    return items[0];
  }

  return <div className="space-y-2 w-full">{items}</div>;
};
