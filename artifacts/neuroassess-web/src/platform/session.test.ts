import { describe, expect, it } from "vitest";
import { workspacesForSession } from "./session";
import {
  resolveCapabilities,
  type Capability,
  type PlatformRole,
} from "@neurocare/permissions";
import { isFeatureFlag } from "@neurocare/feature-flags";

/** Build an effective capability set the same way SessionProvider does. */
function session(
  roles: readonly PlatformRole[],
  options?: { revoke?: readonly Capability[] },
) {
  return {
    roles,
    capabilities: resolveCapabilities({ roles, userRevoke: options?.revoke }),
  };
}

describe("unified shell — workspace visibility (deny-by-default)", () => {
  it("opens no workspace when the session has no roles", () => {
    expect(workspacesForSession(session([]))).toEqual([]);
  });

  it("opens only the patient workspace for a patient", () => {
    expect(workspacesForSession(session(["PATIENT"]))).toEqual(["patient"]);
  });

  it("opens only the clinician workstation for a clinician", () => {
    // A clinician holds patient:read (record access) and billing:read (earnings)
    // but must NOT see the patient self-service or finance workspaces.
    expect(workspacesForSession(session(["CLINICIAN"]))).toEqual(["clinician"]);
  });

  it("opens only the admin control centre for an admin", () => {
    expect(workspacesForSession(session(["ADMIN"]))).toEqual(["admin"]);
  });

  it("opens the admin control centre for operational roles", () => {
    expect(workspacesForSession(session(["RECEPTIONIST"]))).toEqual(["admin"]);
    expect(workspacesForSession(session(["SUPPORT_AGENT"]))).toEqual(["admin"]);
  });

  it("opens only the finance workspace for finance", () => {
    // FINANCE holds patient:read but must not see the patient workspace.
    expect(workspacesForSession(session(["FINANCE"]))).toEqual(["finance"]);
  });

  it("opens every workspace for the break-glass super admin role", () => {
    expect(workspacesForSession(session(["SUPER_ADMIN"]))).toEqual([
      "patient",
      "clinician",
      "admin",
      "finance",
    ]);
  });

  it("opens no workspace for external roles", () => {
    expect(workspacesForSession(session(["REFERRER"]))).toEqual([]);
    expect(workspacesForSession(session(["CORPORATE_CLIENT"]))).toEqual([]);
  });

  it("denies a workstation when its gate capability is revoked", () => {
    // Role still present, but revoke wins.
    expect(
      workspacesForSession(
        session(["CLINICIAN"], {
          revoke: ["clinical:write", "assessment:write"],
        }),
      ),
    ).toEqual([]);
    expect(
      workspacesForSession(session(["PATIENT"], { revoke: ["patient:read"] })),
    ).toEqual([]);
  });
});

describe("unified shell — workspace feature flags exist in the catalogue", () => {
  it("registers every flag the shell guard chain depends on", () => {
    for (const flag of [
      "unifiedApplicationShell",
      "patientWorkspace",
      "clinicianWorkstation",
      "adminControlCentre",
      "financeWorkspace",
    ]) {
      expect(isFeatureFlag(flag), flag).toBe(true);
    }
  });
});
