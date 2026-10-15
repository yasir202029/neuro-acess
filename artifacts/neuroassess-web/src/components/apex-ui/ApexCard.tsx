/**
 * ApexCard — card component for patient summaries, metrics, and work items.
 *
 * Elevates content on surface-l1 with a subtle border.
 */

import { cn } from '@/lib/utils';

export function ApexCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('surface-l1 rounded-lg border p-4', className)}>
      {children}
    </div>
  );
}
