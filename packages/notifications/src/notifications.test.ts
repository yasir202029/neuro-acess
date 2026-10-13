import { describe, expect, it } from "vitest";
import { routeNotification } from "./index.js";

describe("notifications — routing", () => {
  it("allows a known template on an allowed channel", () => {
    expect(routeNotification({ audience: "PATIENT", channel: "EMAIL", template: "referral_received" })).toEqual({ ok: true, channel: "EMAIL" });
  });
  it("rejects an unknown template", () => {
    const d = routeNotification({ audience: "PATIENT", channel: "EMAIL", template: "not_a_template" });
    expect(d.ok).toBe(false);
  });
  it("rejects a channel not allowed for the audience", () => {
    const d = routeNotification({ audience: "ASSIGNED_CLINICIAN", channel: "SMS", template: "case_assigned" });
    expect(d).toEqual({ ok: false, reason: "CHANNEL_NOT_ALLOWED" });
  });
  it("rejects an unknown audience", () => {
    const d = routeNotification({ audience: "GHOST" as never, channel: "IN_APP", template: "case_assigned" });
    expect(d.ok).toBe(false);
  });
});
