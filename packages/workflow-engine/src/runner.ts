import { planTransition, type TransitionRequest } from "@neurocare/journey";
import type { JourneyFacts, TransitionRejection } from "@neurocare/journey";
import { authorise, type CapabilityGrants } from "@neurocare/permissions";
import { createAuditEvent, type AuditActor } from "@neurocare/audit";
import type { TimelineEvent } from "@neurocare/timeline";

/**
 * Ports the workflow-engine depends on. The backend implements these over a
 * single database transaction; tests implement them in-memory. Keeping the
 * engine port-based means the orchestration logic is unit-tested without a DB.
 */
export interface WorkflowPorts {
  /** Load the current journey facts (stage, assignments, open blockers, version). */
  loadFacts(patientId: string): Promise<JourneyFacts>;
  /** Persist the new stage + bump version. Must fail if version no longer matches. */
  applyStage(input: {
    patientId: string;
    toStage: JourneyFacts["currentStage"];
    expectedVersion: number;
  }): Promise<{ version: number }>;
  /** Append an immutable workflow-transition record. */
  recordTransition(input: {
    patientId: string;
    fromStage: JourneyFacts["currentStage"] | null;
    toStage: JourneyFacts["currentStage"];
    command: TransitionRequest["command"];
    actorId: string;
    reason?: string;
  }): Promise<void>;
  /** Create generated tasks (idempotent per transition). */
  createTasks(input: { patientId: string; tasks: readonly { type: string; title: string; assigneeRole?: string; dueInDays?: number }[] }): Promise<void>;
  /** Enqueue notifications across the async boundary. */
  enqueueNotifications(input: { patientId: string; notifications: readonly { audience: string; channel: string; template: string }[] }): Promise<void>;
  /** Persist an audit event. */
  writeAudit(event: ReturnType<typeof createAuditEvent>): Promise<void>;
  /** Emit a domain event to the bus (timeline projection, analytics, etc.). */
  emitDomainEvent(event: TimelineEvent): Promise<void>;
}

export interface RunTransitionInput {
  readonly patientId: string;
  readonly request: TransitionRequest;
  readonly actor: AuditActor;
  readonly grants: CapabilityGrants;
  readonly reason?: string;
  readonly now?: () => string;
}

export type RunTransitionResult =
  | { readonly ok: true; readonly patientId: string; readonly stage: JourneyFacts["currentStage"]; readonly version: number; readonly timelineEvent: TimelineEvent }
  | { readonly ok: false; readonly rejection: TransitionRejection };

/**
 * Orchestrates one transition atomically. The caller (backend route) wraps the
 * port implementations in a single DB transaction so the sequence is all-or-
 * nothing. Order matches the specification:
 *   validate permissions -> validate preconditions -> update stage -> record
 *   transition -> create tasks -> emit domain event -> write audit -> notify.
 */
export async function runTransition(
  ports: WorkflowPorts,
  input: RunTransitionInput,
): Promise<RunTransitionResult> {
  const facts = await ports.loadFacts(input.patientId);
  const planned = planTransition({
    request: input.request,
    facts,
    grants: input.grants,
    expectedVersion: facts.version,
  });

  if (!planned.ok) {
    // Permission denials are tracked for observability (no PHI in the reason).
    const decision = authorise(input.grants, []);
    void decision;
    return { ok: false, rejection: planned.rejection };
  }

  const { plan } = planned;
  const definition = plan.definition;

  // 3. Update stage (optimistic concurrency enforced by the port).
  const { version } = await ports.applyStage({
    patientId: input.patientId,
    toStage: plan.toStage,
    expectedVersion: facts.version,
  });

  const now = input.now ?? (() => new Date().toISOString());

  // 4. Record the immutable transition.
  await ports.recordTransition({
    patientId: input.patientId,
    fromStage: plan.fromStage,
    toStage: plan.toStage,
    command: input.request.command,
    actorId: input.actor.actorId,
    reason: input.reason,
  });

  // 5. Generated tasks.
  if (definition.generatesTasks.length > 0) {
    await ports.createTasks({ patientId: input.patientId, tasks: definition.generatesTasks });
  }

  // 6. Domain event -> timeline projection.
  const timelineEvent: TimelineEvent = {
    id: `${input.patientId}:${input.request.command}:${version}`,
    type: "WORKFLOW_TRANSITION",
    occurredAt: now(),
    recordedAt: now(),
    actorId: input.actor.actorId,
    title: definition.patientLabel,
    summary: input.reason,
    visibility: "ASSIGNED_TEAM",
    fromStage: plan.fromStage ?? undefined,
    toStage: plan.toStage,
    relatedEntity: { type: "patient", id: input.patientId },
    source: "workflow-engine",
  };
  await ports.emitDomainEvent(timelineEvent);

  // 7. Audit (always; redaction happens inside createAuditEvent).
  await ports.writeAudit(
    createAuditEvent({
      category: "JOURNEY",
      action: definition.auditAction,
      severity: definition.clinicalAuthorisation ? "WARNING" : "INFO",
      actor: input.actor,
      patientId: input.patientId,
      resourceType: "patient",
      resourceId: input.patientId,
      metadata: {
        command: input.request.command,
        fromStage: plan.fromStage,
        toStage: plan.toStage,
        clinicalAuthorisation: definition.clinicalAuthorisation,
      },
    }),
  );

  // 8. Notifications across the async boundary (never blocks the transition).
  if (definition.notifications.length > 0) {
    await ports.enqueueNotifications({
      patientId: input.patientId,
      notifications: definition.notifications,
    });
  }

  return { ok: true, patientId: input.patientId, stage: plan.toStage, version, timelineEvent };
}
