/**
 * ApexPanel — surface-level container for workstation content.
 *
 * Uses the APEX surface-level design tokens (L0–L4) to create visual
 * hierarchy without relying on colour alone.
 *
 * @param level — surface level (l0 | l1 | l2 | l3 | l4)
 * @param className — optional additional Tailwind classes
 * @param children — panel content
 */

import { cn } from '@/lib/utils';

export function ApexPanel({
  level,
  className,
  children,
}: {
  level?: 'l0' | 'l1' | 'l2' | 'l3' | 'l4';
  className?: string;
  children: React.ReactNode;
}) {
  const surfaceClasses: Record<string, string> = {
    l0: 'surface-l0',
    l1: 'surface-l1',
    l2: 'surface-l2',
    l3: 'surface-l3',
    l4: 'surface-l4',
  };

  return (
    <div
      className={cn(
        'rounded border p-4',
        surfaceClasses[level ?? 'l1'],
        className,
      )}
    >
      {children}
    </div>
  );
}
