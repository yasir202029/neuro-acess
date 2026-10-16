/**
 * Slice 1 service — the referral → assessment use cases.
 *
 * Every method: actor is server-derived upstream → verify capability
 * (deny-by-default) → verify record access (cross-patient isolation) →
 * validate state → run the typed journey transition (optimistic concurrency)
 * → record effects (tasks, timeline, audit, notifications). The service never
 * trusts an input stage; only commands change stages.
 */
import { randomUUID } from "node:crypto";
import {
  authorise,
  isPlatformRole,
  type Capability,
  type CapabilityGrants,
  type PlatformRole,
} from "@neurocare/permissions";
import { runTransition } from "@neurocare/workflow-engine";
import type {
  CareStage,
  TransitionRejection,
  TransitionRequest,
} from "@neurocare/journey";
import { createAuditEvent } from "@neurocare/audit";
import {
  filterTimelineForViewer,
  type TimelineEvent,
  type ViewerClearance,
} from "@neurocare/timeline";
import {
  SliceError,
  type AiDraft,
  type Bookmark,
  type ConsultationState,
  type DraftConflict,
  type DraftStatement,
  type IntakeAnswers,
  type JourneySnapshot,
  type Pathway,
  type PatientRecord,
  type Referral,
  type ReferralSource,
  type SliceActor,
  type TranscriptSegment,
} from "./types";
import { createWorkflowPorts, type SliceStore } from "./store";
import {
  evaluateApprovability,
  generateAssessmentDraft,
  renderDraftBody,
  scanForInstructions,
  scanStatements,
} from "./clinical-ai";

function grantsFor(actor: SliceActor): CapabilityGrants {
  const roles = actor.roles.filter((role): role is PlatformRole =>
    isPlatformRole(role),
  );
  if (roles.length === 0)
    throw new SliceError(
      403,
      "NO_ROLE",
      "No authorised platform role is assigned.",
    );
  return { roles };
}

/** Deny-by-default capability guard; returns grants for reuse by the engine. */
function requireCapability(
  actor: SliceActor,
  capability: Capability,
): CapabilityGrants {
  const grants = grantsFor(actor);
  const decision = authorise(grants, [capability]);
  if (!decision.allowed) {
    throw new SliceError(
      403,
      "FORBIDDEN",
      "You are not permitted to perform this action.",
      {
        reason: decision.reason,
        missing: decision.missing,
      },
    );
  }
  return grants;
}

function clearanceFor(actor: SliceActor): ViewerClearance {
  if (actor.roles.includes("SUPER_ADMIN")) return { kind: "RESTRICTED" };
  if (actor.roles.includes("FINANCE")) return { kind: "FINANCE" };
  if (actor.roles.includes("CLINICIAN")) return { kind: "ASSIGNED_TEAM" };
  if (
    actor.roles.includes("ADMIN") ||
    actor.roles.includes("RECEPTIONIST") ||
    actor.roles.includes("SUPPORT_AGENT")
  ) {
    return { kind: "ADMIN" };
  }
  if (actor.roles.includes("PATIENT")) return { kind: "PATIENT" };
  throw new SliceError(
    403,
    "FORBIDDEN",
    "This role has no timeline clearance.",
  );
}

/** Plain-language status per care stage (patient-facing; no internal terms). */
const STAGE_GUIDANCE: Record<
  CareStage,
  { readonly plainStatus: string; readonly nextAction: string }
> = {
  LEAD: {
    plainStatus: "We received your request for an assessment.",
    nextAction:
      "Our team will review your request — nothing needed from you yet.",
  },
  BOOKED: {
    plainStatus: "Your first appointment is booked.",
    nextAction: "We will confirm the details with you shortly.",
  },
  TRIAGE: {
    plainStatus: "Your case is being prepared for your clinician.",
    nextAction: "Nothing needed from you right now.",
  },
  INTAKE: {
    plainStatus: "Please complete your intake information.",
    nextAction:
      "Complete your questionnaire and upload the requested documents.",
  },
  ASSESSMENT: {
    plainStatus: "Your assessment is in progress.",
    nextAction: "Attend your assessment appointment.",
  },
  MORE_INFORMATION_REQUIRED: {
    plainStatus: "We need a little more information from you.",
    nextAction: "Please send the information we asked for.",
  },
  DIAGNOSIS_REVIEW: {
    plainStatus: "Your assessment outcome is being finalised.",
    nextAction: "Nothing needed from you right now.",
  },
  DIAGNOSIS_CONFIRMED: {
    plainStatus: "Your assessment outcome has been recorded.",
    nextAction: "We will share your report when it is ready.",
  },
  DIAGNOSIS_NOT_CONFIRMED: {
    plainStatus: "Your assessment outcome has been recorded.",
    nextAction: "We will explain the outcome at your feedback appointment.",
  },
  ECG_REQUESTED: {
    plainStatus: "We have requested some health checks before medication.",
    nextAction: "Please complete the requested health checks.",
  },
  MDT_REVIEW: {
    plainStatus: "Your case is being reviewed by our clinical team.",
    nextAction: "Nothing needed from you right now.",
  },
  TITRATION: {
    plainStatus: "Your treatment review is underway.",
    nextAction: "Submit your monitoring readings as requested.",
  },
  PRESCRIBING: {
    plainStatus: "Your prescribing has started.",
    nextAction: "Follow the plan your clinician shared.",
  },
  MAINTENANCE: {
    plainStatus: "Your treatment is stable — welcome to maintenance.",
    nextAction: "Keep up your monitoring and reviews.",
  },
  SHARED_CARE: {
    plainStatus: "We are setting up shared care with your GP.",
    nextAction: "We may ask you to confirm details with your GP.",
  },
  ANNUAL_REVIEW: {
    plainStatus: "It is time for your annual review.",
    nextAction: "Complete your review questionnaire.",
  },
  OUTCOME: {
    plainStatus: "Your episode of care has been completed.",
    nextAction: "Your reports remain available to you.",
  },
  DISCHARGE: {
    plainStatus: "You have been discharged back to your GP.",
    nextAction: "Contact us if you need support again.",
  },
};

function rejectionMessage(rejection: TransitionRejection): string {
  switch (rejection.kind) {
    case "UNKNOWN_COMMAND":
      return "Unknown workflow command.";
    case "INVALID_SOURCE_STAGE":
      return `This action is not available from the current stage (${rejection.currentStage}).`;
    case "BLOCKED":
      return `Prerequisites are not met: ${rejection.conditions.join(", ")}.`;
    case "VERSION_CONFLICT":
      return "The record changed while you were working. Reload and try again.";
    case "FORBIDDEN":
      return "You are not permitted to perform this workflow action.";
  }
}

export class SliceService {
  constructor(private readonly store: SliceStore) {}

  // --- internal helpers ---------------------------------------------------

  private async requireReferral(referralId: string): Promise<Referral> {
    const referral = await this.store.getReferral(referralId);
    if (!referral)
      throw new SliceError(404, "NOT_FOUND", "Referral not found.");
    return referral;
  }

  private async requireJourney(patientId: string): Promise<JourneySnapshot> {
    const journey = await this.store.getJourney(patientId);
    if (!journey) throw new SliceError(404, "NOT_FOUND", "Journey not found.");
    return journey;
  }

  private async transition(
    actor: SliceActor,
    patientId: string,
    request: TransitionRequest,
    reason?: string,
  ): Promise<JourneySnapshot> {
    const grants = grantsFor(actor);
    const result = await runTransition(createWorkflowPorts(this.store), {
      patientId,
      request,
      actor,
      grants,
      reason,
    });
    if (!result.ok) {
      throw new SliceError(
        409,
        "JOURNEY_REJECTED",
        rejectionMessage(result.rejection),
        result.rejection,
      );
    }
    return this.requireJourney(patientId);
  }

  /**
   * Own-record access for the acting patient; staff need `patient:read`.
   * A purely-PATIENT caller may only read their own record — `patient:read`
   * alone never grants cross-patient reads (otherwise any patient could read
   * any other patient's status/timeline).
   */
  private async assertOwnOrStaff(
    actor: SliceActor,
    patientId: string,
  ): Promise<PatientRecord> {
    const patient = await this.store.getPatient(patientId);
    if (!patient)
      throw new SliceError(404, "NOT_FOUND", "Patient record not found.");
    if (patient.profileId === actor.actorId) return patient;
    const isStaff = actor.roles.some((role) => role !== "PATIENT");
    if (!isStaff) {
      throw new SliceError(
        403,
        "CROSS_PATIENT_DENIED",
        "You may only view your own record.",
      );
    }
    requireCapability(actor, "patient:read");
    return patient;
  }

  /** Strict ownership — used where only the patient may act (e.g. intake). */
  private async assertOwnRecord(actor: SliceActor, patientId: string): Promise<PatientRecord> {
    const patient = await this.store.getPatient(patientId);
    if (!patient)
      throw new SliceError(404, "NOT_FOUND", "Patient record not found.");
    if (patient.profileId !== actor.actorId) {
      throw new SliceError(
        403,
        "CROSS_PATIENT_DENIED",
        "You may only act on your own record.",
      );
    }
    return patient;
  }

  private async audit(
    actor: SliceActor,
    patientId: string,
    action: string,
    resourceId: string,
    category: "CLINICAL" | "ADMIN" = "CLINICAL",
    metadata?: Record<string, unknown>,
  ) {
    await this.store.appendAudit(
      createAuditEvent({
        category,
        action,
        severity: "INFO",
        actor,
        patientId,
        resourceType: "referral",
        resourceId,
        metadata,
      }),
    );
  }

  // --- referral lifecycle ---------------------------------------------------

  async requestAssessment(
    actor: SliceActor,
    input: {
      pathway: Pathway;
      referralSource: ReferralSource;
      presentingConcern: string;
      displayName: string;
    },
  ): Promise<{ referral: Referral; journey: JourneySnapshot }> {
    requireCapability(actor, "patient:write");
    let patient = await this.store.findPatientByProfile(actor.actorId);
    if (!patient) {
      await this.store.upsertProfile({
        id: actor.actorId,
        displayName: input.displayName,
        roles: actor.roles,
      });
      patient = await this.store.createPatient({
        id: randomUUID(),
        profileId: actor.actorId,
        displayName: input.displayName,
      });
    }
    const patientRecord: PatientRecord = patient;
    const existing = this.store
      .listReferrals()
      .find((referral) => referral.patientId === patientRecord.id);
    if (existing) {
      throw new SliceError(
        409,
        "REFERRAL_EXISTS",
        "An assessment request already exists for this record.",
      );
    }
    await this.store.createJourney(patientRecord.id);
    const journey = await this.transition(actor, patientRecord.id, {
      command: "REQUEST_ASSESSMENT",
      payload: {
        referralSource: input.referralSource,
        presentingConcern: input.presentingConcern,
        requestedPathway: input.pathway,
      },
    });
    const referral = await this.store.createReferral({
      id: randomUUID(),
      patientId: patientRecord.id,
      pathway: input.pathway,
      referralSource: input.referralSource,
      presentingConcern: input.presentingConcern,
      validationStatus: "PENDING_VALIDATION",
      createdAt: new Date().toISOString(),
    });
    this.audit(
      actor,
      patientRecord.id,
      "referral.created",
      referral.id,
      "CLINICAL",
      { pathway: input.pathway },
    );
    return { referral, journey };
  }

  listReferrals(actor: SliceActor) {
    requireCapability(actor, "assessment:read");
    return (await this.store.listReferrals()).map((referral) => ({
      referral,
      journey: await this.store.getJourney(referral.patientId),
      patientDisplayName:
        await this.store.getPatient(referral.patientId)?.displayName ?? "Unknown",
    }));
  }

  validateReferral(
    actor: SliceActor,
    referralId: string,
    input: { status: "VALIDATED" | "MISSING_INFORMATION"; note?: string },
  ): Referral {
    requireCapability(actor, "clinic:manage");
    const referral = await this.requireReferral(referralId);
    if (
      input.status !== "VALIDATED" &&
      input.status !== "MISSING_INFORMATION"
    ) {
      throw new SliceError(
        400,
        "VALIDATION_ERROR",
        "Validation status must be VALIDATED or MISSING_INFORMATION.",
      );
    }
    const updated = await this.store.updateReferral(referralId, {
      validationStatus: input.status,
      validationNote: input.note,
    });
    this.audit(
      actor,
      referral.patientId,
      `referral.validation.${input.status}`,
      referralId,
      "ADMIN",
    );
    return updated;
  }

  async bookFirstAppointment(
    actor: SliceActor,
    referralId: string,
    input: { scheduledFor: string },
  ): Promise<JourneySnapshot> {
    requireCapability(actor, "appointment:manage");
    const referral = await this.requireReferral(referralId);
    // Patients may only book their OWN appointment (permission matrix: "own").
    if (!actor.roles.some((role) => role !== "PATIENT")) {
      this.assertOwnRecord(actor, referral.patientId);
    }
    const appointmentId = randomUUID();
    const journey = await this.transition(actor, referral.patientId, {
      command: "BOOK_APPOINTMENT",
      payload: { appointmentId, scheduledFor: input.scheduledFor },
    });
    await this.store.updateReferral(referralId, { appointmentId });
    this.audit(
      actor,
      referral.patientId,
      "referral.appointment.booked",
      referralId,
      "ADMIN",
      { appointmentId },
    );
    return journey;
  }

  async assignClinician(
    actor: SliceActor,
    referralId: string,
    clinicianProfileId: string,
  ): Promise<JourneySnapshot> {
    requireCapability(actor, "user:manage");
    const referral = await this.requireReferral(referralId);
    const clinician = await this.store.getProfile(clinicianProfileId);
    if (!clinician || !clinician.roles.includes("CLINICIAN")) {
      throw new SliceError(
        400,
        "UNKNOWN_CLINICIAN",
        "The selected clinician is not available.",
      );
    }
    const journey = await this.transition(actor, referral.patientId, {
      command: "TRIAGE_CASE",
      payload: { assignedClinicianId: clinicianProfileId },
    });
    await this.store.updateReferral(referralId, {
      assignedClinicianProfileId: clinicianProfileId,
    });
    await this.store.updateJourney(referral.patientId, {
      hasAssignedClinician: true,
    });
    this.audit(
      actor,
      referral.patientId,
      "referral.clinician.assigned",
      referralId,
      "ADMIN",
      { clinicianProfileId },
    );
    return journey;
  }

  async startIntake(
    actor: SliceActor,
    referralId: string,
  ): Promise<JourneySnapshot> {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    const journey = await this.transition(actor, referral.patientId, {
      command: "START_INTAKE",
      payload: { reason: "Clinician opened the intake step" },
    });
    this.audit(
      actor,
      referral.patientId,
      "referral.intake.started",
      referralId,
    );
    return journey;
  }

  submitIntake(
    actor: SliceActor,
    referralId: string,
    input: {
      answers: IntakeAnswers;
      questionnaireScores: readonly { instrument: string; score: number }[];
      documentKinds: readonly string[];
    },
  ) {
    requireCapability(actor, "patient:write");
    const referral = await this.requireReferral(referralId);
    this.assertOwnRecord(actor, referral.patientId);
    const journey = await this.requireJourney(referral.patientId);
    if (journey.stage !== "TRIAGE" && journey.stage !== "INTAKE") {
      throw new SliceError(
        409,
        "INVALID_STAGE",
        "Intake cannot be submitted at this stage of the journey.",
      );
    }
    const intake = await this.store.saveIntake({
      id: randomUUID(),
      referralId,
      patientId: referral.patientId,
      answers: input.answers,
      questionnaireScores: input.questionnaireScores,
      documentKinds: input.documentKinds,
      submittedAt: new Date().toISOString(),
    });
    await this.store.updateJourney(referral.patientId, { hasIntakeCompleted: true });
    await this.store.completeTasks(referral.patientId, ["INTAKE"]);
    this.audit(
      actor,
      referral.patientId,
      "intake.submitted",
      referralId,
      "CLINICAL",
      {
        questionnaires: input.questionnaireScores.length,
        documents: input.documentKinds.length,
      },
    );
    return intake;
  }

  async startAssessment(
    actor: SliceActor,
    referralId: string,
  ): Promise<JourneySnapshot> {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    const journey = await this.transition(actor, referral.patientId, {
      command: "START_ASSESSMENT",
      payload: { reason: "Assessment consultation beginning" },
    });
    this.audit(
      actor,
      referral.patientId,
      "referral.assessment.started",
      referralId,
    );
    return journey;
  }

  // --- consultation: consent, transcript, bookmarks --------------------------

  recordConsent(
    actor: SliceActor,
    referralId: string,
    input: {
      wordingVersion: string;
      purpose: string;
      consentingParty: "PATIENT" | "PROXY";
      restrictions?: string;
    },
  ) {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    const journey = await this.requireJourney(referral.patientId);
    if (journey.stage !== "ASSESSMENT") {
      throw new SliceError(
        409,
        "INVALID_STAGE",
        "Consent is recorded during the assessment consultation.",
      );
    }
    if (await this.store.getActiveConsent(referralId)) {
      throw new SliceError(
        409,
        "CONSENT_EXISTS",
        "Consent has already been recorded for this consultation.",
      );
    }
    const consent = await this.store.createConsent({
      id: randomUUID(),
      referralId,
      patientId: referral.patientId,
      wordingVersion: input.wordingVersion,
      purpose: input.purpose,
      consentingParty: input.consentingParty,
      clinicianProfileId: actor.actorId,
      restrictions: input.restrictions,
      recordedAt: new Date().toISOString(),
    });
    await this.store.setConsultationState(referralId, "READY");
    this.audit(
      actor,
      referral.patientId,
      "consultation.consent.recorded",
      referralId,
      "CLINICAL",
      {
        wordingVersion: input.wordingVersion,
        consentingParty: input.consentingParty,
      },
    );
    return consent;
  }

  ingestTranscript(
    actor: SliceActor,
    referralId: string,
    segments: readonly Omit<TranscriptSegment, "id">[],
  ): { segments: readonly TranscriptSegment[]; state: ConsultationState } {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    if (!await this.store.getActiveConsent(referralId)) {
      throw new SliceError(
        409,
        "CONSENT_MISSING",
        "Recording requires recorded consent for this consultation.",
      );
    }
    const stored: TranscriptSegment[] = segments.map((segment) => ({
      id: randomUUID(),
      ...segment,
    }));
    await this.store.addSegments(referralId, stored);
    await this.store.setConsultationState(referralId, "DRAFT_READY");
    this.audit(
      actor,
      referral.patientId,
      "consultation.transcript.processed",
      referralId,
      "CLINICAL",
      {
        segments: stored.length,
      },
    );
    return {
      segments: stored,
      state: await this.store.getConsultationState(referralId),
    };
  }

  addBookmark(
    actor: SliceActor,
    referralId: string,
    input: { segmentId: string; label: string },
  ): Bookmark {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    const segment = this.store
      .listSegments(referralId)
      .find((item) => item.id === input.segmentId);
    if (!segment)
      throw new SliceError(404, "NOT_FOUND", "Transcript segment not found.");
    const bookmark = await this.store.addBookmark(referralId, {
      id: randomUUID(),
      segmentId: input.segmentId,
      label: input.label,
      createdAt: new Date().toISOString(),
    });
    this.audit(
      actor,
      referral.patientId,
      "consultation.bookmark.added",
      referralId,
    );
    return bookmark;
  }

  // --- AI drafting and human review ------------------------------------------

  generateDraft(actor: SliceActor, referralId: string): AiDraft {
    requireCapability(actor, "ai:use");
    const referral = await this.requireReferral(referralId);
    if (!await this.store.getActiveConsent(referralId)) {
      throw new SliceError(
        409,
        "CONSENT_MISSING",
        "AI drafting requires recorded consent for this consultation.",
      );
    }
    const segments = this.store
      .listSegments(referralId)
      .filter((segment) => !segment.excluded);
    if (segments.length === 0) {
      throw new SliceError(
        409,
        "NO_TRANSCRIPT",
        "There is no transcript content to draft from.",
      );
    }
    const output = generateAssessmentDraft({
      referral,
      segments,
      intake: await this.store.getIntake(referralId),
    });
    const now = new Date().toISOString();
    const draft = await this.store.createDraft({
      id: randomUUID(),
      referralId,
      patientId: referral.patientId,
      status: "AI_DRAFT_REQUIRES_CLINICIAN_REVIEW",
      statements: output.statements,
      missingInformation: output.missingInformation,
      conflicts: output.conflicts,
      safetyFindings: output.safetyFindings,
      version: 1,
      createdByProfileId: actor.actorId,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.setConsultationState(referralId, "CLINICIAN_REVIEW");
    this.audit(
      actor,
      referral.patientId,
      "ai.draft.generated",
      draft.id,
      "CLINICAL",
      {
        statementCount: output.statements.length,
        missingCount: output.missingInformation.length,
        conflictCount: output.conflicts.length,
        safetyCount: output.safetyFindings.length,
      },
    );
    return draft;
  }

  amendDraft(
    actor: SliceActor,
    draftId: string,
    edits: readonly { statementId: string; text: string }[],
  ): AiDraft {
    requireCapability(actor, "clinical:write");
    const draft = await this.store.getDraft(draftId);
    if (!draft) throw new SliceError(404, "NOT_FOUND", "Draft not found.");
    if (draft.status === "APPROVED") {
      throw new SliceError(
        409,
        "DRAFT_SIGNED",
        "A signed note cannot be edited; create an amendment instead.",
      );
    }
    const byId = new Map(draft.statements.map((item) => [item.id, item]));
    for (const edit of edits) {
      if (!byId.has(edit.statementId)) {
        throw new SliceError(
          404,
          "NOT_FOUND",
          "Statement not found in this draft.",
        );
      }
    }
    const statements: DraftStatement[] = draft.statements.map(
      (item): DraftStatement => {
        const edit = edits.find(
          (candidate) => candidate.statementId === item.id,
        );
        if (!edit) return item;
        return {
          ...item,
          text: edit.text,
          // An edit makes the clinician the author of this statement; provenance
          // stays visible and source refs are preserved where they still apply.
          classification: "CLINICIAN_ENTERED",
        };
      },
    );
    const segments = this.store
      .listSegments(draft.referralId)
      .filter((segment) => !segment.excluded);
    const updated = await this.store.updateDraft(draftId, {
      statements,
      status: "AMENDED",
      version: draft.version + 1,
      updatedAt: new Date().toISOString(),
      safetyFindings: [
        ...scanForInstructions(segments),
        ...scanStatements(statements),
      ],
    });
    this.audit(
      actor,
      draft.patientId,
      "ai.draft.amended",
      draftId,
      "CLINICAL",
      { edits: edits.length },
    );
    return updated;
  }

  resolveConflict(
    actor: SliceActor,
    draftId: string,
    conflictId: string,
    resolution: "ACCEPTED_AS_IS" | "RESOLVED",
  ): AiDraft {
    requireCapability(actor, "clinical:write");
    const draft = await this.store.getDraft(draftId);
    if (!draft) throw new SliceError(404, "NOT_FOUND", "Draft not found.");
    if (draft.status === "APPROVED") {
      throw new SliceError(
        409,
        "DRAFT_SIGNED",
        "A signed note's conflicts are frozen; amend instead.",
      );
    }
    const conflicts: DraftConflict[] = draft.conflicts.map((conflict) =>
      conflict.id === conflictId
        ? { ...conflict, resolution, resolvedBy: actor.actorId }
        : conflict,
    );
    if (!draft.conflicts.some((conflict) => conflict.id === conflictId)) {
      throw new SliceError(
        404,
        "NOT_FOUND",
        "Conflict not found in this draft.",
      );
    }
    const updated = await this.store.updateDraft(draftId, {
      conflicts,
      version: draft.version + 1,
      updatedAt: new Date().toISOString(),
    });
    this.audit(
      actor,
      draft.patientId,
      "ai.draft.conflict_reviewed",
      draftId,
      "CLINICAL",
      { conflictId, resolution },
    );
    return updated;
  }

  approveDraft(
    actor: SliceActor,
    draftId: string,
  ): { draft: AiDraft; noteId: string } {
    requireCapability(actor, "clinical:write");
    const draft = await this.store.getDraft(draftId);
    if (!draft) throw new SliceError(404, "NOT_FOUND", "Draft not found.");
    if (draft.status === "APPROVED") {
      throw new SliceError(
        409,
        "DRAFT_SIGNED",
        "This draft has already been signed.",
      );
    }
    const gate = evaluateApprovability(draft);
    if (!gate.approvable) {
      throw new SliceError(
        422,
        "UNSUPPORTED_STATEMENTS",
        "The note cannot be signed while unsupported statements or unresolved conflicts remain.",
        {
          unsupportedStatementIds: gate.unsupportedStatementIds,
          unresolvedConflictIds: gate.unresolvedConflictIds,
        },
      );
    }
    const signedAt = new Date().toISOString();
    const note = await this.store.createNote({
      id: randomUUID(),
      referralId: draft.referralId,
      patientId: draft.patientId,
      authorProfileId: actor.actorId,
      draftId: draft.id,
      body: renderDraftBody(draft),
      version: draft.version,
      signedAt,
    });
    const approved = await this.store.updateDraft(draftId, {
      status: "APPROVED",
      signedNoteId: note.id,
      updatedAt: signedAt,
    });
    await this.store.setConsultationState(draft.referralId, "SIGNED");
    await this.store.appendAudit(
      createAuditEvent({
        category: "CLINICAL",
        action: "clinical.note.signed",
        severity: "WARNING",
        actor,
        patientId: draft.patientId,
        resourceType: "clinical_note",
        resourceId: note.id,
        metadata: { draftId: draft.id, version: draft.version },
      }),
    );
    await this.store.appendTimeline({
      id: `${draft.patientId}:NOTE:${note.id}`,
      type: "CLINICAL_NOTE",
      occurredAt: signedAt,
      recordedAt: signedAt,
      actorId: actor.actorId,
      title: "Assessment note signed",
      visibility: "ASSIGNED_TEAM",
      relatedEntity: { type: "patient", id: draft.patientId },
      noteId: note.id,
      source: "slice1",
    } satisfies TimelineEvent);
    return { draft: approved, noteId: note.id };
  }

  // --- outcome and reads ------------------------------------------------------

  async recordOutcome(
    actor: SliceActor,
    referralId: string,
    input: {
      outcome: "CONFIRMED" | "NOT_CONFIRMED" | "PARTIAL";
      diagnosisSummary?: string;
    },
  ): Promise<JourneySnapshot> {
    requireCapability(actor, "clinical:write");
    const referral = await this.requireReferral(referralId);
    if (!await this.store.getSignedNote(referralId)) {
      throw new SliceError(
        409,
        "SIGNED_NOTE_REQUIRED",
        "The assessment outcome requires a signed clinical note first.",
      );
    }
    const journey = await this.transition(actor, referral.patientId, {
      command: "RECORD_ASSESSMENT_OUTCOME",
      payload: {
        outcome: input.outcome,
        diagnosisSummary: input.diagnosisSummary,
      },
    });
    await this.store.completeTasks(referral.patientId, ["PENDING_NOTE"]);
    this.audit(
      actor,
      referral.patientId,
      "referral.outcome.recorded",
      referralId,
      "CLINICAL",
      {
        outcome: input.outcome,
      },
    );
    return journey;
  }

  async getPatientStatus(actor: SliceActor, patientId: string) {
    this.assertOwnOrStaff(actor, patientId);
    const journey = await this.requireJourney(patientId);
    const guidance = STAGE_GUIDANCE[journey.stage];
    const openTasks = (await this.store.listOpenTasks(patientId)).map((task) => ({ type: task.type, title: task.title }));
    return {
      patientId,
      stage: journey.stage,
      plainStatus: guidance.plainStatus,
      nextAction: guidance.nextAction,
      openTasks,
      updatedAt: new Date().toISOString(),
    };
  }

  async getTimeline(actor: SliceActor, patientId: string): Promise<TimelineEvent[]> {
    this.assertOwnOrStaff(actor, patientId);
    const clearance = clearanceFor(actor);
    return filterTimelineForViewer(
      await this.store.listTimeline(patientId),
      clearance,
    );
  }

  async getAudit(actor: SliceActor): Promise<AuditEvent[]> {
    requireCapability(actor, "audit:read");
    return await this.store.listAudit();
  }

  async getReferralWorkup(actor: SliceActor, referralId: string) {
    requireCapability(actor, "assessment:read");
    const referral = await this.requireReferral(referralId);
    const journey = await this.requireJourney(referral.patientId);
    return {
      referral,
      journey,
      intake: await this.store.getIntake(referralId),
      consent: await this.store.getActiveConsent(referralId),
      consultationState: await this.store.getConsultationState(referralId),
      segments: await this.store.listSegments(referralId),
      bookmarks: await this.store.listBookmarks(referralId),
      signedNote: await this.store.getSignedNote(referralId),
      openTasks: await this.store.listOpenTasks(referral.patientId),
    };
  }
}
