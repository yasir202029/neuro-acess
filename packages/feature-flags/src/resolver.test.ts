import { describe, expect, it } from "vitest";
import { resolveFlag, resolveAllFlags } from "./index.js";

describe("feature flags — resolution precedence", () => {
  it("kill switch forces OFF and overrides everything", () => {
    const r = resolveFlag({
      flag: "patientWorkspace",
      environment: "development",
      overrides: {
        env: { patientWorkspace: true },
        organisation: { patientWorkspace: true },
        user: { patientWorkspace: true },
        killSwitch: { patientWorkspace: true },
      },
    });
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("KILL_SWITCH");
  });

  it("user override beats org and env", () => {
    const r = resolveFlag({
      flag: "clinicianWorkstation",
      environment: "development",
      overrides: {
        env: { clinicianWorkstation: true },
        organisation: { clinicianWorkstation: true },
        user: { clinicianWorkstation: false },
      },
    });
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("USER");
  });

  it("production defaults to OFF for development-default flags", () => {
    const r = resolveFlag({
      flag: "patientWorkspace",
      environment: "production",
    });
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("DEFAULT");
  });

  it("development honours the catalogue default", () => {
    const r = resolveFlag({
      flag: "patientWorkspace",
      environment: "development",
    });
    expect(r.enabled).toBe(true);
  });

  it("reads env via NEUROCARE_FLAG_ convention", () => {
    const r = resolveFlag({
      flag: "documentGeneration",
      environment: "development",
      env: { NEUROCARE_FLAG_DOCUMENT_GENERATION: "on" },
    });
    expect(r.enabled).toBe(true);
    expect(r.source).toBe("ENV");
  });

  it("resolveAllFlags returns an entry for every flag", () => {
    const all = resolveAllFlags({ environment: "development" });
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(18);
  });
});
