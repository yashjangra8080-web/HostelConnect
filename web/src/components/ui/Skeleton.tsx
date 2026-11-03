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
        return 'rounded-full w-9 h-9 border-2 border-black';
      case 'button':
        return 'rounded-[8px] h-9 w-24 border-2 border-black';
      case 'row':
        return 'rounded-[4px] h-11 w-full border border-black';
      case 'rect':
        return 'rounded-[4px] h-24 w-full border-2 border-black';
      case 'text':
      default:
        return 'rounded-[4px] h-4 w-full border border-black';
    }
  };

  const items = Array.from({ length: count }, (_, idx) => (
    <div
      key={idx}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      className={`bg-surface-subtle animate-pulse ${getVariantStyles()} ${className}`}
      aria-hidden="true"
    />
  ));

  if (count === 1) {
    return items[0];
  }

  return <div className="space-y-2">{items}</div>;
};
