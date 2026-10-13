import { describe, expect, it } from "vitest";
import { authorise, canAll, requireCapabilities, AuthorisationError, type PlatformRole } from "./index.js";

const grants = (roles: PlatformRole[], extra: Partial<Parameters<typeof canAll>[0]> = {}) => ({ roles, ...extra });

describe("canonical capability model — deny by default", () => {
  it("mirrors the canonical grants: PATIENT is scoped, not org-wide", () => {
    expect(canAll(grants(["PATIENT"]), ["patient:read", "patient:write", "message:write"])).toBe(true);
    expect(canAll(grants(["PATIENT"]), ["billing:read"])).toBe(false);
    expect(canAll(grants(["PATIENT"]), ["assessment:write"])).toBe(false);
    expect(canAll(grants(["PATIENT"]), ["audit:read"])).toBe(false);
  });

  it("FINANCE is scoped to billing only", () => {
    expect(canAll(grants(["FINANCE"]), ["billing:read", "billing:write"])).toBe(true);
    expect(canAll(grants(["FINANCE"]), ["clinical:write"])).toBe(false);
    expect(canAll(grants(["FINANCE"]), ["assessment:write"])).toBe(false);
  });

  it("CLINICIAN can use AI but cannot manage it", () => {
    expect(canAll(grants(["CLINICIAN"]), ["ai:use"])).toBe(true);
    expect(canAll(grants(["CLINICIAN"]), ["ai:manage"])).toBe(false);
    expect(canAll(grants(["SUPER_ADMIN"]), ["ai:manage"])).toBe(true);
  });

  it("only SUPER_ADMIN holds platform:manage", () => {
    expect(canAll(grants(["ADMIN"]), ["platform:manage"])).toBe(false);
    expect(canAll(grants(["SUPER_ADMIN"]), ["platform:manage"])).toBe(true);
  });

  it("denies subjects with no roles with a stable reason", () => {
    const decision = authorise({ roles: [] }, ["patient:read"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("NO_ROLES");
  });

  it("denies when every role is unknown", () => {
    const decision = authorise({ roles: ["WIZARD" as PlatformRole] }, ["patient:read"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("UNKNOWN_ROLE");
  });
});

describe("canonical capability model — overrides", () => {
  it("organisation grant adds a capability", () => {
    expect(canAll(grants(["CLINICIAN"], { organisationGrant: ["audit:read"] }), ["audit:read"])).toBe(true);
  });

  it("revocation wins over grant", () => {
    const g = grants(["CLINICIAN"], { organisationGrant: ["audit:read"], userRevoke: ["audit:read"] });
    expect(canAll(g, ["audit:read"])).toBe(false);
  });

  it("organisation revoke removes a default capability", () => {
    expect(canAll(grants(["ADMIN"], { organisationRevoke: ["billing:write"] }), ["billing:write"])).toBe(false);
  });

  it("imperative guard throws on denial", () => {
    expect(() => requireCapabilities(grants(["PATIENT"]), ["billing:write"])).toThrow(AuthorisationError);
  });
});
