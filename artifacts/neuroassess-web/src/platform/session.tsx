import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  resolveCapabilities,
  type Capability,
  type PlatformRole,
} from "@neurocare/permissions";

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

  const signIn = useCallback((next: SessionUser) => {
    setUser(next);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — session stays in-memory only */
    }
  }, []);

  const signOut = useCallback(() => {
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
