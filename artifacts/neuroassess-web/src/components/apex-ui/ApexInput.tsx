/**
 * ApexInput — text input for the clinical workstation.
 */

import { cn } from '@/lib/utils';

export function ApexInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]',
        className,
      )}
      {...props}
    />
  );
}
