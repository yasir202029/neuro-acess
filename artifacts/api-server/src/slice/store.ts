/**
 * SliceStore — the single persistence seam for the slice.
 *
 * `InMemorySliceStore` is the synthetic development/test implementation
 * (single process, resets on restart). The Drizzle/Postgres implementation
 * targets the same interface and migration 0009 (gap register — not yet
 * wired because no database is reachable in this environment).
 */
import { randomUUID } from "node:crypto";
import type { JourneyFacts } from "@neurocare/journey";
import type { WorkflowPorts } from "@neurocare/workflow-engine";
import type { AuditEvent } from "@neurocare/audit";
import type { TimelineEvent } from "@neurocare/timeline";
import {
  SliceError,
  type AiDraft,
  type Bookmark,
  type ClinicalNote,
  type ConsultationState,
  type ConsentRecord,
  type IntakeSubmission,
  type JourneySnapshot,
  type NotificationRecord,
  type PatientRecord,
  type ProfileRecord,
  type Referral,
  type SliceTask,
  type StoredTransition,
  type TranscriptSegment,
} from "./types";

export interface SliceStore {
  // Profiles / patients
  getProfile(id: string): ProfileRecord | undefined;
  upsertProfile(profile: ProfileRecord): void;
  findPatientByProfile(profileId: string): PatientRecord | undefined;
  createPatient(record: PatientRecord): PatientRecord;
  getPatient(id: string): PatientRecord | undefined;

  // Referrals
  createReferral(referral: Referral): Referral;
  getReferral(id: string): Referral | undefined;
  listReferrals(): Referral[];
  updateReferral(id: string, patch: Partial<Omit<Referral, "id">>): Referral;

  // Journey
  createJourney(patientId: string): JourneySnapshot;
  getJourney(patientId: string): JourneySnapshot | undefined;
  updateJourney(
    patientId: string,
    patch: Partial<Pick<JourneySnapshot, "stage" | "version" | "hasAssignedClinician" | "hasIntakeCompleted">>,
  ): JourneySnapshot;
  recordTransition(input: {
    patientId: string;
    fromStage: string | null;
    toStage: string;
    command: string;
    actorId: string;
    reason?: string;
  }): void;
  listTransitions(patientId: string): StoredTransition[];

  // Intake
  saveIntake(intake: IntakeSubmission): IntakeSubmission;
  getIntake(referralId: string): IntakeSubmission | undefined;

  // Consultation (consent, transcript, bookmarks, state)
  createConsent(consent: ConsentRecord): ConsentRecord;
  getActiveConsent(referralId: string): ConsentRecord | undefined;
  addSegments(referralId: string, segments: readonly TranscriptSegment[]): void;
  listSegments(referralId: string): TranscriptSegment[];
  addBookmark(referralId: string, bookmark: Bookmark): Bookmark;
  listBookmarks(referralId: string): Bookmark[];
  getConsultationState(referralId: string): ConsultationState;
  setConsultationState(referralId: string, state: ConsultationState): void;

  // Drafts / notes
  createDraft(draft: AiDraft): AiDraft;
  getDraft(id: string): AiDraft | undefined;
  updateDraft(id: string, patch: Partial<AiDraft>): AiDraft;
  createNote(note: ClinicalNote): ClinicalNote;
  getSignedNote(referralId: string): ClinicalNote | undefined;

  // Effects
  createTasks(tasks: readonly SliceTask[]): void;
  listOpenTasks(patientId: string): SliceTask[];
  completeTasks(patientId: string, types: readonly string[]): void;
  appendTimeline(event: TimelineEvent): void;
  listTimeline(patientId: string): TimelineEvent[];
  appendAudit(event: AuditEvent): void;
  listAudit(): AuditEvent[];
  enqueueNotification(record: NotificationRecord): void;
  listNotifications(patientId: string): NotificationRecord[];
}
export class InMemorySliceStore implements SliceStore {
  private readonly profiles = new Map<string, ProfileRecord>();
  private readonly patients = new Map<string, PatientRecord>();
  private readonly patientsByProfile = new Map<string, string>();
  private readonly referrals = new Map<string, Referral>();
  private readonly journeys = new Map<string, JourneySnapshot>();
  private readonly intakes = new Map<string, IntakeSubmission>(); // referralId ->
  private readonly consents = new Map<string, ConsentRecord[]>(); // referralId ->
  private readonly segments = new Map<string, TranscriptSegment[]>(); // referralId ->
  private readonly bookmarks = new Map<string, Bookmark[]>(); // referralId ->
  private readonly consultationStates = new Map<string, ConsultationState>();
  private readonly drafts = new Map<string, AiDraft>();
  private readonly notes = new Map<string, ClinicalNote>();
  private readonly notesByReferral = new Map<string, string>();
  private readonly tasks: SliceTask[] = [];
  private readonly transitions: StoredTransition[] = [];
  private readonly timeline: TimelineEvent[] = [];
  private readonly audit: AuditEvent[] = [];
  private readonly notifications: NotificationRecord[] = [];

  getProfile(id: string) { return this.profiles.get(id); }
  upsertProfile(profile: ProfileRecord) { this.profiles.set(profile.id, profile); }
  findPatientByProfile(profileId: string) {
    const id = this.patientsByProfile.get(profileId);
    return id ? this.patients.get(id) : undefined;
  }
  createPatient(record: PatientRecord) {
    this.patients.set(record.id, record);
    this.patientsByProfile.set(record.profileId, record.id);
    return record;
  }
  getPatient(id: string) { return this.patients.get(id); }

  createReferral(referral: Referral) { this.referrals.set(referral.id, referral); return referral; }
  getReferral(id: string) { return this.referrals.get(id); }
  listReferrals() { return [...this.referrals.values()]; }
  updateReferral(id: string, patch: Partial<Omit<Referral, "id">>) {
    const current = this.referrals.get(id);
    if (!current) throw new SliceError(404, "NOT_FOUND", "Referral not found.");
    const next = { ...current, ...patch };
    this.referrals.set(id, next);
    return next;
  }

  createJourney(patientId: string) {
    const snapshot: JourneySnapshot = {
      patientId,
      stage: "LEAD",
      version: 0,
      hasAssignedClinician: false,
      hasIntakeCompleted: false,
    };
    this.journeys.set(patientId, snapshot);
    return snapshot;
  }
  getJourney(patientId: string) { return this.journeys.get(patientId); }
  updateJourney(
    patientId: string,
    patch: Partial<Pick<JourneySnapshot, "stage" | "version" | "hasAssignedClinician" | "hasIntakeCompleted">>,
  ) {
    const journey = this.journeys.get(patientId);
    if (!journey) throw new SliceError(404, "NOT_FOUND", "Journey not found.");
    const next = { ...journey, ...patch };
    this.journeys.set(patientId, next);
    return next;
  }
  recordTransition(input: {
    patientId: string;
    fromStage: string | null;
    toStage: string;
    command: string;
    actorId: string;
    reason?: string;
  }) {
    this.transitions.push({ id: randomUUID(), createdAt: new Date().toISOString(), ...input });
  }
  listTransitions(patientId: string) {
    return this.transitions.filter((transition) => transition.patientId === patientId);
  }

  saveIntake(intake: IntakeSubmission) { this.intakes.set(intake.referralId, intake); return intake; }
  getIntake(referralId: string) { return this.intakes.get(referralId); }
  createConsent(consent: ConsentRecord) {
    const list = this.consents.get(consent.referralId) ?? [];
    list.push(consent);
    this.consents.set(consent.referralId, list);
    return consent;
  }
  getActiveConsent(referralId: string) {
    return this.consents.get(referralId)?.find((consent) => !consent.withdrawnAt);
  }
  addSegments(referralId: string, segments: readonly TranscriptSegment[]) {
    const list = this.segments.get(referralId) ?? [];
    this.segments.set(referralId, [...list, ...segments]);
  }
  listSegments(referralId: string) { return this.segments.get(referralId) ?? []; }
  addBookmark(referralId: string, bookmark: Bookmark) {
    const list = this.bookmarks.get(referralId) ?? [];
    list.push(bookmark);
    this.bookmarks.set(referralId, list);
    return bookmark;
  }
  listBookmarks(referralId: string) { return this.bookmarks.get(referralId) ?? []; }
  getConsultationState(referralId: string) {
    return this.consultationStates.get(referralId) ?? "NOT_STARTED";
  }
  setConsultationState(referralId: string, state: ConsultationState) {
    this.consultationStates.set(referralId, state);
  }

  createDraft(draft: AiDraft) { this.drafts.set(draft.id, draft); return draft; }
  getDraft(id: string) { return this.drafts.get(id); }
  updateDraft(id: string, patch: Partial<AiDraft>) {
    const current = this.drafts.get(id);
    if (!current) throw new SliceError(404, "NOT_FOUND", "Draft not found.");
    const next = { ...current, ...patch };
    this.drafts.set(id, next);
    return next;
  }
  createNote(note: ClinicalNote) {
    this.notes.set(note.id, note);
    this.notesByReferral.set(note.referralId, note.id);
    return note;
  }
  getSignedNote(referralId: string) {
    const id = this.notesByReferral.get(referralId);
    return id ? this.notes.get(id) : undefined;
  }

  createTasks(tasks: readonly SliceTask[]) { this.tasks.push(...tasks); }
  listOpenTasks(patientId: string) {
    return this.tasks.filter((task) => task.patientId === patientId && task.status === "OPEN");
  }
  completeTasks(patientId: string, types: readonly string[]) {
    for (let i = 0; i < this.tasks.length; i += 1) {
      const task = this.tasks[i];
      if (task && task.patientId === patientId && task.status === "OPEN" && types.includes(task.type)) {
        this.tasks[i] = { ...task, status: "DONE" };
      }
    }
  }
  appendTimeline(event: TimelineEvent) { this.timeline.push(event); }
  listTimeline(patientId: string) {
    return this.timeline.filter(
      (event) => event.relatedEntity?.id === patientId || event.id.startsWith(`${patientId}:`),
    );
  }
  appendAudit(event: AuditEvent) { this.audit.push(event); }
  listAudit() { return [...this.audit]; }
  enqueueNotification(record: NotificationRecord) { this.notifications.push(record); }
  listNotifications(patientId: string) {
    return this.notifications.filter((record) => record.patientId === patientId);
  }
}

/**
 * WorkflowPorts over the store. With a real database these port calls become
 * one transaction (runner contract); in memory they are synchronous maps, so
 * no partial state can be observed between steps within a single event loop
 * turn. `applyStage` enforces optimistic concurrency exactly like the DB
 * constraint will.
 */
export function createWorkflowPorts(store: SliceStore): WorkflowPorts {
  return {
    async loadFacts(patientId: string): Promise<JourneyFacts> {
      const journey = store.getJourney(patientId);
      if (!journey) throw new SliceError(404, "NOT_FOUND", "Journey not found.");
      return {
        currentStage: journey.stage,
        hasAssignedClinician: journey.hasAssignedClinician,
        hasIntakeCompleted: journey.hasIntakeCompleted,
        openTaskTypes: [...new Set(store.listOpenTasks(patientId).map((task) => task.type))],
        version: journey.version,
      };
    },
    async applyStage(input) {
      const journey = store.getJourney(input.patientId);
      if (!journey) throw new SliceError(404, "NOT_FOUND", "Journey not found.");
      if (journey.version !== input.expectedVersion) {
        throw new SliceError(409, "VERSION_CONFLICT", "The record changed; reload and retry.", {
          expectedVersion: input.expectedVersion,
          actualVersion: journey.version,
        });
      }
      store.updateJourney(input.patientId, {
        stage: input.toStage,
        version: input.expectedVersion + 1,
      });
      return { version: input.expectedVersion + 1 };
    },
    async recordTransition(input) { store.recordTransition(input); },
    async createTasks({ patientId, tasks }) {
      store.createTasks(
        tasks.map((task) => ({
          id: `${patientId}:${task.type}:${task.title}`,
          patientId,
          type: task.type,
          title: task.title,
          assigneeRole: task.assigneeRole,
          status: "OPEN" as const,
          createdAt: new Date().toISOString(),
        })),
      );
    },
    async enqueueNotifications({ patientId, notifications }) {
      for (const notification of notifications) {
        store.enqueueNotification({
          id: `${patientId}:${notification.template}:${Date.now()}:${Math.random()}`,
          patientId,
          audience: notification.audience,
          channel: notification.channel,
          template: notification.template,
          createdAt: new Date().toISOString(),
        });
      }
    },
    async writeAudit(event) { store.appendAudit(event); },
    async emitDomainEvent(event) { store.appendTimeline(event); },
  };
}

/** Process-wide store for the running server; tests build fresh instances. */
let serverStore: InMemorySliceStore | undefined;
export function getSliceStore(): InMemorySliceStore {
  serverStore ??= new InMemorySliceStore();
  return serverStore;
}


