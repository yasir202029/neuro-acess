import type { ReactNode } from "react";
import { Link } from "wouter";
import { ShieldAlert, LockKeyhole } from "lucide-react";
import { useSession, type WorkspaceId } from "./session";
import { useFlags } from "./flags";
import type { FeatureFlag } from "@neurocare/feature-flags";

/**
 * Guard for an authenticated workspace.
 *
 * Enforces, in order: feature flag → authentication → workspace capability.
 * This is a UX gate only; the server is the real enforcement boundary. On any
 * failure it renders an explicit, accessible state — never a blank screen and
 * never the underlying workspace.
 */
export interface RequireWorkspaceProps {
  readonly workspace: WorkspaceId;
  readonly flag: FeatureFlag;
  readonly children: ReactNode;
}

export function RequireWorkspace({
  workspace,
  flag,
  children,
}: RequireWorkspaceProps) {
  const flags = useFlags();
  const session = useSession();

  if (!flags.isEnabled(flag)) {
    return (
      <AccessNotice
        icon={LockKeyhole}
        title="This workspace isn't available yet"
        text="It is being rolled out gradually. Please check back soon."
        testId={`workspace-disabled-${workspace}`}
      />
    );
  }
  if (!session.isAuthenticated) {
    return (
      <AccessNotice
        icon={LockKeyhole}
        title="Please sign in"
        text="You need to sign in to access this workspace."
        testId={`workspace-signin-${workspace}`}
        cta={{ href: "/signin", label: "Go to sign in" }}
      />
    );
  }
  if (!session.workspaces.includes(workspace)) {
    return (
      <AccessNotice
        icon={ShieldAlert}
        title="You don't have access to this workspace"
        text="Your account doesn't include permission for this area. If you believe this is wrong, contact your clinic administrator."
        testId={`workspace-denied-${workspace}`}
      />
    );
  }
  return <>{children}</>;
}

function AccessNotice({
  icon: Icon,
  title,
  text,
  testId,
  cta,
}: {
  icon: typeof ShieldAlert;
  title: string;
  text: string;
  testId: string;
  cta?: { href: string; label: string };
}) {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))] px-5"
      data-testid={testId}
    >
      <div
        className="max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center"
        role="status"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
          <Icon size={21} />
        </span>
        <h1 className="mt-5 text-2xl tracking-[-.03em]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          {text}
        </p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
            data-testid={`${testId}-cta`}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </main>
  );
}
