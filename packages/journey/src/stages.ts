/**
 * Canonical care stages for NeuroCare OS.
 *
 * This is the single vocabulary every workspace speaks. The patient sees a
 * plain-language label; the clinician/admin/finance workspaces see the same
 * canonical stage with richer affordances. The persisted value in the database
 * is always one of these stages (see `persistence.ts` for the Prisma mapping).
 */
export const careStages = [
  "LEAD", // referral received, not yet booked
  "BOOKED", // first appointment scheduled
  "TRIAGE", // admin triage / assignment
  "ASSESSMENT", // active assessment (intake, questionnaires, appointment)
  "DIAGNOSIS", // assessment outcome recorded
  "MORE_INFORMATION_REQUIRED", // blocked pending extra evidence
  "ECG_REQUESTED", // blocked pending physical-health / ECG
  "TITRATION", // medication titration under way
  "PRESCRIBING", // stable prescribing loop
  "MAINTENANCE", // stable treatment, periodic monitoring
  "SHARED_CARE", // shared-care with GP in progress
  "ANNUAL_REVIEW", // annual review in progress
  "OUTCOME", // episode closed with an outcome
  "DISCHARGE", // patient discharged
  "DIAGNOSIS_NOT_CONFIRMED", // assessment did not confirm a diagnosis
] as const;

export type CareStage = (typeof careStages)[number];

const stageSet: ReadonlySet<string> = new Set(careStages);

export function isCareStage(value: unknown): value is CareStage {
  return typeof value === "string" && stageSet.has(value);
}

/** True for stages where the patient is in an active, forward-moving episode. */
export function isActiveEpisodeStage(stage: CareStage): boolean {
  return stage !== "OUTCOME" && stage !== "DISCHARGE";
}
