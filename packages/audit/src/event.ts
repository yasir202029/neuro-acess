/**
 * Audit trail primitives.
 *
 * The clinical audit log is append-only. Every privileged or consequential
 * action produces an AuditEvent. Metadata is redacted before it can reach a log
 * sink so clinical narrative, credentials and tokens never leak.
 */

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditCategory =
  | "JOURNEY"
  | "PERMISSION"
  | "CLINICAL"
  | "PRESCRIPTION"
  | "FINANCE"
  | "FEATURE_FLAG"
  | "SECURITY"
  | "ADMIN";

export interface AuditActor {
  readonly actorId: string;
  readonly roles: readonly string[];
  /** Present for break-glass access. */
  readonly breakGlassReason?: string;
}

export interface AuditEventInput {
  readonly category: AuditCategory;
  readonly action: string;
  readonly severity?: AuditSeverity;
  readonly actor: AuditActor;
  readonly patientId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  /** Structured, redacted metadata. Must not contain PHI after redaction. */
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt?: string;
}

export interface AuditEvent extends Required<Omit<AuditEventInput, "severity" | "patientId" | "resourceType" | "resourceId" | "metadata" | "occurredAt">> {
  readonly severity: AuditSeverity;
  readonly patientId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: string;
}

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|apikey|api_key|authorization|bearer|cookie|sessionid|refresh|mfa|otp|code|nhsnumber|nhs_number|ssn|diagnosis|narrative|transcript|clinicalnote|free_?text)/i;

/** Keys that are always dropped regardless of value. */
const ALWAYS_DROP = new Set(["password", "token", "accessToken", "refreshToken", "authorization", "apiKey", "secret"]);

/**
 * Recursively redact sensitive keys from a metadata object before logging.
 * Returns a new object; never mutates the input.
 */
export function redactMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (ALWAYS_DROP.has(key) || SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactMetadata(val, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/** Build a validated, redacted, immutable audit event ready to persist. */
export function createAuditEvent(input: AuditEventInput): AuditEvent {
  const metadata = input.metadata ? (redactMetadata(input.metadata) as Record<string, unknown>) : undefined;
  return Object.freeze({
    category: input.category,
    action: input.action,
    severity: input.severity ?? "INFO",
    actor: Object.freeze({ ...input.actor }),
    ...(input.patientId ? { patientId: input.patientId } : {}),
    ...(input.resourceType ? { resourceType: input.resourceType } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    ...(metadata ? { metadata } : {}),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  });
}
