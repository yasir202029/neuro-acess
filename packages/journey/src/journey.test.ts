import { describe, expect, it } from "vitest";
import {
  availableCommands,
  planTransition,
  type JourneyFacts,
} from "./index.js";
import type { CapabilityGrants } from "@neurocare/permissions";

const clinician: CapabilityGrants = { roles: ["CLINICIAN"] };
const patient: CapabilityGrants = { roles: ["PATIENT"] };
const admin: CapabilityGrants = { roles: ["ADMIN"] };

const facts = (overrides: Partial<JourneyFacts> = {}): JourneyFacts => ({
  currentStage: "ASSESSMENT",
  hasAssignedClinician: true,
  hasIntakeCompleted: true,
  openTaskTypes: [],
  version: 3,
  ...overrides,
});

describe("journey — transition planning", () => {
  it("plans a valid forward transition", () => {
    const result = planTransition({
      request: { command: "RECORD_ASSESSMENT_OUTCOME", payload: { outcome: "CONFIRMED", diagnosisSummary: "ADHD, combined presentation" } },
      facts: facts(),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.toStage).toBe("DIAGNOSIS_REVIEW");
      expect(result.plan.stageChanged).toBe(true);
      expect(result.plan.definition.clinicalAuthorisation).toBe(true);
    }
  });

  it("advances DIAGNOSIS_REVIEW to DIAGNOSIS_CONFIRMED on CONFIRM_DIAGNOSIS", () => {
    const result = planTransition({
      request: { command: "CONFIRM_DIAGNOSIS", payload: { reason: "Meets DSM-5 criteria" } },
      facts: facts({ currentStage: "DIAGNOSIS_REVIEW" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.toStage).toBe("DIAGNOSIS_CONFIRMED");
  });

  it("moves ASSESSMENT -> MDT_REVIEW on escalation and back on resume", () => {
    const escalated = planTransition({
      request: { command: "ESCALATE_TO_MDT", payload: { reason: "Complex differential" } },
      facts: facts({ currentStage: "ASSESSMENT" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(escalated.ok).toBe(true);
    if (escalated.ok) expect(escalated.plan.toStage).toBe("MDT_REVIEW");

    const resumed = planTransition({
      request: { command: "RESUME_FROM_MDT", payload: { reason: "MDT outcome recorded" } },
      facts: facts({ currentStage: "MDT_REVIEW" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.plan.toStage).toBe("DIAGNOSIS_REVIEW");
  });

  it("rejects a transition from the wrong source stage", () => {
    const result = planTransition({
      request: { command: "START_TITRATION", payload: { reason: "begin" } },
      facts: facts({ currentStage: "ASSESSMENT" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.kind).toBe("INVALID_SOURCE_STAGE");
  });

  it("rejects when the actor lacks the capability (deny by default)", () => {
    const result = planTransition({
      request: { command: "RECORD_ASSESSMENT_OUTCOME", payload: { outcome: "CONFIRMED" } },
      facts: facts(),
      grants: patient,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.kind).toBe("FORBIDDEN");
  });

  it("rejects on optimistic-concurrency version conflict", () => {
    const result = planTransition({
      request: { command: "RECORD_ASSESSMENT_OUTCOME", payload: { outcome: "CONFIRMED" } },
      facts: facts({ version: 4 }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.kind).toBe("VERSION_CONFLICT");
  });

  it("blocks START_ASSESSMENT until intake is completed", () => {
    const result = planTransition({
      request: { command: "START_ASSESSMENT", payload: { reason: "begin" } },
      facts: facts({ currentStage: "INTAKE", hasIntakeCompleted: false }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.rejection.kind === "BLOCKED") {
      expect(result.rejection.conditions).toContain("REQUIRES_INTAKE_COMPLETED");
    }
  });
});

describe("journey — dynamic titration branch", () => {
  it("keeps TITRATION when the review says advance", () => {
    const result = planTransition({
      request: { command: "RECORD_TITRATION_REVIEW", payload: { tolerated: true, effective: false, advance: true } },
      facts: facts({ currentStage: "TITRATION" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.toStage).toBe("TITRATION");
  });

  it("moves to PRESCRIBING when titration is complete", () => {
    const result = planTransition({
      request: { command: "RECORD_TITRATION_REVIEW", payload: { tolerated: true, effective: true, advance: false } },
      facts: facts({ currentStage: "TITRATION" }),
      grants: clinician,
      expectedVersion: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.toStage).toBe("PRESCRIBING");
  });
});

describe("journey — available commands", () => {
  it("offers only permitted, stage-appropriate commands", () => {
    const commands = availableCommands(facts({ currentStage: "BOOKED" }), admin);
    expect(commands).toContain("TRIAGE_CASE");
    expect(commands).not.toContain("RECORD_ASSESSMENT_OUTCOME");
  });
});
