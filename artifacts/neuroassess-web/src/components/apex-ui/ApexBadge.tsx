/**
 * ApexBadge — status badge for the clinical workstation.
 *
 * Every status is paired with an explicit label; colour alone never conveys
 * clinically important information.
 *
 * @param status — one of: active, waiting, completed, overdue, blocked, review,
 *   unsigned, approved, cancelled, failed, archived, info, safety
 * @param label — human-readable status text
 * @param className — optional additional Tailwind classes
 */

import { cn } from '@/lib/utils';

export function ApexBadge({
  status,
  label,
  className,
}: {
  status:
    | 'active'
    | 'waiting'
    | 'completed'
    | 'overdue'
    | 'blocked'
    | 'review'
    | 'unsigned'
    | 'approved'
    | 'cancelled'
    | 'failed'
    | 'archived'
    | 'info'
    | 'safety';
  label: string;
  className?: string;
}) {
  const statusClasses: Record<string, string> = {
    active: 'badge-active',
    waiting: 'badge-waiting',
    completed: 'badge-completed',
    overdue: 'badge-overdue',
    blocked: 'badge-blocked',
    review: 'badge-review',
    unsigned: 'badge-unsigned',
    approved: 'badge-approved',
    cancelled: 'badge-cancelled',
    failed: 'badge-failed',
    archived: 'badge-archived',
    info: 'badge-info',
    safety: 'badge-safety',
  };

  return (
    <span
      className={cn(
        'rounded border px-2 py-0.5 text-[10px] font-semibold',
        statusClasses[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
