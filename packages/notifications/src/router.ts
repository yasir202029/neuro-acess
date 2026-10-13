/**
 * Notification routing. Notifications are produced by the workflow engine and
 * delivered across an asynchronous boundary; nothing here blocks a transition.
 *
 * Templates are referenced by stable key so copy can be edited without code
 * changes. Content is intentionally non-clinical: no diagnosis, medication
 * detail, or free-text clinical narrative is ever placed in a notification body.
 */

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";
export type NotificationAudience = "PATIENT" | "ASSIGNED_CLINICIAN" | "ADMIN" | "MDT" | "FINANCE";

export interface NotificationIntent {
  readonly audience: NotificationAudience;
  readonly channel: NotificationChannel;
  readonly template: string;
  /** Structured, non-PHI merge variables (e.g. { appointmentDate }). */
  readonly variables?: Readonly<Record<string, string | number>>;
}

/** Registry of known templates. Unknown templates are rejected at enqueue time. */
export const notificationTemplates = [
  "referral_received",
  "appointment_booked",
  "case_assigned",
  "assessment_started",
  "outcome_recorded",
  "more_information_required",
  "ecg_requested",
  "information_received",
  "physical_health_received",
  "titration_started",
  "prescribing_started",
  "maintenance_started",
  "shared_care_initiated",
  "shared_care_complete",
  "annual_review_started",
  "annual_review_complete",
  "mdt_escalation",
  "episode_closed",
  "discharged",
  "prescription_status_changed",
  "message_received",
  "invoice_issued",
] as const;

export type NotificationTemplate = (typeof notificationTemplates)[number];

const templateSet: ReadonlySet<string> = new Set(notificationTemplates);

export function isNotificationTemplate(value: string): value is NotificationTemplate {
  return templateSet.has(value);
}

export interface RoutingRule {
  readonly audience: NotificationAudience;
  readonly allowedChannels: readonly NotificationChannel[];
}

/** Default routing: what channel each audience may receive on. */
export const routingRules: readonly RoutingRule[] = [
  { audience: "PATIENT", allowedChannels: ["IN_APP", "EMAIL"] },
  { audience: "ASSIGNED_CLINICIAN", allowedChannels: ["IN_APP"] },
  { audience: "ADMIN", allowedChannels: ["IN_APP", "EMAIL"] },
  { audience: "MDT", allowedChannels: ["IN_APP"] },
  { audience: "FINANCE", allowedChannels: ["IN_APP"] },
];

export type RouteDecision =
  | { readonly ok: true; readonly channel: NotificationChannel }
  | { readonly ok: false; readonly reason: "UNKNOWN_TEMPLATE" | "CHANNEL_NOT_ALLOWED" | "UNKNOWN_AUDIENCE" };

/** Validate an intent against routing rules. Deny-by-default. */
export function routeNotification(intent: NotificationIntent): RouteDecision {
  if (!isNotificationTemplate(intent.template)) return { ok: false, reason: "UNKNOWN_TEMPLATE" };
  const rule = routingRules.find((r) => r.audience === intent.audience);
  if (!rule) return { ok: false, reason: "UNKNOWN_AUDIENCE" };
  if (!rule.allowedChannels.includes(intent.channel)) return { ok: false, reason: "CHANNEL_NOT_ALLOWED" };
  return { ok: true, channel: intent.channel };
}
