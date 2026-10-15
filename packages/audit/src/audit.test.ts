import { describe, expect, it } from "vitest";
import { createAuditEvent, redactMetadata } from "./index.js";

describe("audit — redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const out = redactMetadata({
      safe: "ok",
      password: "hunter2",
      nested: { token: "abc", diagnosisSummary: "x" },
      list: [{ apiKey: "k" }],
    }) as Record<string, unknown>;
    expect(out.safe).toBe("ok");
    expect(out.password).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).token).toBe("[REDACTED]");
    expect(((out.list as Record<string, unknown>[])[0]?.apiKey)).toBe("[REDACTED]");
  });
});

describe("audit — event creation", () => {
  it("produces an immutable, redacted event with defaults", () => {
    const ev = createAuditEvent({
      category: "JOURNEY",
      action: "journey.test",
      actor: { actorId: "u1", roles: ["CLINICIAN"] },
      patientId: "p1",
      metadata: { command: "X", password: "should-not-appear" },
    });
    expect(ev.severity).toBe("INFO");
    expect(ev.metadata?.password).toBe("[REDACTED]");
    expect(Object.isFrozen(ev)).toBe(true);
    expect(typeof ev.occurredAt).toBe("string");
  });
});
