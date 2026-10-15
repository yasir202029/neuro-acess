import { describe, expect, it } from "vitest";
import { runTransition, type WorkflowPorts } from "./index.js";
import type { JourneyFacts } from "@neurocare/journey";
import type { TimelineEvent } from "@neurocare/timeline";
import type { AuditEvent } from "@neurocare/audit";
import type { CapabilityGrants } from "@neurocare/permissions";

/** In-memory ports recording every effect, mimicking a single transaction. */
function makePorts(initial: JourneyFacts) {
  let version = initial.version;
  let stage = initial.currentStage;
  const effects = {
    transitions: [] as { from: string | null; to: string; command: string }[],
    tasks: [] as { type: string; title: string }[],
    notifications: [] as { audience: string; template: string }[],
    audits: [] as AuditEvent[],
    domainEvents: [] as TimelineEvent[],
    stageWrites: 0,
  };
  const ports: WorkflowPorts = {
    async loadFacts() {
      return { ...initial, currentStage: stage, version };
    },
    async applyStage({ toStage, expectedVersion }) {
      if (expectedVersion !== version) throw new Error("version conflict");
      stage = toStage;
      version += 1;
      effects.stageWrites += 1;
      return { version };
    },
    async recordTransition(input) {
      effects.transitions.push({ from: input.fromStage, to: input.toStage, command: input.command });
    },
    async createTasks({ tasks }) {
      for (const t of tasks) effects.tasks.push({ type: t.type, title: t.title });
    },
    async enqueueNotifications({ notifications }) {
      for (const n of notifications) effects.notifications.push({ audience: n.audience, template: n.template });
    },
    async writeAudit(event) {
      effects.audits.push(event);
    },
    async emitDomainEvent(event) {
      effects.domainEvents.push(event);
    },
  };
  return { ports, effects, getStage: () => stage, getVersion: () => version };
}

const clinician: CapabilityGrants = { roles: ["CLINICIAN"] };
const actor = { actorId: "clin-1", roles: ["CLINICIAN"] as const };

describe("workflow-engine — atomic transition", () => {
  it("performs the full effect sequence for a valid transition", async () => {
    const { ports, effects, getStage, getVersion } = makePorts({
      currentStage: "INTAKE",
      hasAssignedClinician: true,
      hasIntakeCompleted: true,
      openTaskTypes: [],
      version: 1,
    });
    const result = await runTransition(ports, {
      patientId: "p1",
      request: { command: "START_ASSESSMENT", payload: { reason: "begin" } },
      actor,
      grants: clinician,
    });
    expect(result.ok).toBe(true);
    expect(getStage()).toBe("ASSESSMENT");
    expect(getVersion()).toBe(2);
    expect(effects.transitions).toHaveLength(1);
    expect(effects.tasks.length).toBeGreaterThan(0);
    expect(effects.domainEvents).toHaveLength(1);
    expect(effects.audits).toHaveLength(1);
    expect(effects.audits[0]?.category).toBe("JOURNEY");
    expect(effects.notifications.length).toBeGreaterThan(0);
  });

  it("rejects without applying any effect when permission is missing", async () => {
    const { ports, effects, getStage } = makePorts({
      currentStage: "TRIAGE",
      hasAssignedClinician: true,
      hasIntakeCompleted: true,
      openTaskTypes: [],
      version: 1,
    });
    const result = await runTransition(ports, {
      patientId: "p1",
      request: { command: "START_ASSESSMENT", payload: { reason: "begin" } },
      actor,
      grants: { roles: ["PATIENT"] },
    });
    expect(result.ok).toBe(false);
    expect(getStage()).toBe("TRIAGE");
    expect(effects.stageWrites).toBe(0);
    expect(effects.audits).toHaveLength(0);
  });

  it("rejects when a blocking precondition is unmet and writes nothing", async () => {
    const { ports, effects } = makePorts({
      currentStage: "TRIAGE",
      hasAssignedClinician: true,
      hasIntakeCompleted: false,
      openTaskTypes: [],
      version: 1,
    });
    const result = await runTransition(ports, {
      patientId: "p1",
      request: { command: "START_ASSESSMENT", payload: { reason: "begin" } },
      actor,
      grants: clinician,
    });
    expect(result.ok).toBe(false);
    expect(effects.transitions).toHaveLength(0);
  });
});
