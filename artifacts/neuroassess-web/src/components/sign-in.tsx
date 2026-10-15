import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  LockKeyhole,
  Stethoscope,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { useSession, useFlags } from "@/platform";
import type { PlatformRole } from "@neurocare/permissions";

/**
 * Synthetic development sign-in.
 *
 * SECURITY: This is NOT real authentication. It exists only so the unified
 * shell and capability guards can be exercised before Supabase/JWT is wired.
 * Workspace guards gate it behind the `unifiedApplicationShell` flag and it
 * creates an in-memory/local session with a chosen role. No credentials are
 * transmitted or stored. It must be replaced by the real auth flow before any
 * real data is handled (tracked in the production-readiness gap register).
 */

interface DemoIdentity {
  readonly role: PlatformRole;
  readonly name: string;
  readonly email: string;
  readonly blurb: string;
  readonly workspacePath: string;
}

const demoIdentities: readonly DemoIdentity[] = [
  {
    role: "PATIENT",
    name: "Demo Patient",
    email: "patient@demo.neuroassess",
    blurb: "My Care workspace",
    workspacePath: "/patient",
  },
  {
    role: "CLINICIAN",
    name: "Demo Clinician",
    email: "clinician@demo.neuroassess",
    blurb: "Clinical workstation",
    workspacePath: "/clinician",
  },
  {
    role: "ADMIN",
    name: "Demo Admin",
    email: "admin@demo.neuroassess",
    blurb: "Operations control centre",
    workspacePath: "/admin",
  },
  {
    role: "FINANCE",
    name: "Demo Finance",
    email: "finance@demo.neuroassess",
    blurb: "Finance workspace",
    workspacePath: "/finance",
  },
];

const iconFor = (role: PlatformRole) =>
  role === "PATIENT"
    ? UserRound
    : role === "FINANCE"
      ? ShieldCheck
      : Stethoscope;

/**
 * Synthetic development sign-in page. Creates a local demo session only — no
 * credentials, no network calls. Workspace guards independently enforce flags,
 * session and capability. Replace with real auth before any real data is
 * handled (production-readiness gap register).
 */
export function SignInPage() {
  const session = useSession();
  const flags = useFlags();
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<PlatformRole>("CLINICIAN");

  if (!flags.isEnabled("unifiedApplicationShell")) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))] px-5">
        <div
          className="max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center"
          role="status"
        >
          <h1 className="text-2xl tracking-[-.03em]">
            Sign-in isn't available yet
          </h1>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            The unified application shell is being rolled out gradually. Please
            check back soon.
          </p>
        </div>
      </main>
    );
  }

  if (session.isAuthenticated && session.user) {
    const firstWorkspace = session.workspaces[0];
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--secondary)/.42)] px-5">
        <div className="w-full max-w-md rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
            Signed in
          </p>
          <h1 className="mt-3 text-3xl tracking-[-.04em]">
            {session.user.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            {session.workspaces.length > 0
              ? `You have access to ${session.workspaces.length} workspace${session.workspaces.length === 1 ? "" : "s"}.`
              : "Your account has no workspace access yet. Contact your clinic administrator."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {firstWorkspace && (
              <button
                onClick={() => setLocation(`/${firstWorkspace}`)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))]"
                data-testid="signin-continue"
              >
                Continue <ArrowRight size={16} />
              </button>
            )}
            <button
              onClick={() => session.signOut()}
              className="text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
              data-testid="signin-signout"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const selected =
    demoIdentities.find((identity) => identity.role === selectedRole) ??
    demoIdentities[0];
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary)/.42)] px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
            NeuroAssess UK
          </span>
          <h1 className="mt-3 text-4xl tracking-[-.04em]">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Choose your workspace identity to continue.
          </p>
        </div>

        <div
          className="mb-6 rounded-xl border border-[hsl(var(--accent)/.5)] bg-[hsl(var(--accent)/.15)] px-4 py-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"
          role="note"
          data-testid="signin-dev-notice"
        >
          <strong className="font-semibold">Development sign-in.</strong>{" "}
          Synthetic identities only — no credentials are sent or stored, and no
          real patient data is available here.
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const identity =
              demoIdentities.find(
                (candidate) => candidate.role === selectedRole,
              ) ?? demoIdentities[0];
            session.signIn({
              id: `demo-${identity.role.toLowerCase()}`,
              name: identity.name,
              email: identity.email,
              roles: [identity.role],
            });
            setLocation(identity.workspacePath);
          }}
          className="rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:p-8"
        >
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">
              Workspace identity
            </legend>
            <div className="grid gap-3">
              {demoIdentities.map((identity) => {
                const Icon = iconFor(identity.role);
                const active = identity.role === selectedRole;
                return (
                  <label
                    key={identity.role}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]"
                        : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.4)]"
                    }`}
                    data-testid={`signin-role-${identity.role.toLowerCase()}`}
                  >
                    <input
                      type="radio"
                      name="demo-role"
                      className="sr-only"
                      value={identity.role}
                      checked={active}
                      onChange={() => setSelectedRole(identity.role)}
                    />
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                        active
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {identity.name}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                        {identity.blurb}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="signin-submit"
          >
            Continue as {selected.name} <ArrowRight size={16} />
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <LockKeyhole size={14} /> Capability-checked access, denied by
            default
          </div>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--primary))]"
            data-testid="signin-back"
          >
            Back to NeuroAssess UK
          </Link>
        </div>
      </div>
    </main>
  );
}
