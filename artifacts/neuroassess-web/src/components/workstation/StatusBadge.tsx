/**
 * StatusBadge — typed, fallback-safe status badge for queue items.
 *
 * Never relies on colour alone. Each status has a label, icon where useful,
 * colour, and accessible text. Unknown statuses render a safe fallback.
 */

import { Clock, User, ShieldAlert, Phone, CheckCircle, Loader2 } from "lucide-react";

export type QueueStatus =
  | "NEW"
  | "WAITING_FOR_FORMS"
  | "WAITING_FOR_INFORMANT"
  | "APPOINTMENT_REQUIRED"
  | "CLINICIAN_ASSIGNMENT_REQUIRED"
  | "ASSESSMENT_PREPARATION"
  | "ASSESSMENT_COMPLETE_REVIEW_REQUIRED"
  | "REPORT_PENDING"
  | "PAYMENT_REQUIRED"
  | "TITRATION_REVIEW_DUE"
  | "VITALS_REQUIRED"
  | "PRESCRIPTION_ADMINISTRATION"
  | "FOLLOW_UP_REQUIRED"
  | "ADMINISTRATIVE_EXCEPTION";

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  variant: "default" | "secondary" | "destructive" | "warning" | "success";
}

const STATUS_CONFIG: Record<QueueStatus, StatusConfig> = {
  NEW: { label: "New", icon: Clock, variant: "default" },
  WAITING_FOR_FORMS: { label: "Waiting for Forms", icon: User, variant: "secondary" },
  WAITING_FOR_INFORMANT: { label: "Waiting for Informant", icon: User, variant: "secondary" },
  APPOINTMENT_REQUIRED: { label: "Appointment Required", icon: Phone, variant: "warning" },
  CLINICIAN_ASSIGNMENT_REQUIRED: { label: "Clinician Assignment Required", icon: User, variant: "secondary" },
  ASSESSMENT_PREPARATION: { label: "Assessment Preparation", icon: ShieldAlert, variant: "secondary" },
  ASSESSMENT_COMPLETE_REVIEW_REQUIRED: { label: "Review Required", icon: ShieldAlert, variant: "warning" },
  REPORT_PENDING: { label: "Report Pending", icon: Clock, variant: "secondary" },
  PAYMENT_REQUIRED: { label: "Payment Required", icon: ShieldAlert, variant: "destructive" },
  TITRATION_REVIEW_DUE: { label: "Titration Review Due", icon: Clock, variant: "warning" },
  VITALS_REQUIRED: { label: "Vitals Required", icon: Phone, variant: "secondary" },
  PRESCRIPTION_ADMINISTRATION: { label: "Prescription Administration", icon: ShieldAlert, variant: "warning" },
  FOLLOW_UP_REQUIRED: { label: "Follow-up Required", icon: Clock, variant: "secondary" },
  ADMINISTRATIVE_EXCEPTION: { label: "Administrative Exception", icon: ShieldAlert, variant: "destructive" },
};

const FALLBACK_CONFIG: StatusConfig = { label: "Unknown", icon: ShieldAlert, variant: "secondary" };

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as QueueStatus] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  const variantClasses: Record<string, string> = {
    default: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
    secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
    destructive: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
    warning: "bg-[hsl(var(--apex-amber-warning))] text-[hsl(var(--apex-neutral-slate))]",
    success: "bg-[hsl(var(--apex-success-green))] text-[hsl(var(--apex-neutral-slate))]",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[.1em] ${variantClasses[config.variant]}`}
      title={config.label}
    >
      <Icon size={10} />
      {config.label}
    </span>
  );
}