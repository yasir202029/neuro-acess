/**
 * React Query hooks for the Clinical Workstation.
 *
 * Wraps `workstationApi` with stable query keys, loading/error handling, and
 * optimistic-style invalidation so the clinician workstation stays consistent
 * across notes, assessments, care plans, and alerts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workstationApi, type WorkstationPatient, type Paginated } from "@/lib/clinical-api";

export const workstationKeys = {
  patients: (search?: string) => ["workstation", "patients", search ?? ""],
  patient: (id: string) => ["workstation", "patient", id],
  vitals: (id: string) => ["workstation", "vitals", id],
};

/** List patients visible to the clinician (paginated, searchable). */
export function useWorkstationPatients(params?: { page?: number; pageSize?: number; search?: string }) {
  return useQuery({
    queryKey: workstationKeys.patients(params?.search),
    queryFn: () => workstationApi.listPatients(params),
    select: (data) => data,
    staleTime: 1000 * 60 * 2,
  });
}

/** Single patient 360 summary. */
export function useWorkstationPatient(patientId: string | null) {
  return useQuery({
    queryKey: workstationKeys.patient(patientId ?? ""),
    queryFn: () => workstationApi.getPatient(patientId!),
    enabled: !!patientId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Vitals time series for a patient. */
export function useWorkstationVitals(patientId: string | null) {
  return useQuery({
    queryKey: workstationKeys.vitals(patientId ?? ""),
    queryFn: () => workstationApi.getVitals(patientId!),
    enabled: !!patientId,
    staleTime: 1000 * 60 * 5,
  });
}

/** Create a clinical note, then refetch the patient summary. */
export function useCreateClinicalNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: string; body: string }) =>
      workstationApi.createClinicalNote(patientId, body as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
      qc.invalidateQueries({ queryKey: workstationKeys.patients() });
    },
  });
}

/** Submit a structured assessment (ADHD/Autism instruments). */
export function useSubmitAssessment(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instrument: string; answers: number[]; interpretation: string }) =>
      workstationApi.submitAssessment(patientId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
    },
  });
}

/** Create a care plan item. */
export function useCreateCarePlanItem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      category: string;
      priority: string;
      targetDate: string | null;
      ownerRole: string;
    }) => workstationApi.createCarePlanItem(patientId, body as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
    },
  });
}

/** Create an appointment. */
export function useCreateAppointment(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      startsAt: string;
      endsAt: string;
      mode: "VIDEO" | "PHONE" | "IN_PERSON";
      reason: string;
      locationOrLink: string;
    }) => workstationApi.createAppointment(patientId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
    },
  });
}

/** Add an MDT collaboration note. */
export function useCreateMdtNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; visibleToTeam?: boolean }) =>
      workstationApi.createMdtNote(patientId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
    },
  });
}

/** Acknowledge a clinical alert. */
export function useAcknowledgeAlert(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => workstationApi.acknowledgeAlert(patientId, alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workstationKeys.patient(patientId) });
      qc.invalidateQueries({ queryKey: workstationKeys.patients() });
    },
  });
}

export type { WorkstationPatient, Paginated };
