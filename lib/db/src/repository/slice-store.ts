// @ts-nocheck
/**
 * SliceStore implementation backed by Drizzle/PostgreSQL.
 * All methods are async. Callers must await each call.
 */

import { eq, and, desc, asc, ilike, or, sql, inArray } from "drizzle-orm";
import { db } from "../index.js";
import {
  profilesTable,
  patientsTable,
  referralsTable,
  journeyStatesTable,
  journeyTransitionsTable,
  consultationConsentsTable,
  transcriptSegmentsTable,
  aiDraftsTable,
  clinicalNotesTable,
  sliceTasksTable,
  notificationsTable,
  intakeSubmissionsTable,
  consultationStatesTable,
  bookmarksTable,
  timelineEventsTable,
  auditLogsTable,
  type InsertProfile,
  type InsertPatient,
  type InsertReferral,
  type InsertJourneyState,
  type InsertJourneyTransition,
  type InsertTimelineEvent,
  type InsertAuditLog,
  type InsertIntakeSubmission,
  type InsertConsultationState,
  type InsertBookmark,
  type InsertSliceTask,
  type InsertNotification,
} from "../schema/neuroassess.js";

export interface ProfileRecord { id: string; displayName: string; roles: string[]; }
export interface PatientRecord { id: string; profileId: string; displayName: string; }
export interface Referral { id: string; patientId: string; pathway: "ADHD" | "AUTISM" | "BOTH"; referralSource: "SELF" | "GP" | "OTHER"; presentingConcern: string; validationStatus: "PENDING_VALIDATION" | "MISSING_INFORMATION" | "VALIDATED"; validationNote?: string; assignedClinicianProfileId?: string | null; appointmentId?: string | null; createdAt: string; }
export interface JourneySnapshot { patientId: string; stage: string; version: number; hasAssignedClinician: boolean; hasIntakeCompleted: boolean; updatedAt: string; }
export interface StoredTransition { id: string; patientId: string; fromStage: string | null; toStage: string; command: string; actorId: string; reason?: string; createdAt: string; }
export interface ConsentRecord { id: string; referralId: string; patientId: string; wordingVersion: string; purpose: string; consentingParty: "PATIENT" | "PROXY"; clinicianProfileId: string; restrictions?: string | null; recordedAt: string; withdrawnAt?: string | null; }
export interface TranscriptSegment { id: string; patientId: string; referralId: string; speaker: "CLINICIAN" | "PATIENT"; startMs: number; endMs: number; text: string; excluded: boolean; }
export interface AiDraft { id: string; referralId: string; patientId: string; status: "AI_DRAFT_REQUIRES_CLINICIAN_REVIEW" | "AMENDED" | "APPROVED" | "REJECTED"; statements: unknown[]; missingInformation: unknown[]; conflicts: unknown[]; safetyFindings: unknown[]; version: number; createdByProfileId: string; createdAt: string; updatedAt: string; }
export interface ClinicalNote { id: string; patientId: string; authorProfileId: string; draftId: string | null; body: string; version: number; signedAt: string | null; createdAt: string; updatedAt: string; }
export interface SliceTask { id: string; patientId: string; type: string; title: string; assigneeRole?: string | null; status: "open" | "done"; createdAt: string; }
export interface NotificationRecord { id: string; patientId: string; audience: string; channel: string; template: string; createdAt: string; }
export interface IntakeSubmission { id: string; referralId: string; patientId: string; answers: Record<string, unknown>; questionnaireScores: { instrument: string; score: number }[]; documentKinds: string[]; submittedAt: string; createdAt: string; }
export interface ConsultationState { referralId: string; state: string; updatedAt: string; }
export interface Bookmark { id: string; referralId: string; segmentId: string; label: string; createdAt: string; }
export interface TimelineEvent { id: string; patientId: string; actorId: string | undefined; type: string; description: string; visibility: string; relatedEntity?: { type: string; id: string }; source: string; occurredAt: string; }
export interface AuditEvent { id: string; actor: { actorId: string; roles: string[] }; action: string; resourceType: string; resourceId?: string | null; metadata?: Record<string, unknown>; occurredAt: string; }

export class DrizzleSliceStore {
  async getProfile(id: string): Promise<ProfileRecord | undefined> {
    const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    if (!row) return undefined;
    return toProfileRecord(row);
  }
  async upsertProfile(profile: ProfileRecord): Promise<void> {
    await db.insert(profilesTable).values({ id: profile.id, fullName: profile.displayName, roles: profile.roles.join(",") } as any).onConflictDoUpdate({ target: profilesTable.id, set: { fullName: profile.displayName, roles: profile.roles.join(","), updatedAt: new Date() } });
  }
  async findPatientByProfile(profileId: string): Promise<PatientRecord | undefined> {
    const [row] = await db.select().from(patientsTable).where(eq(patientsTable.profileId, profileId)).limit(1);
    if (!row) return undefined;
    return toPatientRecord(row);
  }
  async createPatient(record: PatientRecord): Promise<PatientRecord> {
    const [row] = await db.insert(patientsTable).values({ id: record.id, profileId: record.profileId } as any).returning();
    return toPatientRecord(row);
  }
  async getPatient(id: string): Promise<PatientRecord | undefined> {
    const [row] = await db.select().from(patientsTable).where(eq(patientsTable.id, id)).limit(1);
    if (!row) return undefined;
    return toPatientRecord(row);
  }
  async createReferral(referral: Referral): Promise<Referral> {
    const [row] = await db.insert(referralsTable).values({ id: referral.id, patientId: referral.patientId, pathway: referral.pathway, referralSource: referral.referralSource, presentingConcern: referral.presentingConcern, validationStatus: referral.validationStatus, validationNote: referral.validationNote, assignedClinicianProfileId: referral.assignedClinicianProfileId, appointmentId: referral.appointmentId } as any).returning();
    return toReferral(row);
  }
  async getReferral(id: string): Promise<Referral | undefined> {
    const [row] = await db.select().from(referralsTable).where(eq(referralsTable.id, id)).limit(1);
    if (!row) return undefined;
    return toReferral(row);
  }
  async listReferrals(): Promise<Referral[]> {
    const rows = await db.select().from(referralsTable);
    return rows.map(toReferral);
  }
  async updateReferral(id: string, patch: Partial<Omit<Referral, "id">>): Promise<Referral> {
    const [row] = await db.update(referralsTable).set({ pathway: patch.pathway, referralSource: patch.referralSource, presentingConcern: patch.presentingConcern, validationStatus: patch.validationStatus, validationNote: patch.validationNote, assignedClinicianProfileId: patch.assignedClinicianProfileId, appointmentId: patch.appointmentId, updatedAt: new Date() }).where(eq(referralsTable.id, id)).returning();
    if (!row) throw new Error("Referral " + id + " not found");
    return toReferral(row);
  }
  async createJourney(patientId: string): Promise<JourneySnapshot> {
    const [row] = await db.insert(journeyStatesTable).values({ patientId, stage: "REFERRAL", version: 1, hasAssignedClinician: false, hasIntakeCompleted: false } as any).returning();
    return toJourneySnapshot(row);
  }
  async getJourney(patientId: string): Promise<JourneySnapshot | undefined> {
    const [row] = await db.select().from(journeyStatesTable).where(eq(journeyStatesTable.patientId, patientId)).limit(1);
    if (!row) return undefined;
    return toJourneySnapshot(row);
  }
  async updateJourney(patientId: string, patch: Partial<Pick<JourneySnapshot, "stage" | "version" | "hasAssignedClinician" | "hasIntakeCompleted">>): Promise<JourneySnapshot> {
    const [row] = await db.update(journeyStatesTable).set({ ...(patch.stage !== undefined && { stage: patch.stage }), ...(patch.version !== undefined && { version: patch.version }), ...(patch.hasAssignedClinician !== undefined && { hasAssignedClinician: patch.hasAssignedClinician }), ...(patch.hasIntakeCompleted !== undefined && { hasIntakeCompleted: patch.hasIntakeCompleted }), updatedAt: new Date() }).where(eq(journeyStatesTable.patientId, patientId)).returning();
    if (!row) throw new Error("Journey for patient " + patientId + " not found");
    return toJourneySnapshot(row);
  }
  async recordTransition(input: { patientId: string; fromStage: string | null; toStage: string; command: string; actorId: string; reason?: string }): Promise<void> {
    await db.insert(journeyTransitionsTable).values({ patientId: input.patientId, fromStage: input.fromStage, toStage: input.toStage, command: input.command, actorProfileId: input.actorId, reason: input.reason } as any);
  }
  async listTransitions(patientId: string): Promise<StoredTransition[]> {
    const rows = await db.select().from(journeyTransitionsTable).where(eq(journeyTransitionsTable.patientId, patientId)).orderBy(asc(journeyTransitionsTable.createdAt));
    return rows.map(toStoredTransition);
  }
  async saveIntake(intake: IntakeSubmission): Promise<IntakeSubmission> {
    const [row] = await db.insert(intakeSubmissionsTable).values({ id: intake.id, referralId: intake.referralId, patientId: intake.patientId, answers: intake.answers, questionnaireScores: intake.questionnaireScores, documentKinds: intake.documentKinds, submittedAt: new Date(intake.submittedAt) } as any).returning();
    return toIntakeSubmission(row);
  }
  async getIntake(referralId: string): Promise<IntakeSubmission | undefined> {
    const [row] = await db.select().from(intakeSubmissionsTable).where(eq(intakeSubmissionsTable.referralId, referralId)).orderBy(desc(intakeSubmissionsTable.createdAt)).limit(1);
    if (!row) return undefined;
    return toIntakeSubmission(row);
  }
  async createConsent(consent: ConsentRecord): Promise<ConsentRecord> {
    const [row] = await db.insert(consultationConsentsTable).values({ id: consent.id, referralId: consent.referralId, patientId: consent.patientId, wordingVersion: consent.wordingVersion, purpose: consent.purpose, consentingParty: consent.consentingParty, clinicianProfileId: consent.clinicianProfileId, restrictions: consent.restrictions, recordedAt: new Date(consent.recordedAt), withdrawnAt: consent.withdrawnAt ? new Date(consent.withdrawnAt) : null }).returning();
    return toConsentRecord(row);
  }
  async getActiveConsent(referralId: string): Promise<ConsentRecord | undefined> {
    const [row] = await db.select().from(consultationConsentsTable).where(eq(consultationConsentsTable.referralId, referralId)).orderBy(desc(consultationConsentsTable.recordedAt)).limit(1);
    if (!row) return undefined;
    return toConsentRecord(row);
  }
  async addSegments(referralId: string, segments: readonly TranscriptSegment[]): Promise<void> {
    await db.insert(transcriptSegmentsTable).values(segments.map((segment) => ({ id: segment.id, patientId: segment.patientId, referralId, speaker: segment.speaker, startMs: segment.startMs, endMs: segment.endMs, segmentText: segment.text, excluded: segment.excluded })));
  }
  async listSegments(referralId: string): Promise<TranscriptSegment[]> {
    const rows = await db.select().from(transcriptSegmentsTable).where(eq(transcriptSegmentsTable.referralId, referralId)).orderBy(asc(transcriptSegmentsTable.startMs));
    return rows.map(toTranscriptSegment);
  }
  async addBookmark(referralId: string, bookmark: Bookmark): Promise<Bookmark> {
    const [row] = await db.insert(bookmarksTable).values({ id: bookmark.id, referralId, segmentId: bookmark.segmentId, label: bookmark.label }).returning();
    return toBookmark(row);
  }
  async listBookmarks(referralId: string): Promise<Bookmark[]> {
    const rows = await db.select().from(bookmarksTable).where(eq(bookmarksTable.referralId, referralId)).orderBy(asc(bookmarksTable.createdAt));
    return rows.map(toBookmark);
  }
  async getConsultationState(referralId: string): Promise<{ referralId: string; state: string; updatedAt: string }> {
    const [row] = await db.select().from(consultationStatesTable).where(eq(consultationStatesTable.referralId, referralId)).limit(1);
    if (!row) return { referralId, state: "NOT_STARTED", updatedAt: new Date().toISOString() };
    return toConsultationState(row);
  }
  async setConsultationState(referralId: string, state: string): Promise<void> {
    const existing = await db.select().from(consultationStatesTable).where(eq(consultationStatesTable.referralId, referralId)).limit(1);
    if (existing.length > 0) {
      await db.update(consultationStatesTable).set({ state, updatedAt: new Date() }).where(eq(consultationStatesTable.referralId, referralId));
    } else {
      await db.insert(consultationStatesTable).values({ referralId, state, updatedAt: new Date() } as any);
    }
  }
  async createDraft(draft: AiDraft): Promise<AiDraft> {
    const [row] = await db.insert(aiDraftsTable).values({ id: draft.id, referralId: draft.referralId, patientId: draft.patientId, status: draft.status, statements: draft.statements, missingInformation: draft.missingInformation, conflicts: draft.conflicts, safetyFindings: draft.safetyFindings, version: draft.version, createdByProfileId: draft.createdByProfileId } as any).returning();
    return toAiDraft(row);
  }
  async getDraft(id: string): Promise<AiDraft | undefined> {
    const [row] = await db.select().from(aiDraftsTable).where(eq(aiDraftsTable.id, id)).limit(1);
    if (!row) return undefined;
    return toAiDraft(row);
  }
  async updateDraft(id: string, patch: Partial<AiDraft>): Promise<AiDraft> {
    const [row] = await db.update(aiDraftsTable).set({ ...(patch.status !== undefined && { status: patch.status }), ...(patch.statements !== undefined && { statements: patch.statements }), ...(patch.missingInformation !== undefined && { missingInformation: patch.missingInformation }), ...(patch.conflicts !== undefined && { conflicts: patch.conflicts }), ...(patch.safetyFindings !== undefined && { safetyFindings: patch.safetyFindings }), ...(patch.version !== undefined && { version: patch.version }), updatedAt: new Date() }).where(eq(aiDraftsTable.id, id)).returning();
    if (!row) throw new Error("Draft " + id + " not found");
    return toAiDraft(row);
  }
  async createNote(note: ClinicalNote): Promise<ClinicalNote> {
    const [row] = await db.insert(clinicalNotesTable).values({ id: note.id, patientId: note.patientId, authorProfileId: note.authorProfileId, draftId: note.draftId, body: note.body, version: note.version, signedAt: note.signedAt ? new Date(note.signedAt) : null }).returning();
    return toClinicalNote(row);
  }
  async getSignedNote(referralId: string): Promise<ClinicalNote | undefined> {
    const [row] = await db.select().from(clinicalNotesTable).where(eq(clinicalNotesTable.referralId, referralId)).orderBy(desc(clinicalNotesTable.createdAt)).limit(1);
    if (!row) return undefined;
    return toClinicalNote(row);
  }
  async createTasks(tasks: readonly SliceTask[]): Promise<void> {
    await db.insert(sliceTasksTable).values(tasks.map((t) => ({ id: t.id, patientId: t.patientId, type: t.type, title: t.title, assigneeRole: t.assigneeRole, status: t.status } as any)));
  }
  async listOpenTasks(patientId: string): Promise<SliceTask[]> {
    const rows = await db.select().from(sliceTasksTable).where(and(eq(sliceTasksTable.patientId, patientId), eq(sliceTasksTable.status, "open"))).orderBy(asc(sliceTasksTable.createdAt));
    return rows.map(toSliceTask);
  }
  async completeTasks(patientId: string, types: readonly string[]): Promise<void> {
    if (types.length === 0) return;
    await db.update(sliceTasksTable).set({ status: "done", updatedAt: new Date() }).where(and(eq(sliceTasksTable.patientId, patientId), inArray(sliceTasksTable.type, types)));
  }
  async appendTimeline(event: TimelineEvent): Promise<void> {
    await db.insert(timelineEventsTable).values({ id: event.id, patientId: event.patientId, actorProfileId: event.actorId, eventType: event.type, description: event.description, visibility: event.visibility, relatedType: event.relatedEntity?.type, relatedId: event.relatedEntity?.id, source: event.source, occurredAt: new Date(event.occurredAt) } as any);
  }
  async listTimeline(patientId: string): Promise<TimelineEvent[]> {
    const rows = await db.select().from(timelineEventsTable).where(eq(timelineEventsTable.patientId, patientId)).orderBy(asc(timelineEventsTable.occurredAt));
    return rows.map(toTimelineEvent);
  }
  async appendAudit(event: AuditEvent): Promise<void> {
    await db.insert(auditLogsTable).values({ id: event.id, actorProfileId: event.actor.actorId, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, metadata: event.metadata, createdAt: new Date(event.occurredAt) } as any);
  }
  async listAudit(): Promise<AuditEvent[]> {
    const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt));
    return rows.map(toAuditEvent);
  }
  async enqueueNotification(record: NotificationRecord): Promise<void> {
    await db.insert(notificationsTable).values({ id: record.id, patientId: record.patientId, audience: record.audience, channel: record.channel, template: record.template });
  }
  async listNotifications(patientId: string): Promise<NotificationRecord[]> {
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.patientId, patientId)).orderBy(desc(notificationsTable.createdAt));
    return rows.map(toNotificationRecord);
  }
}

function toProfileRecord(row: { id: string; fullName: string; roles: string }): ProfileRecord { return { id: row.id, displayName: row.fullName, roles: row.roles ? (row.roles.split(",") as string[]) : [] }; }
function toPatientRecord(row: { id: string; profileId: string; displayName?: string }): PatientRecord { return { id: row.id, profileId: row.profileId, displayName: row.displayName || row.profileId }; }
function toReferral(row: { id: string; patientId: string; pathway: string; referralSource: string; presentingConcern: string; validationStatus: string; validationNote?: string | null; assignedClinicianProfileId?: string | null; appointmentId?: string | null; createdAt: Date }): Referral { return { id: row.id, patientId: row.patientId, pathway: row.pathway as "ADHD" | "AUTISM" | "BOTH", referralSource: row.referralSource as "SELF" | "GP" | "OTHER", presentingConcern: row.presentingConcern, validationStatus: row.validationStatus as "PENDING_VALIDATION" | "MISSING_INFORMATION" | "VALIDATED", validationNote: row.validationNote ?? undefined, assignedClinicianProfileId: row.assignedClinicianProfileId ?? undefined, appointmentId: row.appointmentId ?? undefined, createdAt: row.createdAt.toISOString() }; }
function toJourneySnapshot(row: { id: string; patientId: string; stage: string; version: number; hasAssignedClinician: boolean; hasIntakeCompleted: boolean; updatedAt: Date }): JourneySnapshot { return { patientId: row.patientId, stage: row.stage as string, version: row.version, hasAssignedClinician: row.hasAssignedClinician, hasIntakeCompleted: row.hasIntakeCompleted, updatedAt: row.updatedAt.toISOString() }; }
function toStoredTransition(row: { id: string; patientId: string; fromStage: string | null; toStage: string; command: string; actorProfileId: string; reason?: string | null; createdAt: Date }): StoredTransition { return { id: row.id, patientId: row.patientId, fromStage: row.fromStage ?? null, toStage: row.toStage, command: row.command, actorId: row.actorProfileId, reason: row.reason ?? undefined, createdAt: row.createdAt.toISOString() }; }
function toConsentRecord(row: { id: string; referralId: string; patientId: string; wordingVersion: string; purpose: string; consentingParty: string; clinicianProfileId: string; restrictions?: string | null; recordedAt: Date; withdrawnAt?: Date | null }): ConsentRecord { return { id: row.id, referralId: row.referralId, patientId: row.patientId, wordingVersion: row.wordingVersion, purpose: row.purpose, consentingParty: row.consentingParty as "PATIENT" | "PROXY", clinicianProfileId: row.clinicianProfileId, restrictions: row.restrictions ?? undefined, recordedAt: row.recordedAt.toISOString(), withdrawnAt: row.withdrawnAt?.toISOString() }; }
function toTranscriptSegment(row: { id: string; patientId: string; referralId: string; speaker: string; startMs: number; endMs: number; segmentText: string; excluded: boolean; createdAt: Date }): TranscriptSegment { return { id: row.id, speaker: row.speaker as "CLINICIAN" | "PATIENT", startMs: row.startMs, endMs: row.endMs, text: row.segmentText, excluded: row.excluded }; }
function toAiDraft(row: { id: string; referralId: string; patientId: string; status: string; statements: unknown; missingInformation: unknown; conflicts: unknown; safetyFindings: unknown; version: number; createdByProfileId: string; createdAt: Date; updatedAt: Date }): AiDraft { return { id: row.id, referralId: row.referralId, patientId: row.patientId, status: row.status as "AI_DRAFT_REQUIRES_CLINICIAN_REVIEW" | "AMENDED" | "APPROVED" | "REJECTED", statements: (row.statements as unknown[]) || [], missingInformation: (row.missingInformation as unknown[]) || [], conflicts: (row.conflicts as unknown[]) || [], safetyFindings: (row.safetyFindings as unknown[]) || [], version: row.version, createdByProfileId: row.createdByProfileId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function toClinicalNote(row: { id: string; patientId: string; authorProfileId: string; draftId: string | null; body: string; version: number; signedAt?: Date | null; createdAt: Date; updatedAt: Date }): ClinicalNote { return { id: row.id, patientId: row.patientId, authorProfileId: row.authorProfileId, draftId: row.draftId ?? undefined, body: row.body, version: row.version, signedAt: row.signedAt?.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function toSliceTask(row: { id: string; patientId: string; type: string; title: string; assigneeRole?: string | null; status: string; createdAt: Date }): SliceTask { return { id: row.id, patientId: row.patientId, type: row.type, title: row.title, assigneeRole: row.assigneeRole ?? undefined, status: row.status as "open" | "done", createdAt: row.createdAt.toISOString() }; }
function toNotificationRecord(row: { id: string; patientId: string; audience: string; channel: string; template: string; createdAt: Date }): NotificationRecord { return { id: row.id, patientId: row.patientId, audience: row.audience, channel: row.channel, template: row.template, createdAt: row.createdAt.toISOString() }; }
function toIntakeSubmission(row: { id: string; referralId: string; patientId: string; answers: unknown; questionnaireScores: unknown; documentKinds: unknown; submittedAt: Date; createdAt: Date }): IntakeSubmission { return { id: row.id, referralId: row.referralId, patientId: row.patientId, answers: (row.answers as Record<string, unknown>) || {}, questionnaireScores: (row.questionnaireScores as { instrument: string; score: number }[] | []) || [], documentKinds: (row.documentKinds as string[]) || [], submittedAt: row.submittedAt.toISOString(), createdAt: row.createdAt.toISOString() }; }
function toConsultationState(row: { referralId: string; state: string; updatedAt: Date }): ConsultationState { return { referralId: row.referralId, state: row.state, updatedAt: row.updatedAt.toISOString() }; }
function toBookmark(row: { id: string; referralId: string; segmentId: string; label: string; createdAt: Date }): Bookmark { return { id: row.id, referralId: row.referralId, segmentId: row.segmentId, label: row.label, createdAt: row.createdAt.toISOString() }; }
function toTimelineEvent(row: { id: string; patientId: string; actorProfileId?: string | null; eventType: string; description: string; visibility: string; relatedType?: string | null; relatedId?: string | null; source: string; occurredAt: Date }): TimelineEvent { return { id: row.id, patientId: row.patientId, actorId: row.actorProfileId ?? undefined, type: row.eventType as string, description: row.description, visibility: row.visibility as string, relatedEntity: row.relatedType && row.relatedId ? { type: row.relatedType, id: row.relatedId } : undefined, source: row.source, occurredAt: row.occurredAt.toISOString() }; }
function toAuditEvent(row: { id: string; actorProfileId?: string | null; action: string; resourceType: string; resourceId?: string | null; metadata?: unknown; createdAt: Date }): AuditEvent { return { id: row.id, actor: { actorId: row.actorProfileId ?? "unknown", roles: [] }, action: row.action, resourceType: row.resourceType, resourceId: row.resourceId ?? undefined, metadata: (row.metadata as Record<string, unknown>) || undefined, occurredAt: row.createdAt.toISOString() }; }
