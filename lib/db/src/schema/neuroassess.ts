import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  uniqueIndex,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const id = (name: string) => text(name).primaryKey();
const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const clinicsTable = pgTable("clinics", {
  id: id("id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const profilesTable = pgTable("profiles", {
  id: id("id"),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  createdAt,
  updatedAt,
});


export const clinicMembershipsTable = pgTable("clinic_memberships", {
  id: id("id"),
  clinicId: text("clinic_id").notNull(),
  profileId: text("profile_id").notNull(),
  role: text("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("clinic_memberships_clinic_profile_idx").on(table.clinicId, table.profileId)]);

export const patientsTable = pgTable("patients", {
  clinicId: text("clinic_id"),
  id: id("id"),
  profileId: text("profile_id").notNull(),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  preferredContact: text("preferred_contact"),
  emergencyContact: jsonb("emergency_contact"),
  createdAt,
  updatedAt,
});

export const cliniciansTable = pgTable("clinicians", {
  clinicId: text("clinic_id"),
  id: id("id"),
  profileId: text("profile_id").notNull(),
  registrationNumber: text("registration_number"),
  specialty: text("specialty"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
});

export const appointmentsTable = pgTable("appointments", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  clinicianId: text("clinician_id"),
  assessmentType: text("assessment_type").notNull(),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  status: text("status").notNull().default("pending"),
  location: text("location").notNull(),
  createdAt,
  updatedAt,
});

export const clinicalNotesTable = pgTable("clinical_notes", {
  clinicId: text("clinic_id").notNull(),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  authorProfileId: text("author_profile_id").notNull(),
  noteType: text("note_type").notNull(),
  body: text("body").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt,
  updatedAt,
});

export const diagnosesTable = pgTable("diagnoses", {
  clinicId: text("clinic_id").notNull(),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  clinicianId: text("clinician_id").notNull(),
  codeSystem: text("code_system").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("active"),
  diagnosedAt: timestamp("diagnosed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt,
  updatedAt,
});

export const assessmentsTable = pgTable("assessments", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  clinicianId: text("clinician_id"),
  assessmentType: text("assessment_type").notNull(),
  stage: text("stage").notNull().default("not_started"),
  progress: integer("progress").notNull().default(0),
  responses: jsonb("responses"),
  createdAt,
  updatedAt,
});

export const formsTable = pgTable("forms", {
  clinicId: text("clinic_id"),
  id: id("id"),
  assessmentId: text("assessment_id").notNull(),
  title: text("title").notNull(),
  formType: text("form_type").notNull(),
  status: text("status").notNull().default("not_started"),
  responses: jsonb("responses"),
  createdAt,
  updatedAt,
});

export const reportsTable = pgTable("reports", {
  clinicId: text("clinic_id"),
  id: id("id"),
  assessmentId: text("assessment_id").notNull(),
  clinicianId: text("clinician_id").notNull(),
  title: text("title").notNull(),
  storagePath: text("storage_path"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const messagesTable = pgTable("messages", {
  clinicId: text("clinic_id"),
  id: id("id"),
  senderProfileId: text("sender_profile_id").notNull(),
  recipientProfileId: text("recipient_profile_id").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt,
});

export const documentsTable = pgTable("documents", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  uploadedByProfileId: text("uploaded_by_profile_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  storagePath: text("storage_path").notNull(),
  status: text("status").notNull().default("uploaded"),
  createdAt,
});

export const paymentsTable = pgTable("payments", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  appointmentId: text("appointment_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("gbp"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt,
});

export const auditLogsTable = pgTable("audit_logs", {
  clinicId: text("clinic_id"),
  id: id("id"),
  actorProfileId: text("actor_profile_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt,
});

// --- Slice 1: referral → assessment (see docs/delivery/SLICE1_DESIGN.md) ---

export const referralsTable = pgTable("referrals", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  pathway: text("pathway").notNull(), // ADHD | AUTISM | BOTH
  referralSource: text("referral_source").notNull(), // SELF | GP | OTHER
  presentingConcern: text("presenting_concern").notNull(),
  validationStatus: text("validation_status").notNull().default("PENDING_VALIDATION"),
  validationNote: text("validation_note"),
  assignedClinicianProfileId: text("assigned_clinician_profile_id"),
  appointmentId: text("appointment_id"),
  createdAt,
  updatedAt,
});

export const journeyStatesTable = pgTable(
  "journey_states",
  {
    clinicId: text("clinic_id"),
    id: id("id"),
    patientId: text("patient_id").notNull(),
    stage: text("stage").notNull(),
    version: integer("version").notNull().default(0),
    hasIntakeCompleted: boolean("has_intake_completed").notNull().default(false),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("journey_states_patient_idx").on(table.patientId)],
);

/** Immutable append-only transition log (never UPDATEd, never DELETEd). */
export const journeyTransitionsTable = pgTable("journey_transitions", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  command: text("command").notNull(),
  actorProfileId: text("actor_profile_id").notNull(),
  reason: text("reason"),
  createdAt,
});

export const timelineEventsTable = pgTable("timeline_events", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  actorProfileId: text("actor_profile_id"),
  title: text("title").notNull(),
  summary: text("summary"),
  visibility: text("visibility").notNull(), // PATIENT | ASSIGNED_TEAM | CLINICAL_ORG | ADMIN | FINANCE | RESTRICTED
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  source: text("source").notNull(),
  createdAt,
});

export const consultationConsentsTable = pgTable("consultation_consents", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  referralId: text("referral_id").notNull(),
  wordingVersion: text("wording_version").notNull(),
  purpose: text("purpose").notNull(),
  consentingParty: text("consenting_party").notNull(), // PATIENT | PROXY
  clinicianProfileId: text("clinician_profile_id").notNull(),
  restrictions: text("restrictions"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  createdAt,
});

export const transcriptSegmentsTable = pgTable("transcript_segments", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  referralId: text("referral_id").notNull(),
  speaker: text("speaker").notNull(), // CLINICIAN | PATIENT
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  segmentText: text("segment_text").notNull(),
  excluded: boolean("excluded").notNull().default(false),
  createdAt,
});

export const aiDraftsTable = pgTable("ai_drafts", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  referralId: text("referral_id").notNull(),
  status: text("status").notNull(), // AI_DRAFT_REQUIRES_CLINICIAN_REVIEW | AMENDED | APPROVED | REJECTED
  statements: jsonb("statements").notNull(),
  missingInformation: jsonb("missing_information").notNull().default([]),
  conflicts: jsonb("conflicts").notNull().default([]),
  safetyFindings: jsonb("safety_findings").notNull().default([]),
  version: integer("version").notNull().default(1),
  createdByProfileId: text("created_by_profile_id").notNull(),
  createdAt,
  updatedAt,
});

export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicMembershipSchema = createInsertSchema(clinicMembershipsTable).omit({ createdAt: true, updatedAt: true });
export const insertProfileSchema = createInsertSchema(profilesTable).omit({ createdAt: true, updatedAt: true });
export const insertPatientSchema = createInsertSchema(patientsTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicianSchema = createInsertSchema(cliniciansTable).omit({ createdAt: true, updatedAt: true });
export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicalNoteSchema = createInsertSchema(clinicalNotesTable).omit({ createdAt: true, updatedAt: true });
export const insertDiagnosisSchema = createInsertSchema(diagnosesTable).omit({ createdAt: true, updatedAt: true });
export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ createdAt: true, updatedAt: true });
export const insertFormSchema = createInsertSchema(formsTable).omit({ createdAt: true, updatedAt: true });
export const insertReportSchema = createInsertSchema(reportsTable).omit({ createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ createdAt: true });
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ createdAt: true });
export const insertReferralSchema = createInsertSchema(referralsTable).omit({ createdAt: true, updatedAt: true });
export const insertJourneyStateSchema = createInsertSchema(journeyStatesTable).omit({ createdAt: true, updatedAt: true });
export const insertJourneyTransitionSchema = createInsertSchema(journeyTransitionsTable).omit({ createdAt: true });
export const insertTimelineEventSchema = createInsertSchema(timelineEventsTable).omit({ createdAt: true });
export const insertConsultationConsentSchema = createInsertSchema(consultationConsentsTable).omit({ createdAt: true });
export const insertTranscriptSegmentSchema = createInsertSchema(transcriptSegmentsTable).omit({ createdAt: true });
export const insertAiDraftSchema = createInsertSchema(aiDraftsTable).omit({ createdAt: true, updatedAt: true });

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type InsertClinicMembership = z.infer<typeof insertClinicMembershipSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertClinician = z.infer<typeof insertClinicianSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertClinicalNote = z.infer<typeof insertClinicalNoteSchema>;
export type InsertDiagnosis = z.infer<typeof insertDiagnosisSchema>;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type InsertJourneyState = z.infer<typeof insertJourneyStateSchema>;
export type InsertJourneyTransition = z.infer<typeof insertJourneyTransitionSchema>;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type InsertConsultationConsent = z.infer<typeof insertConsultationConsentSchema>;
export type InsertTranscriptSegment = z.infer<typeof insertTranscriptSegmentSchema>;
export type InsertAiDraft = z.infer<typeof insertAiDraftSchema>;
export type Referral = typeof referralsTable.$inferSelect;
export type JourneyState = typeof journeyStatesTable.$inferSelect;
export type AiDraft = typeof aiDraftsTable.$inferSelect;

// ============================================================================
// APEX Platform tables — patient onboarding, screening, booking, payments,
// vitals, prescriptions, AI drafting, transcription, earnings, stars
// ============================================================================

export const patientOnboardingTable = pgTable("patient_onboarding", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull().unique(),
  stage: text("stage").notNull().default("account"),
  progress: integer("progress").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const safetyScreeningTable = pgTable("safety_screening", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull().unique(),
  pathway: text("pathway").notNull(),
  answers: jsonb("answers").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedByProfileId: text("reviewed_by_profile_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const screeningQuestionnaireTable = pgTable("screening_questionnaire", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  questionnaireType: text("questionnaire_type").notNull(),
  version: text("version").notNull(),
  answers: jsonb("answers").notNull().default("{}"),
  totalScore: integer("total_score"),
  interpretation: text("interpretation"),
  status: text("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const patientVitalsTable = pgTable("patient_vitals", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  recordedBy: text("recorded_by").notNull().default("patient"),
  systolicBp: integer("systolic_bp"),
  diastolicBp: integer("diastolic_bp"),
  heartRate: integer("heart_rate"),
  temperature: integer("temperature"),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
  heightCm: numeric("height_cm", { precision: 5, scale: 2 }),
  oxygenSaturation: integer("oxygen_saturation"),
  contextualNote: text("contextual_note"),
  submissionId: text("submission_id").notNull().unique(),
  createdAt,
});

export const prescriptionTable = pgTable("prescription", {
  clinicId: text("clinic_id"),
  id: id("id"),
  patientId: text("patient_id").notNull(),
  clinicianId: text("clinician_id").notNull(),
  appointmentId: text("appointment_id"),
  medication: text("medication").notNull(),
  dosage: text("dosage").notNull(),
  frequency: text("frequency").notNull(),
  status: text("status").notNull().default("draft"),
  authorisedByProfileId: text("authorised_by_profile_id"),
  authorisedAt: timestamp("authorised_at", { withTimezone: true }),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const clinicalNoteAIDraftTable = pgTable("clinical_note_ai_draft", {
  clinicId: text("clinic_id"),
  id: id("id"),
  noteId: text("note_id").notNull().unique(),
  patientId: text("patient_id").notNull(),
  originalBody: text("original_body").notNull(),
  aiDraftBody: text("ai_draft_body").notNull(),
  finalBody: text("final_body"),
  status: text("status").notNull().default("draft"),
  clinicianProfileId: text("clinician_profile_id").notNull(),
  createdAt,
  updatedAt,
});

export const transcriptionSessionTable = pgTable("transcription_session", {
  clinicId: text("clinic_id"),
  id: id("id"),
  sessionId: text("session_id").notNull().unique(),
  patientId: text("patient_id").notNull(),
  clinicianProfileId: text("clinician_profile_id").notNull(),
  status: text("status").notNull().default("not_recording"),
  transcriptUrl: text("transcript_url"),
  consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
  recordingStartedAt: timestamp("recording_started_at", { withTimezone: true }),
  recordingStoppedAt: timestamp("recording_stopped_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const clinicianEarningsTable = pgTable("clinician_earnings", {
  clinicId: text("clinic_id"),
  id: id("id"),
  clinicianId: text("clinician_id").notNull(),
  appointmentId: text("appointment_id"),
  assessmentId: text("assessment_id"),
  reportId: text("report_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("gbp"),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt,
  updatedAt,
});

export const clinicianStarTable = pgTable("clinician_star", {
  clinicId: text("clinic_id"),
  id: id("id"),
  clinicianId: text("clinician_id").notNull(),
  eventType: text("event_type").notNull(),
  eventId: text("event_id").notNull(),
  starsAwarded: integer("stars_awarded").notNull().default(0),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt,
});

export const insertPatientOnboardingSchema = createInsertSchema(patientOnboardingTable).omit({ createdAt: true, updatedAt: true });
export const insertSafetyScreeningSchema = createInsertSchema(safetyScreeningTable).omit({ createdAt: true, updatedAt: true });
export const insertScreeningQuestionnaireSchema = createInsertSchema(screeningQuestionnaireTable).omit({ createdAt: true, updatedAt: true });
export const insertPatientVitalsSchema = createInsertSchema(patientVitalsTable).omit({ createdAt: true });
export const insertPrescriptionSchema = createInsertSchema(prescriptionTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicalNoteAIDraftSchema = createInsertSchema(clinicalNoteAIDraftTable).omit({ createdAt: true, updatedAt: true });
export const insertTranscriptionSessionSchema = createInsertSchema(transcriptionSessionTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicianEarningsSchema = createInsertSchema(clinicianEarningsTable).omit({ createdAt: true, updatedAt: true });
export const insertClinicianStarSchema = createInsertSchema(clinicianStarTable).omit({ createdAt: true });

export type PatientOnboarding = typeof patientOnboardingTable.$inferSelect;
export type SafetyScreening = typeof safetyScreeningTable.$inferSelect;
export type ScreeningQuestionnaire = typeof screeningQuestionnaireTable.$inferSelect;
export type PatientVitals = typeof patientVitalsTable.$inferSelect;
export type Prescription = typeof prescriptionTable.$inferSelect;
export type ClinicalNoteAIDraft = typeof clinicalNoteAIDraftTable.$inferSelect;
export type TranscriptionSession = typeof transcriptionSessionTable.$inferSelect;
export type ClinicianEarnings = typeof clinicianEarningsTable.$inferSelect;
export type ClinicianStar = typeof clinicianStarTable.$inferSelect;

export type InsertPatientOnboarding = z.infer<typeof insertPatientOnboardingSchema>;
export type InsertSafetyScreening = z.infer<typeof insertSafetyScreeningSchema>;
export type InsertScreeningQuestionnaire = z.infer<typeof insertScreeningQuestionnaireSchema>;
export type InsertPatientVitals = z.infer<typeof insertPatientVitalsSchema>;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type InsertClinicalNoteAIDraft = z.infer<typeof insertClinicalNoteAIDraftSchema>;
export type InsertTranscriptionSession = z.infer<typeof insertTranscriptionSessionSchema>;
export type InsertClinicianEarnings = z.infer<typeof insertClinicianEarningsSchema>;
export type InsertClinicianStar = z.infer<typeof insertClinicianStarSchema>;
