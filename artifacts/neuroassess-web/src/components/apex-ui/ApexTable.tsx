/**
 * ApexTable — accessible data table wrapper for work queues and lists.
 *
 * Wraps a <table> element in a horizontally scrolling container with compact
 * typography. Caller provides thead/tbody structure.
 */

import { cn } from '@/lib/utils';

export function ApexTable({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-[12px]">{children}</table>
    </div>
  );
}
