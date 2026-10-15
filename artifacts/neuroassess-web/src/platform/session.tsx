import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  resolveCapabilities,
  type Capability,
  type PlatformRole,
} from "@neurocare/permissions";
import {
  getSupabaseSession,
  onSupabaseAuthChange,
  signOutSupabase,
  type SupabaseSession,
} from "@/lib/supabase-auth";


/**
 * Client session model.
 *
 * SECURITY NOTE: the browser session is a *convenience mirror* of the server's
 * authenticated principal. It is NEVER the enforcement boundary. Every protected
 * API call re-verifies the capability server-side (deny-by-default). Hiding a
 * route here only improves UX; it does not grant or protect access.
 *
 * Until Supabase/JWT is wired, sign-in is a synthetic, clearly-labelled dev
 * session (see DEMO note below) gated behind the `unifiedApplicationShell`
 * feature flag. No real credentials are handled.
 */
export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roles: readonly PlatformRole[];
}

export interface SessionValue {
  readonly user: SessionUser | null;
  readonly capabilities: ReadonlySet<Capability>;
  readonly isAuthenticated: boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  can: (capability: Capability) => boolean;
  canAll: (capabilities: readonly Capability[]) => boolean;
  /** Workspaces this user is permitted to open, derived from capabilities. */
  readonly workspaces: readonly WorkspaceId[];
}

export type WorkspaceId = "patient" | "clinician" | "admin" | "finance";

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "neuroassess.session.v1";

/**
 * Decode the role claim from a Supabase JWT without verifying (verification
 * happens server-side on every API call). The payload is used ONLY to render
 * the correct workspace shell; it never grants access.
 */
function rolesFromToken(token: string): PlatformRole[] {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as {
      app_metadata?: { role?: unknown };
      user_metadata?: { role?: unknown };
    };
    const raw = payload.app_metadata?.role ?? payload.user_metadata?.role;
    const valid: readonly string[] = [
      "SUPER_ADMIN",
      "ADMIN",
      "CLINICIAN",
      "PATIENT",
      "RECEPTIONIST",
      "FINANCE",
      "REFERRER",
      "CORPORATE_CLIENT",
      "SUPPORT_AGENT",
    ];
    if (typeof raw === "string" && valid.includes(raw)) return [raw as PlatformRole];
    return [];
  } catch {
    return [];
  }
}

function userFromSupabase(session: SupabaseSession): SessionUser | null {
  if (!session) return null;
  const roles = rolesFromToken(session.accessToken);
  if (roles.length === 0) return null;
  return {
    id: session.userId,
    name: session.email,
    email: session.email,
    roles,
  };
}

function readStoredSession(): SessionUser | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (parsed && typeof parsed.id === "string" && Array.isArray(parsed.roles))
      return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Which workspaces a session may open. This is the single mapping from
 * session identity → workspace visibility; nav and route guards both read it
 * so the two can never disagree.
 *
 * Access requires BOTH conditions (deny-by-default):
 *   1. the session holds a role intended for that workstation, AND
 *   2. the session's effective capabilities include at least one of the
 *      workstation's gate capabilities.
 *
 * Role alone never opens a workstation (a revoked capability still denies),
 * and capability alone never opens one either (e.g. a clinician's
 * `billing:read` for earnings must not open the Finance Workspace).
 */
const workspaceRoles: Record<WorkspaceId, readonly PlatformRole[]> = {
  patient: ["PATIENT", "SUPER_ADMIN"],
  clinician: ["CLINICIAN", "SUPER_ADMIN"],
  admin: ["ADMIN", "RECEPTIONIST", "SUPPORT_AGENT", "SUPER_ADMIN"],
  finance: ["FINANCE", "SUPER_ADMIN"],
};

const workspaceCapabilities: Record<WorkspaceId, readonly Capability[]> = {
  patient: ["patient:read"],
  clinician: ["clinical:write", "assessment:write"],
  admin: [
    "user:manage",
    "clinic:manage",
    "platform:manage",
    "appointment:manage",
  ],
  finance: ["billing:read", "billing:write"],
};

const workspaceOrder: readonly WorkspaceId[] = [
  "patient",
  "clinician",
  "admin",
  "finance",
];

export function workspacesForSession(input: {
  readonly roles: readonly PlatformRole[];
  readonly capabilities: ReadonlySet<Capability>;
}): WorkspaceId[] {
  return workspaceOrder.filter(
    (workspace) =>
      input.roles.some((role) => workspaceRoles[workspace].includes(role)) &&
      workspaceCapabilities[workspace].some((capability) =>
        input.capabilities.has(capability),
      ),
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() =>
    readStoredSession(),
  );

  // Mirror the Supabase session (when configured) into the client session.
  // This only drives workspace rendering; every API call is re-verified
  // server-side. Falls back to the synthetic session when Supabase is absent.
  useEffect(() => {
    let cancelled = false;
    getSupabaseSession().then((session) => {
      if (!cancelled && session) {
        const mapped = userFromSupabase(session);
        if (mapped) setUser(mapped);
      }
    });
    const unsubscribe = onSupabaseAuthChange((session) => {
      if (cancelled) return;
      const mapped = session ? userFromSupabase(session) : null;
      if (mapped) {
        setUser(mapped);
        try {
          globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(mapped));
        } catch { /* storage unavailable */ }
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback((next: SessionUser) => {
    setUser(next);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — session stays in-memory only */
    }
  }, []);

  const signOut = useCallback(() => {
    void signOutSupabase();
    setUser(null);
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<SessionValue>(() => {
    const roles: readonly PlatformRole[] = user?.roles ?? [];
    const capabilities = user
      ? resolveCapabilities({ roles })
      : new Set<Capability>();
    return {
      user,
      capabilities,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      can: (capability) => capabilities.has(capability),
      canAll: (required) =>
        required.every((capability) => capabilities.has(capability)),
      workspaces: workspacesForSession({ roles, capabilities }),
    };
  }, [user, signIn, signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
