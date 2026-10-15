/**
 * ApexSkeleton — loading skeleton for the clinical workstation.
 */

import { cn } from '@/lib/utils';

export function ApexSkeleton({
  className,
  height = '1rem',
  width = '100%',
}: {
  className?: string;
  height?: string;
  width?: string;
}) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[hsl(var(--secondary))]',
        className,
      )}
      style={{ height, width }}
    />
  );
}
