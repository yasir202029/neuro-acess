/**
 * DrizzleSliceStore — PostgreSQL-backed implementation of SliceStore.
 *
 * Each domain operation maps to a concrete table (migration 0009 plus the
 * 0010 slice-gap tables). Column mappings:
 * - profiles: displayName ↔ display_name (fallback full_name), roles ↔ roles
 *   jsonb (fallback [role]); email/phone are owned by the auth flow and are
 *   never clobbered here.
 * - patients carry no display name; it is read via the profile join.
 * - transcript_segments.segment_text holds the text; patient_id is resolved
 *   from the referral row.
 * - timeline discriminated-union payloads round-trip through event_data;
 *   audit events through the 0010 category/severity/patient/occurred columns.
 * - Timestamps cross the boundary as ISO strings in the domain and Date in
 *   the database; conversions live in toDate/toIso so no row leaks a Date.
 *
 * Errors mirror InMemorySliceStore (SliceError 404 on missing rows).
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  aiDraftsTable,
  auditLogsTable,
  bookmarksTable,
  clinicalNotesTable,
  consultationConsentsTable,
  consultationStatesTable,
  intakeSubmissionsTable,
  journeyStatesTable,
  journeyTransitionsTable,
  notificationsTable,
  patientsTable,
  profilesTable,
  referralsTable,
  sliceTasksTable,
  timelineEventsTable,
  transcriptSegmentsTable,
} from "@workspace/db";
import type { AuditEvent, AuditSeverity } from "@neurocare/audit";
import type { TimelineEvent as TimelineEventType } from "@neurocare/timeline";
import type { CareStage } from "@neurocare/journey";
import type {
  AiDraft as AiDraftType,
  Bookmark,
  ClinicalNote,
  ConsultationState,
  ConsentRecord,
  IntakeAnswers,
  IntakeSubmission,
  JourneySnapshot,
  NotificationRecord,
  PatientRecord,
  Pathway,
  ProfileRecord,
  Referral as ReferralType,
  ReferralSource,
  SliceTask,
  StoredTransition,
  TranscriptSegment as TsTranscriptSegment,
  ValidationStatus,
} from "./types";
import type { SliceStore } from "./store";
import { SliceError } from "./types";

/** Convert a domain ISO instant to a DB timestamp. */
function toDate(iso: string): Date {
  return new Date(iso);
}

/** Convert a DB timestamp to a domain ISO instant. */
function toIso(value: Date): string {
  return value.toISOString();
}

/** Nullable DB text → optional domain string. */
function opt(value: string | null): string | undefined {
  return value ?? undefined;
}

type DbClient = typeof db;

export class DrizzleSliceStore implements SliceStore {
  constructor(private readonly database: DbClient = db) {}

  /* ── Profiles / patients ── */

  async getProfile(id: string): Promise<ProfileRecord | undefined> {
    const [row] = await this.database
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, id));
    if (!row) return undefined;
    return {
      id: row.id,
      displayName: row.displayName ?? row.fullName,
      roles: row.roles ?? [row.role],
    };
  }

  async upsertProfile(profile: ProfileRecord): Promise<void> {
    // Never clobber auth-owned email/phone/fullName on conflict; the slice
    // owns only display_name and roles.
    await this.database
      .insert(profilesTable)
      .values({
        id: profile.id,
        fullName: profile.displayName,
        displayName: profile.displayName,
        role: profile.roles[0] ?? "PATIENT",
        roles: [...profile.roles],
      })
      .onConflictDoUpdate({
        target: profilesTable.id,
        set: {
          displayName: profile.displayName,
          role: profile.roles[0] ?? "PATIENT",
          roles: [...profile.roles],
        },
      });
  }

  async findPatientByProfile(
    profileId: string,
  ): Promise<PatientRecord | undefined> {
    const rows = await this.database
      .select({
        id: patientsTable.id,
        profileId: patientsTable.profileId,
        displayName: profilesTable.displayName,
        fullName: profilesTable.fullName,
      })
      .from(patientsTable)
      .innerJoin(profilesTable, eq(profilesTable.id, patientsTable.profileId))
      .where(eq(patientsTable.profileId, profileId))
      .limit(1);
    const [row] = rows;
    if (!row) return undefined;
    return {
      id: row.id,
      profileId: row.profileId,
      displayName: row.displayName ?? row.fullName,
    };
  }

  async createPatient(record: PatientRecord): Promise<PatientRecord> {
    // The profile is authoritative for the display name; the patient row
    // must not duplicate it. Ensure the profile exists first.
    const profile = await this.getProfile(record.profileId);
    if (!profile) {
      throw new SliceError(
        404,
        "PROFILE_NOT_FOUND",
        "Profile must exist before its patient record.",
      );
    }
    const [row] = await this.database
      .insert(patientsTable)
      .values({ id: record.id, profileId: record.profileId })
      .returning();
    return {
      id: row.id,
      profileId: row.profileId,
      displayName: profile.displayName,
    };
  }

  async getPatient(id: string): Promise<PatientRecord | undefined> {
    const rows = await this.database
      .select({
        id: patientsTable.id,
        profileId: patientsTable.profileId,
        displayName: profilesTable.displayName,
        fullName: profilesTable.fullName,
      })
      .from(patientsTable)
      .innerJoin(profilesTable, eq(profilesTable.id, patientsTable.profileId))
      .where(eq(patientsTable.id, id))
      .limit(1);
    const [row] = rows;
    if (!row) return undefined;
    return {
      id: row.id,
      profileId: row.profileId,
      displayName: row.displayName ?? row.fullName,
    };
  }

  /* ── Referrals ── */

  private static toReferral(row: typeof referralsTable.$inferSelect): ReferralType {
    return {
      id: row.id,
      patientId: row.patientId,
      pathway: row.pathway as Pathway,
      referralSource: row.referralSource as ReferralSource,
      presentingConcern: row.presentingConcern,
      validationStatus: row.validationStatus as ValidationStatus,
      validationNote: opt(row.validationNote),
      assignedClinicianProfileId: opt(row.assignedClinicianProfileId),
      appointmentId: opt(row.appointmentId),
      createdAt: toIso(row.createdAt),
    };
  }

  async createReferral(referral: ReferralType): Promise<ReferralType> {
    const [row] = await this.database
      .insert(referralsTable)
      .values({
        id: referral.id,
        patientId: referral.patientId,
        pathway: referral.pathway,
        referralSource: referral.referralSource,
        presentingConcern: referral.presentingConcern,
        validationStatus: referral.validationStatus,
        validationNote: referral.validationNote,
        assignedClinicianProfileId: referral.assignedClinicianProfileId,
        appointmentId: referral.appointmentId,
      })
      .returning();
    return DrizzleSliceStore.toReferral(row);
  }

  async getReferral(id: string): Promise<ReferralType | undefined> {
    const [row] = await this.database
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.id, id));
    if (!row) return undefined;
    return DrizzleSliceStore.toReferral(row);
  }

  async listReferrals(): Promise<ReferralType[]> {
    const rows = await this.database
      .select()
      .from(referralsTable)
      .orderBy(asc(referralsTable.createdAt));
    return rows.map(DrizzleSliceStore.toReferral);
  }

  async updateReferral(
    id: string,
    patch: Partial<Omit<ReferralType, "id">>,
  ): Promise<ReferralType> {
    const set: Record<string, unknown> = {};
    if (patch.patientId !== undefined) set.patientId = patch.patientId;
    if (patch.pathway !== undefined) set.pathway = patch.pathway;
    if (patch.referralSource !== undefined) set.referralSource = patch.referralSource;
    if (patch.presentingConcern !== undefined) set.presentingConcern = patch.presentingConcern;
    if (patch.validationStatus !== undefined) set.validationStatus = patch.validationStatus;
    if (patch.validationNote !== undefined) set.validationNote = patch.validationNote;
    if (patch.assignedClinicianProfileId !== undefined) {
      set.assignedClinicianProfileId = patch.assignedClinicianProfileId;
    }
    if (patch.appointmentId !== undefined) set.appointmentId = patch.appointmentId;
    const [row] = await this.database
      .update(referralsTable)
      .set(set)
      .where(eq(referralsTable.id, id))
      .returning();
    if (!row) {
      throw new SliceError(404, "NOT_FOUND", "Referral not found.");
    }
    return DrizzleSliceStore.toReferral(row);
  }

  /* ── Journey ── */

  private static toJourney(
    row: typeof journeyStatesTable.$inferSelect,
  ): JourneySnapshot {
    return {
      patientId: row.patientId,
      stage: row.stage as CareStage,
      version: row.version,
      hasAssignedClinician: row.hasAssignedClinician,
      hasIntakeCompleted: row.hasIntakeCompleted,
    };
  }

  async createJourney(patientId: string): Promise<JourneySnapshot> {
    // Idempotent: callers may recreate the journey (REQUEST_ASSESSMENT),
    // and concurrent recreates must not fail.
    await this.database
      .insert(journeyStatesTable)
      .values({
        id: randomUUID(),
        patientId,
        stage: "LEAD",
        version: 0,
        hasAssignedClinician: false,
        hasIntakeCompleted: false,
      })
      .onConflictDoNothing({ target: journeyStatesTable.patientId });
    const snapshot = await this.getJourney(patientId);
    if (!snapshot) {
      throw new SliceError(404, "NOT_FOUND", "Journey not found.");
    }
    return snapshot;
  }

  async getJourney(patientId: string): Promise<JourneySnapshot | undefined> {
    const [row] = await this.database
      .select()
      .from(journeyStatesTable)
      .where(eq(journeyStatesTable.patientId, patientId));
    if (!row) return undefined;
    return DrizzleSliceStore.toJourney(row);
  }

  async updateJourney(
    patientId: string,
    patch: Partial<
      Pick<JourneySnapshot, "stage" | "version" | "hasAssignedClinician" | "hasIntakeCompleted">
    >,
  ): Promise<JourneySnapshot> {
    const set: Record<string, unknown> = {};
    if (patch.stage !== undefined) set.stage = patch.stage;
    if (patch.version !== undefined) set.version = patch.version;
    if (patch.hasAssignedClinician !== undefined) {
      set.hasAssignedClinician = patch.hasAssignedClinician;
    }
    if (patch.hasIntakeCompleted !== undefined) {
      set.hasIntakeCompleted = patch.hasIntakeCompleted;
    }
    const [row] = await this.database
      .update(journeyStatesTable)
      .set(set)
      .where(eq(journeyStatesTable.patientId, patientId))
      .returning();
    if (!row) {
      throw new SliceError(404, "NOT_FOUND", "Journey not found.");
    }
    return DrizzleSliceStore.toJourney(row);
  }

  async recordTransition(input: {
    patientId: string;
    fromStage: string | null;
    toStage: string;
    command: string;
    actorId: string;
    reason?: string;
  }): Promise<void> {
    // Append-only: no updates, no deletes (matches migration 0009).
    await this.database.insert(journeyTransitionsTable).values({
      id: randomUUID(),
      patientId: input.patientId,
      fromStage: input.fromStage,
      toStage: input.toStage,
      command: input.command,
      actorProfileId: input.actorId,
      reason: input.reason,
    });
  }

  async listTransitions(patientId: string): Promise<StoredTransition[]> {
    const rows = await this.database
      .select()
      .from(journeyTransitionsTable)
      .where(eq(journeyTransitionsTable.patientId, patientId))
      .orderBy(asc(journeyTransitionsTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      fromStage: row.fromStage,
      toStage: row.toStage,
      command: row.command,
      actorId: row.actorProfileId,
      reason: opt(row.reason),
      createdAt: toIso(row.createdAt),
    }));
  }


  /* ── Intake (dedicated intake_submissions table) ── */

  private static toIntake(
    row: typeof intakeSubmissionsTable.$inferSelect,
  ): IntakeSubmission {
    return {
      id: row.id,
      referralId: row.referralId,
      patientId: row.patientId,
      answers: (row.answers ?? {}) as unknown as IntakeAnswers,
      questionnaireScores: (row.questionnaireScores ?? []) as unknown as IntakeSubmission["questionnaireScores"],
      documentKinds: (row.documentKinds ?? []) as unknown as string[],
      submittedAt: toIso(row.submittedAt),
    };
  }

  async saveIntake(intake: IntakeSubmission): Promise<IntakeSubmission> {
    await this.database
      .insert(intakeSubmissionsTable)
      .values({
        id: intake.id,
        referralId: intake.referralId,
        patientId: intake.patientId,
        answers: intake.answers as unknown as Record<string, unknown>,
        questionnaireScores: intake.questionnaireScores as unknown as Record<string, unknown>[],
        documentKinds: [...intake.documentKinds],
        submittedAt: toDate(intake.submittedAt),
      })
      .onConflictDoUpdate({
        target: intakeSubmissionsTable.referralId,
        set: {
          answers: intake.answers as unknown as Record<string, unknown>,
          questionnaireScores: intake.questionnaireScores as unknown as Record<string, unknown>[],
          documentKinds: [...intake.documentKinds],
          submittedAt: toDate(intake.submittedAt),
        },
      });
    return intake;
  }

  async getIntake(referralId: string): Promise<IntakeSubmission | undefined> {
    const [row] = await this.database
      .select()
      .from(intakeSubmissionsTable)
      .where(eq(intakeSubmissionsTable.referralId, referralId))
      .limit(1);
    if (!row) return undefined;
    return DrizzleSliceStore.toIntake(row);
  }

  /* ── Consultation (consent, transcript, bookmarks, state) ── */

  async createConsent(consent: ConsentRecord): Promise<ConsentRecord> {
    await this.database.insert(consultationConsentsTable).values({
      id: consent.id,
      referralId: consent.referralId,
      patientId: consent.patientId,
      wordingVersion: consent.wordingVersion,
      purpose: consent.purpose,
      consentingParty: consent.consentingParty,
      clinicianProfileId: consent.clinicianProfileId,
      restrictions: consent.restrictions,
      recordedAt: toDate(consent.recordedAt),
      withdrawnAt: consent.withdrawnAt ? toDate(consent.withdrawnAt) : null,
    });
    return consent;
  }

  async getActiveConsent(referralId: string): Promise<ConsentRecord | undefined> {
    // Active = the most recent consent that has not been withdrawn.
    const rows = await this.database
      .select()
      .from(consultationConsentsTable)
      .where(eq(consultationConsentsTable.referralId, referralId))
      .orderBy(asc(consultationConsentsTable.recordedAt));
    const active = rows.filter((row) => !row.withdrawnAt).at(-1);
    if (!active) return undefined;
    return {
      id: active.id,
      referralId: active.referralId,
      patientId: active.patientId,
      wordingVersion: active.wordingVersion,
      purpose: active.purpose,
      consentingParty: active.consentingParty as ConsentRecord["consentingParty"],
      clinicianProfileId: active.clinicianProfileId,
      restrictions: opt(active.restrictions),
      recordedAt: toIso(active.recordedAt),
      withdrawnAt: active.withdrawnAt ? toIso(active.withdrawnAt) : undefined,
    };
  }

  async addSegments(
    referralId: string,
    segments: readonly TsTranscriptSegment[],
  ): Promise<void> {
    if (segments.length === 0) return;
    // patientId is resolved from the referral row (segments join via referral).
    const referral = await this.getReferral(referralId);
    if (!referral) {
      throw new SliceError(404, "NOT_FOUND", "Referral not found.");
    }
    await this.database.insert(transcriptSegmentsTable).values(
      segments.map((s) => ({
        id: s.id,
        patientId: referral.patientId,
        referralId,
        speaker: s.speaker,
        startMs: s.startMs,
        endMs: s.endMs,
        segmentText: s.text,
        excluded: s.excluded,
      })),
    );
  }

  async listSegments(referralId: string): Promise<TsTranscriptSegment[]> {
    const rows = await this.database
      .select()
      .from(transcriptSegmentsTable)
      .where(eq(transcriptSegmentsTable.referralId, referralId))
      .orderBy(asc(transcriptSegmentsTable.startMs));
    return rows.map((row) => ({
      id: row.id,
      speaker: row.speaker as TsTranscriptSegment["speaker"],
      startMs: row.startMs,
      endMs: row.endMs,
      text: row.segmentText,
      excluded: row.excluded,
    }));
  }

  async addBookmark(referralId: string, bookmark: Bookmark): Promise<Bookmark> {
    await this.database.insert(bookmarksTable).values({
      id: bookmark.id,
      referralId,
      segmentId: bookmark.segmentId,
      label: bookmark.label,
      createdAt: toDate(bookmark.createdAt),
    });
    return bookmark;
  }

  async listBookmarks(referralId: string): Promise<Bookmark[]> {
    const rows = await this.database
      .select()
      .from(bookmarksTable)
      .where(eq(bookmarksTable.referralId, referralId))
      .orderBy(asc(bookmarksTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      segmentId: row.segmentId,
      label: row.label,
      createdAt: toIso(row.createdAt),
    }));
  }

  async getConsultationState(referralId: string): Promise<ConsultationState> {
    const [row] = await this.database
      .select()
      .from(consultationStatesTable)
      .where(eq(consultationStatesTable.referralId, referralId))
      .limit(1);
    return (row?.state as ConsultationState | undefined) ?? "NOT_STARTED";
  }

  async setConsultationState(
    referralId: string,
    state: ConsultationState,
  ): Promise<void> {
    await this.database
      .insert(consultationStatesTable)
      .values({ referralId, state })
      .onConflictDoUpdate({
        target: consultationStatesTable.referralId,
        set: { state, updatedAt: new Date() },
      });
  }

  /* ── AI drafts ── */

  private static toDraft(row: typeof aiDraftsTable.$inferSelect): AiDraftType {
    return {
      id: row.id,
      referralId: row.referralId,
      patientId: row.patientId,
      status: row.status as AiDraftType["status"],
      statements: (row.statements ?? []) as unknown as AiDraftType["statements"],
      missingInformation: (row.missingInformation ?? []) as readonly string[],
      conflicts: (row.conflicts ?? []) as unknown as AiDraftType["conflicts"],
      safetyFindings: (row.safetyFindings ?? []) as unknown as AiDraftType["safetyFindings"],
      version: row.version,
      createdByProfileId: row.createdByProfileId,
      signedNoteId: opt(row.signedNoteId),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  async createDraft(draft: AiDraftType): Promise<AiDraftType> {
    const [row] = await this.database
      .insert(aiDraftsTable)
      .values({
        id: draft.id,
        referralId: draft.referralId,
        patientId: draft.patientId,
        status: draft.status,
        statements: draft.statements as unknown as Record<string, unknown>[],
        missingInformation: [...draft.missingInformation],
        conflicts: draft.conflicts as unknown as Record<string, unknown>[],
        safetyFindings: draft.safetyFindings as unknown as Record<string, unknown>[],
        version: draft.version,
        createdByProfileId: draft.createdByProfileId,
        signedNoteId: draft.signedNoteId,
        createdAt: toDate(draft.createdAt),
        updatedAt: toDate(draft.updatedAt),
      })
      .returning();
    return DrizzleSliceStore.toDraft(row);
  }

  async getDraft(id: string): Promise<AiDraftType | undefined> {
    const [row] = await this.database
      .select()
      .from(aiDraftsTable)
      .where(eq(aiDraftsTable.id, id))
      .limit(1);
    if (!row) return undefined;
    return DrizzleSliceStore.toDraft(row);
  }

  async updateDraft(id: string, patch: Partial<AiDraftType>): Promise<AiDraftType> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.statements !== undefined) set.statements = patch.statements;
    if (patch.missingInformation !== undefined) set.missingInformation = patch.missingInformation;
    if (patch.conflicts !== undefined) set.conflicts = patch.conflicts;
    if (patch.safetyFindings !== undefined) set.safetyFindings = patch.safetyFindings;
    if (patch.version !== undefined) set.version = patch.version;
    if (patch.signedNoteId !== undefined) set.signedNoteId = patch.signedNoteId;
    const [row] = await this.database
      .update(aiDraftsTable)
      .set(set)
      .where(eq(aiDraftsTable.id, id))
      .returning();
    if (!row) {
      throw new SliceError(404, "NOT_FOUND", "Draft not found.");
    }
    return DrizzleSliceStore.toDraft(row);
  }

  /* ── Clinical notes ── */

  async createNote(note: ClinicalNote): Promise<ClinicalNote> {
    await this.database.insert(clinicalNotesTable).values({
      id: note.id,
      patientId: note.patientId,
      authorProfileId: note.authorProfileId,
      noteType: "ASSESSMENT",
      body: note.body,
      referralId: note.referralId,
      draftId: note.draftId,
      version: note.version,
      signedAt: toDate(note.signedAt),
      occurredAt: toDate(note.signedAt),
    });
    return note;
  }

  async getSignedNote(referralId: string): Promise<ClinicalNote | undefined> {
    // The signed assessment note for this referral (latest signed version).
    const [row] = await this.database
      .select()
      .from(clinicalNotesTable)
      .where(
        and(
          eq(clinicalNotesTable.referralId, referralId),
          eq(clinicalNotesTable.noteType, "ASSESSMENT"),
        ),
      )
      .orderBy(desc(clinicalNotesTable.version))
      .limit(1);
    if (!row) return undefined;
    return {
      id: row.id,
      referralId: row.referralId ?? referralId,
      patientId: row.patientId,
      authorProfileId: row.authorProfileId,
      draftId: row.draftId ?? "",
      body: row.body,
      version: row.version ?? 1,
      signedAt: row.signedAt ? toIso(row.signedAt) : toIso(row.updatedAt),
    };
  }

  /* ── Tasks ── */

  async createTasks(tasks: readonly SliceTask[]): Promise<void> {
    if (tasks.length === 0) return;
    await this.database
      .insert(sliceTasksTable)
      .values(
        tasks.map((t) => ({
          id: t.id,
          patientId: t.patientId,
          type: t.type,
          title: t.title,
          assigneeRole: t.assigneeRole,
          status: t.status,
          createdAt: toDate(t.createdAt),
        })),
      )
      .onConflictDoNothing();
  }

  async listOpenTasks(patientId: string): Promise<SliceTask[]> {
    const rows = await this.database
      .select()
      .from(sliceTasksTable)
      .where(and(eq(sliceTasksTable.patientId, patientId), eq(sliceTasksTable.status, "OPEN")))
      .orderBy(asc(sliceTasksTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      type: row.type,
      title: row.title,
      assigneeRole: opt(row.assigneeRole),
      status: row.status as SliceTask["status"],
      createdAt: toIso(row.createdAt),
    }));
  }

  async completeTasks(
    patientId: string,
    types: readonly string[],
  ): Promise<void> {
    if (types.length === 0) return;
    await this.database
      .update(sliceTasksTable)
      .set({ status: "DONE" })
      .where(
        and(
          eq(sliceTasksTable.patientId, patientId),
          eq(sliceTasksTable.status, "OPEN"),
          inArray(sliceTasksTable.type, [...types]),
        ),
      );
  }

  /* ── Timeline ── */

  async appendTimeline(event: TimelineEventType): Promise<void> {
    // TimelineEvent carries patientId through relatedEntity for most kinds;
    // the id convention `${patientId}:${TYPE}:${ref}` preserves ownership for
    // workflow events, matching the in-memory listing contract.
    await this.database.insert(timelineEventsTable).values({
      id: event.id,
      patientId: event.relatedEntity?.id ?? event.id.split(":")[0],
      eventType: event.type,
      occurredAt: toDate(event.occurredAt),
      recordedAt: toDate(event.recordedAt),
      actorProfileId: event.actorId,
      title: event.title,
      summary: event.summary,
      visibility: event.visibility,
      relatedType: event.relatedEntity?.type,
      relatedId: event.relatedEntity?.id,
      source: event.source,
      eventData: event as unknown as Record<string, unknown>,
    });
  }

  async listTimeline(patientId: string): Promise<TimelineEventType[]> {
    const rows = await this.database
      .select()
      .from(timelineEventsTable)
      .where(eq(timelineEventsTable.patientId, patientId))
      .orderBy(asc(timelineEventsTable.recordedAt));
    return rows.map((row) => {
      const payload = (row.eventData ?? {}) as Record<string, unknown>;
      return {
        ...(payload as unknown as TimelineEventType),
        id: row.id,
        title: row.title,
        occurredAt: toIso(row.occurredAt),
        recordedAt: toIso(row.recordedAt),
        source: row.source,
      };
    });
  }

  /* ── Audit ── */

  async appendAudit(event: AuditEvent): Promise<void> {
    // AuditEvent carries no id; the row id is minted here and stays stable.
    await this.database.insert(auditLogsTable).values({
      id: randomUUID(),
      actorProfileId: event.actor.actorId,
      action: event.action,
      resourceType: event.resourceType ?? "CLINICAL",
      resourceId: event.resourceId,
      metadata: event.metadata ?? {},
      category: event.category,
      severity: event.severity,
      actorRoles: [...event.actor.roles],
      patientId: event.patientId,
      occurredAt: event.occurredAt ? toDate(event.occurredAt) : new Date(),
    });
  }

  async listAudit(): Promise<AuditEvent[]> {
    const rows = await this.database
      .select()
      .from(auditLogsTable)
      .orderBy(asc(auditLogsTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      category: (row.category ?? "ADMIN") as AuditEvent["category"],
      action: row.action,
      severity: (row.severity ?? "INFO") as AuditSeverity,
      actor: { actorId: row.actorProfileId ?? "system", roles: row.actorRoles ?? [] },
      patientId: opt(row.patientId),
      resourceType: opt(row.resourceType),
      resourceId: opt(row.resourceId),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      occurredAt: row.occurredAt ? toIso(row.occurredAt) : toIso(row.createdAt),
    }));
  }

  /* ── Notifications (dedicated notifications table) ── */

  async enqueueNotification(record: NotificationRecord): Promise<void> {
    await this.database.insert(notificationsTable).values({
      id: record.id,
      patientId: record.patientId,
      audience: record.audience,
      channel: record.channel,
      template: record.template,
      createdAt: toDate(record.createdAt),
    });
  }

  async listNotifications(patientId: string): Promise<NotificationRecord[]> {
    const rows = await this.database
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.patientId, patientId))
      .orderBy(asc(notificationsTable.createdAt));
    return rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      audience: row.audience,
      channel: row.channel,
      template: row.template,
      createdAt: toIso(row.createdAt),
    }));
  }
}

export const drizzleStore = new DrizzleSliceStore(db);
