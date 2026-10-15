/**
 * Clarity Health Design System — core.
 *
 * Semantic status model: clinical state is NEVER conveyed by colour alone.
 * Every status resolves to { tone, icon, label, description } so components
 * always render an icon + text label alongside the colour, plus an accessible
 * description for screen readers.
 */

export type ClarityTheme = "light" | "dark" | "high-contrast";
export type ClarityDensity = "comfortable" | "compact";
export type ClarityMode = "staff" | "patient-calm";
export type ClarityMotion = "full" | "reduced";

export interface ClarityAppearance {
  theme: ClarityTheme;
  density: ClarityDensity;
  mode: ClarityMode;
  motion: ClarityMotion;
}

export const defaultAppearance: ClarityAppearance = {
  theme: "light",
  density: "comfortable",
  mode: "staff",
  motion: "full",
};

const STORAGE_KEY = "clarity.appearance.v1";

export function loadAppearance(): ClarityAppearance {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return defaultAppearance;
    const parsed = JSON.parse(raw) as Partial<ClarityAppearance>;
    return { ...defaultAppearance, ...parsed };
  } catch {
    return defaultAppearance;
  }
}

export function saveAppearance(appearance: ClarityAppearance): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    /* storage unavailable — preferences stay session-only */
  }
}

/** Apply appearance as data-attributes on <html>; CSS tokens react to these. */
export function applyAppearance(appearance: ClarityAppearance): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.dataset.clarityTheme = appearance.theme;
  root.dataset.clarityDensity = appearance.density;
  if (appearance.mode === "patient-calm") root.dataset.clarityMode = "patient-calm";
  else delete root.dataset.clarityMode;
  root.dataset.clarityMotion = appearance.motion;
}

/* ===== Clinical status semantics ===== */

export type ClinicalTone =
  | "normal"
  | "review"
  | "abnormal"
  | "critical"
  | "information"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface StatusSemantics {
  readonly tone: ClinicalTone;
  readonly icon: string; // lucide icon name
  readonly label: string;
  /** Screen-reader description; never relies on colour. */
  readonly description: string;
}

export const statusSemantics: Record<string, StatusSemantics> = {
  normal: { tone: "normal", icon: "CheckCircle2", label: "Normal", description: "Result within expected range" },
  review: { tone: "review", icon: "Eye", label: "Needs review", description: "Requires clinician review" },
  abnormal: { tone: "abnormal", icon: "AlertTriangle", label: "Abnormal", description: "Result outside expected range" },
  critical: { tone: "critical", icon: "OctagonAlert", label: "Critical", description: "Urgent clinical attention required" },
  information: { tone: "information", icon: "Info", label: "Information", description: "Informational notice" },
  success: { tone: "success", icon: "Check", label: "Complete", description: "Completed successfully" },
  warning: { tone: "warning", icon: "AlertTriangle", label: "Warning", description: "Attention required" },
  danger: { tone: "danger", icon: "OctagonAlert", label: "Urgent", description: "Urgent action required" },
  neutral: { tone: "neutral", icon: "Minus", label: "Not recorded", description: "No data recorded" },
};

export function semanticsFor(tone: ClinicalTone): StatusSemantics {
  return statusSemantics[tone] ?? statusSemantics.neutral!;
}

/* ===== Prescription state machine (display mapping only; authority is enforced server-side) ===== */

export type PrescriptionState =
  | "DRAFT" | "SUBMITTED" | "CLINICAL_REVIEW" | "AWAITING_INFORMATION"
  | "APPROVED" | "REJECTED" | "AUTHORISED" | "SENT_FOR_PROCESSING"
  | "DISPENSED" | "CANCELLED" | "EXPIRED";

export const prescriptionStateSemantics: Record<PrescriptionState, StatusSemantics> = {
  DRAFT: { tone: "neutral", icon: "FileEdit", label: "Draft", description: "Not yet submitted" },
  SUBMITTED: { tone: "information", icon: "Send", label: "Submitted", description: "Awaiting clinical review" },
  CLINICAL_REVIEW: { tone: "review", icon: "Stethoscope", label: "Clinical review", description: "Under clinical review" },
  AWAITING_INFORMATION: { tone: "warning", icon: "Clock", label: "Awaiting information", description: "Missing information required" },
  APPROVED: { tone: "success", icon: "CheckCircle2", label: "Approved", description: "Clinically approved" },
  REJECTED: { tone: "danger", icon: "XCircle", label: "Rejected", description: "Rejected at review" },
  AUTHORISED: { tone: "success", icon: "BadgeCheck", label: "Authorised", description: "Authorised for dispensing" },
  SENT_FOR_PROCESSING: { tone: "information", icon: "Package", label: "Processing", description: "Sent for processing" },
  DISPENSED: { tone: "success", icon: "Pill", label: "Dispensed", description: "Dispensed to patient" },
  CANCELLED: { tone: "neutral", icon: "Ban", label: "Cancelled", description: "Cancelled" },
  EXPIRED: { tone: "neutral", icon: "CalendarX", label: "Expired", description: "Expired without dispensing" },
};

/* ===== Risk semantics ===== */

export type RiskLevel = "low" | "moderate" | "high" | "urgent";

export const riskSemantics: Record<RiskLevel, StatusSemantics> = {
  low: { tone: "normal", icon: "ShieldCheck", label: "Low risk", description: "Low clinical risk" },
  moderate: { tone: "review", icon: "ShieldAlert", label: "Moderate risk", description: "Moderate clinical risk, monitor" },
  high: { tone: "abnormal", icon: "ShieldAlert", label: "High risk", description: "High clinical risk, act promptly" },
  urgent: { tone: "critical", icon: "Siren", label: "Urgent risk", description: "Urgent risk, immediate action" },
};
