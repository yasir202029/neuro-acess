import { authorise, type CapabilityGrants } from "@neurocare/permissions";
import type { CareStage } from "./stages.js";
import { isCareStage } from "./stages.js";
import { transitionTable } from "./transitions.js";
import type { JourneyFacts, BlockingCondition, TransitionDefinition } from "./transitions.js";
import type { RecordTitrationReviewPayload, TransitionRequest } from "./types.js";

/** Why a transition was rejected. Discriminated so callers can map to UI copy. */
export type TransitionRejection =
  | { readonly kind: "UNKNOWN_COMMAND" }
  | { readonly kind: "INVALID_SOURCE_STAGE"; readonly currentStage: CareStage; readonly allowedFrom: readonly CareStage[] }
  | { readonly kind: "BLOCKED"; readonly conditions: readonly BlockingCondition[] }
  | { readonly kind: "VERSION_CONFLICT"; readonly expectedVersion: number; readonly actualVersion: number }
  | { readonly kind: "FORBIDDEN"; readonly missing: readonly string[] };

/** The fully-resolved plan for a transition. Pure data — no side effects. */
export interface TransitionPlan {
  readonly command: TransitionRequest["command"];
  readonly fromStage: CareStage | null;
  readonly toStage: CareStage;
  readonly stageChanged: boolean;
  readonly definition: TransitionDefinition;
}

export type TransitionResult =
  | { readonly ok: true; readonly plan: TransitionPlan }
  | { readonly ok: false; readonly rejection: TransitionRejection };

function evaluateBlockers(facts: JourneyFacts, conditions: readonly BlockingCondition[]): BlockingCondition[] {
  const unmet: BlockingCondition[] = [];
  for (const condition of conditions) {
    switch (condition) {
      case "REQUIRES_ASSIGNED_CLINICIAN":
        if (!facts.hasAssignedClinician) unmet.push(condition);
        break;
      case "REQUIRES_INTAKE_COMPLETED":
        if (!facts.hasIntakeCompleted) unmet.push(condition);
        break;
      case "REQUIRES_NO_OPEN_BLOCKERS":
        if (facts.openTaskTypes.length > 0) unmet.push(condition);
        break;
      default: {
        // Exhaustiveness guard: adding a BlockingCondition without handling it is a compile error.
        const _exhaustive: never = condition;
        return [_exhaustive];
      }
    }
  }
  return unmet;
}

/**
 * Resolve the destination stage for commands whose target depends on payload.
 * Only RECORD_TITRATION_REVIEW is dynamic: advancing keeps TITRATION, otherwise
 * it progresses to PRESCRIBING. All other commands use the static table value.
 */
function resolveTargetStage(
  definition: TransitionDefinition,
  request: TransitionRequest,
): CareStage {
  if (request.command === "RECORD_TITRATION_REVIEW") {
    const payload = request.payload as RecordTitrationReviewPayload;
    return payload.advance ? "TITRATION" : "PRESCRIBING";
  }
  // `to` is non-null for every stage-changing command; MDT has `to: null` and is
  // handled by callers as a side-effect-only transition (stage unchanged).
  return definition.to ?? (definition.from?.[0] as CareStage);
}

export interface PlanTransitionInput {
  readonly request: TransitionRequest;
  readonly facts: JourneyFacts;
  readonly grants: CapabilityGrants;
  /** Optimistic-concurrency token the caller believes is current. */
  readonly expectedVersion: number;
}

/**
 * Pure transition planner. Validates permission, source stage, blocking
 * conditions, and optimistic concurrency, then returns a resolved plan. The
 * workflow-engine is responsible for applying the plan inside a transaction.
 */
export function planTransition(input: PlanTransitionInput): TransitionResult {
  const { request, facts, grants, expectedVersion } = input;
  const definition = transitionTable[request.command];
  if (!definition) return { ok: false, rejection: { kind: "UNKNOWN_COMMAND" } };

  // 1. Permission (deny-by-default).
  const decision = authorise(grants, [definition.capability]);
  if (!decision.allowed) {
    return { ok: false, rejection: { kind: "FORBIDDEN", missing: decision.missing } };
  }

  // 2. Optimistic concurrency.
  if (expectedVersion !== facts.version) {
    return {
      ok: false,
      rejection: { kind: "VERSION_CONFLICT", expectedVersion, actualVersion: facts.version },
    };
  }

  // 3. Source-stage validation (null `from` = entry command, always allowed).
  if (definition.from !== null && !definition.from.includes(facts.currentStage)) {
    return {
      ok: false,
      rejection: { kind: "INVALID_SOURCE_STAGE", currentStage: facts.currentStage, allowedFrom: definition.from },
    };
  }

  // 4. Blocking conditions.
  const unmet = evaluateBlockers(facts, definition.blocking);
  if (unmet.length > 0) return { ok: false, rejection: { kind: "BLOCKED", conditions: unmet } };

  const toStage = resolveTargetStage(definition, request);
  const stageChanged = definition.to !== null && toStage !== facts.currentStage;

  return {
    ok: true,
    plan: {
      command: request.command,
      fromStage: facts.currentStage,
      toStage,
      stageChanged,
      definition,
    },
  };
}

/** Commands a subject is permitted to attempt from a given stage (for UI affordances). */
export function availableCommands(
  facts: JourneyFacts,
  grants: CapabilityGrants,
): TransitionRequest["command"][] {
  return (Object.keys(transitionTable) as TransitionRequest["command"][]).filter((command) => {
    const definition = transitionTable[command];
    if (!authorise(grants, [definition.capability]).allowed) return false;
    if (definition.from === null) return false; // entry command, not a workflow action
    return definition.from.includes(facts.currentStage);
  });
}

/** Guard used by persistence mapping and API validation. */
export function assertCareStage(value: unknown): CareStage {
  if (!isCareStage(value)) throw new Error(`Unknown care stage: ${String(value)}`);
  return value;
}
