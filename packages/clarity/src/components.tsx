/**
 * Clarity Health Design System — React components.
 *
 * Conventions:
 * - Every component is keyboard accessible and labelled for screen readers.
 * - Clinical status is never colour-only: StatusChip renders icon + label +
 *   accessible description.
 * - Permission-aware surfaces accept `permitted` and render a PermissionGate
 *   fallback; authorisation is ALWAYS re-verified server-side.
 * - Loading / empty / error / disabled / permission-denied states are built in.
 */
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef,
  useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  AlertTriangle, Ban, BadgeCheck, CalendarX, Check, CheckCircle2, ChevronDown,
  Clock, Eye, FileEdit, Info, Lock, Minus, OctagonAlert, Package, Pill, Search,
  Send, ShieldAlert, ShieldCheck, Siren, Stethoscope, X, XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  semanticsFor, prescriptionStateSemantics, riskSemantics,
  type ClinicalTone, type PrescriptionState, type RiskLevel, type StatusSemantics,
} from "./index";

const icons: Record<string, LucideIcon> = {
  AlertTriangle, Ban, BadgeCheck, CalendarX, Check, CheckCircle2, ChevronDown, Clock,
  Eye, FileEdit, Info, Lock, Minus, OctagonAlert, Package, Pill, Search, Send,
  ShieldAlert, ShieldCheck, Siren, Stethoscope, X, XCircle,
};

function Icon({ name, size = 15, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const Cmp = icons[name] ?? Info;
  return <Cmp size={size} aria-hidden="true" className={className} style={style} />;
}

/* ============================================================
 * ClarityCard
 * ============================================================ */
type CardVariant = "default" | "elevated" | "subtle" | "danger";
export function ClarityCard({ variant = "default", title, actions, children, className, ...rest }: {
  variant?: CardVariant; title?: ReactNode; actions?: ReactNode; children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`clx clx-card clx-card--${variant} ${className ?? ""}`} {...rest}>
      {(title || actions) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
          {title ? <h3 className="clx-card__title">{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* ============================================================
 * ClarityMetricCard
 * ============================================================ */
export function ClarityMetricCard({ label, value, hint, tone = "neutral", loading }: {
  label: string; value?: ReactNode; hint?: ReactNode; tone?: ClinicalTone; loading?: boolean;
}) {
  const sem = semanticsFor(tone);
  return (
    <div className="clx clx-metric" role="group" aria-label={label}>
      <span className="clx-metric__label">{label}</span>
      {loading ? (
        <div className="clx clx-skeleton" style={{ height: "1.75rem", width: "6rem" }} aria-hidden="true" />
      ) : (
        <span className="clx-metric__value" style={{ color: tone === "neutral" ? undefined : `hsl(var(--clarity-clinical-${sem.tone}))` }}>
          <span className="clx-sr-status">{sem.label}: </span>{value ?? "—"}
        </span>
      )}
      {hint && !loading && <span className="clx-metric__hint">{hint}</span>}
      <span className="clx-visually-hidden">{sem.description}</span>
    </div>
  );
}

/* ============================================================
 * ClarityStatusCard
 * ============================================================ */
export function ClarityStatusCard({ title, tone = "neutral", detail, onOpen, actionLabel }: {
  title: string; tone?: ClinicalTone; detail?: ReactNode; onOpen?: () => void; actionLabel?: string;
}) {
  const sem = semanticsFor(tone);
  return (
    <div className="clx clx-card" role="group" aria-label={`${sem.label}: ${title}`}>
      <div style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
        <Icon name={sem.icon} className="clx-alert__icon" />
        <div style={{ display: "grid", gap: "0.25rem" }}>
          <strong>{title}</strong>
          <span className="clx-metric__hint">{detail ?? sem.description}</span>
          {onOpen && actionLabel && (
            <button className="clx clx-btn clx-btn--secondary" style={{ justifySelf: "start", marginTop: "0.5rem" }} onClick={onOpen}>
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * ClarityBadge & ClarityStatusChip
 * ============================================================ */
export function ClarityBadge({ children, tone = "neutral", icon }: { children: ReactNode; tone?: ClinicalTone; icon?: string }) {
  return (
    <span className={`clx clx-badge clx-badge--${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function ClarityStatusChip({ tone = "neutral", label, description }: { tone?: ClinicalTone; label?: string; description?: string }) {
  const sem = semanticsFor(tone);
  const text = label ?? sem.label;
  return (
    <span className={`clx clx-badge clx-badge--${sem.tone === "neutral" ? "neutral" : sem.tone}`}>
      <Icon name={sem.icon} size={13} />
      <span>{text}</span>
      <span className="clx-visually-hidden"> — {description ?? sem.description}</span>
    </span>
  );
}

export function ClarityPrescriptionChip({ state }: { state: PrescriptionState }) {
  const sem = prescriptionStateSemantics[state];
  return <ClarityStatusChip tone={sem.tone} label={sem.label} description={sem.description} />;
}

export function ClarityRiskChip({ level }: { level: RiskLevel }) {
  const sem = riskSemantics[level];
  return <ClarityStatusChip tone={sem.tone} label={sem.label} description={sem.description} />;
}

/* ============================================================
 * ClarityAlert & ClarityClinicalWarning
 * ============================================================ */
export function ClarityAlert({ tone = "information", title, children, onDismiss }: {
  tone?: ClinicalTone; title: string; children?: ReactNode; onDismiss?: () => void;
}) {
  const sem = semanticsFor(tone);
  return (
    <div className={`clx clx-alert clx-alert--${tone === "normal" ? "success" : tone === "abnormal" ? "warning" : tone}`} role={tone === "critical" || tone === "danger" ? "alert" : "status"}>
      <Icon name={sem.icon} className="clx-alert__icon" />
      <div style={{ flex: 1 }}>
        <p className="clx-alert__title">{title}</p>
        {children && <div className="clx-alert__body">{children}</div>}
      </div>
      {onDismiss && (
        <button className="clx clx-btn clx-btn--secondary" style={{ minHeight: "1.75rem", padding: "0.125rem 0.5rem" }} onClick={onDismiss} aria-label="Dismiss alert">
          <Icon name="X" size={14} />
        </button>
      )}
    </div>
  );
}

/** Blocking-style warning for clinically significant content. Includes an explicit acknowledgement when required. */
export function ClarityClinicalWarning({ title, children, requireAcknowledgement, onAcknowledge }: {
  title: string; children?: ReactNode; requireAcknowledgement?: boolean; onAcknowledge?: () => void;
}) {
  return (
    <div className="clx clx-clinical-warning" role="alert">
      <div style={{ display: "flex", gap: "0.625rem" }}>
        <Icon name="OctagonAlert" size={18} className="clx-alert__icon" />
        <div style={{ display: "grid", gap: "0.375rem", flex: 1 }}>
          <strong>{title}</strong>
          {children && <div className="clx-alert__body">{children}</div>}
          {requireAcknowledgement && (
            <button className="clx clx-btn clx-btn--secondary" style={{ justifySelf: "start" }} onClick={onAcknowledge}>
              I have read and understood this warning
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * ClarityConfirmationPanel (Clinical Safety Guardrail)
 * ============================================================ */
export function ClarityConfirmationPanel({ patientLabel, action, changes, warnings, missing, authority, confirmLabel = "Confirm", requireReason, onConfirm, onCancel }: {
  patientLabel: string; action: string; changes?: string[]; warnings?: string[]; missing?: string[];
  authority?: string; confirmLabel?: string; requireReason?: boolean;
  onConfirm: (reason?: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const blocked = (requireReason && reason.trim().length < 10) || (warnings !== undefined && warnings.length > 0 && !ack);
  return (
    <div className="clx clx-confirm" role="dialog" aria-label={`Confirm: ${action}`}>
      <strong>Patient: {patientLabel}</strong>
      <p style={{ margin: 0 }}>You are about to: <strong>{action}</strong></p>
      {changes && changes.length > 0 && (
        <div>
          <strong style={{ fontSize: "0.8em" }}>Material changes</strong>
          <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {missing && missing.length > 0 && <ClarityAlert tone="warning" title="Missing information">{missing.join(" · ")}</ClarityAlert>}
      {warnings && warnings.length > 0 && (
        <ClarityClinicalWarning title="Review these warnings before continuing">
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", fontWeight: 600 }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I have reviewed the warnings above
          </label>
        </ClarityClinicalWarning>
      )}
      {authority && <p style={{ margin: 0, color: "hsl(var(--clarity-text-muted))" }}>Acting as: {authority}</p>}
      {requireReason && (
        <label style={{ display: "grid", gap: "0.25rem", fontWeight: 600 }}>
          Reason (required, minimum 10 characters)
          <textarea className="clx" style={{ minHeight: "4.5rem", padding: "0.5rem", border: "1px solid hsl(var(--clarity-border-default))", borderRadius: "var(--clarity-radius-md)", font: "inherit" }} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
        <button className="clx clx-btn clx-btn--secondary" onClick={onCancel}>Cancel</button>
        <button className="clx clx-btn clx-btn--primary" disabled={blocked} onClick={() => onConfirm(requireReason ? reason : undefined)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
 * ClarityDataTable
 * ============================================================ */
export interface ClarityColumn<T> {
  key: string; header: string; sortable?: boolean; numeric?: boolean; width?: string;
  render: (row: T) => ReactNode; sortValue?: (row: T) => string | number;
}

export function ClarityDataTable<T>({ columns, rows, loading, caption, emptyTitle = "No records", emptyBody, onRowClick, maxRows }: {
  columns: ClarityColumn<T>[]; rows: T[]; loading?: boolean; caption: string;
  emptyTitle?: string; emptyBody?: string; onRowClick?: (row: T) => void; maxRows?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a), bv = col.sortValue!(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, columns]);
  const shown = maxRows ? sorted.slice(0, maxRows) : sorted;

  if (loading) {
    return <div role="status" aria-label={`Loading ${caption}`} className="clx">{[0, 1, 2].map((i) => <div key={i} className="clx clx-skeleton" style={{ height: "2.25rem", marginBottom: "0.375rem" }} />)}</div>;
  }
  if (shown.length === 0) {
    return <ClarityEmptyState title={emptyTitle} body={emptyBody} />;
  }
  return (
    <div style={{ overflow: "auto" }} tabIndex={0} role="region" aria-label={caption}>
      <table className="clx clx-table">
        <caption className="clx-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                {c.sortable ? (
                  <button style={{ all: "unset", cursor: "pointer", fontWeight: "inherit", display: "inline-flex", gap: "0.25rem" }}
                    onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}>
                    {c.header} {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} onClick={onRowClick ? () => onRowClick(row) : undefined} style={onRowClick ? { cursor: "pointer" } : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "clx-table__numeric" : undefined}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * ClarityEmptyState / ClarityErrorState / ClaritySkeleton
 * ============================================================ */
export function ClarityEmptyState({ title, body, action, onAction }: { title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="clx clx-empty">
      <Icon name="Info" size={22} className="clx-empty__icon" />
      <div className="clx-empty__title">{title}</div>
      {body && <div style={{ maxWidth: "26rem" }}>{body}</div>}
      {action && onAction && <button className="clx clx-btn clx-btn--secondary" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function ClarityErrorState({ title = "Something went wrong", detail, onRetry }: { title?: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="clx clx-empty" role="alert">
      <Icon name="OctagonAlert" size={22} className="clx-alert__icon" />
      <div className="clx-empty__title">{title}</div>
      {detail && <div style={{ maxWidth: "26rem" }}>{detail}</div>}
      {onRetry && <button className="clx clx-btn clx-btn--secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function ClaritySkeleton({ lines = 3, height = "1rem" }: { lines?: number; height?: string }) {
  return <div className="clx" role="status" aria-label="Loading content">{Array.from({ length: lines }, (_, i) => <div key={i} className="clx clx-skeleton" style={{ height, marginBottom: "0.5rem" }} />)}</div>;
}

/* ============================================================
 * ClarityPermissionGate & ClarityAuditIndicator
 * ============================================================ */
export function ClarityPermissionGate({ permitted, children, resource, reason }: { permitted: boolean; children: ReactNode; resource: string; reason?: string }) {
  if (permitted) return <>{children}</>;
  return (
    <div className="clx clx-permission-denied" role="note" aria-label={`Access to ${resource} not permitted`}>
      <Icon name="Lock" />
      <strong>Access not permitted</strong>
      <span>{reason ?? `You do not have permission to view ${resource}. This is enforced server-side.`}</span>
    </div>
  );
}

export function ClarityAuditIndicator({ action, timestamp }: { action: string; timestamp?: string }) {
  return (
    <span className="clx clx-audit-indicator" title={`Audited: ${action}${timestamp ? ` at ${timestamp}` : ""}`}>
      <Icon name="Eye" size={12} /> Audited: {action}
    </span>
  );
}

/* ============================================================
 * ClaritySensitiveDataShield
 * ============================================================ */
export function ClaritySensitiveDataShield({ value, label = "Sensitive", revealLabel = "Reveal", hideLabel = "Hide", onReveal }: {
  value: string; label?: string; revealLabel?: string; hideLabel?: string; onReveal?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className={`clx clx-shield ${revealed ? "clx-shield--revealed" : ""}`}>
      <Icon name="Eye" size={12} />
      {revealed ? (
        <>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
          <button style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => setRevealed(false)} aria-label={`${hideLabel} ${label.toLowerCase()}`}>{hideLabel}</button>
        </>
      ) : (
        <>
          <span aria-hidden="true">••••••</span>
          <span className="clx-visually-hidden">{label} hidden</span>
          <button style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => { setRevealed(true); onReveal?.(); }} aria-label={`${revealLabel} ${label.toLowerCase()}`}>{revealLabel}</button>
        </>
      )}
    </span>
  );
}

/* ============================================================
 * ClaritySaveStatus
 * ============================================================ */
export type SaveState = "saved" | "saving" | "unsaved" | "error";
export function ClaritySaveStatus({ state, at }: { state: SaveState; at?: string }) {
  const map: Record<SaveState, { icon: string; text: string; tone: ClinicalTone }> = {
    saved: { icon: "CheckCircle2", text: at ? `All changes saved · ${at}` : "All changes saved", tone: "success" },
    saving: { icon: "Clock", text: "Saving…", tone: "information" },
    unsaved: { icon: "AlertTriangle", text: "Unsaved changes", tone: "warning" },
    error: { icon: "OctagonAlert", text: "Save failed — retrying", tone: "danger" },
  };
  const s = map[state];
  return (
    <span className="clx clx-save-status" role="status" aria-live="polite">
      <Icon name={s.icon} size={13} />
      {s.text}
      <span className="clx-visually-hidden"> — {semanticsFor(s.tone).description}</span>
    </span>
  );
}

/* ============================================================
 * ClarityStepper
 * ============================================================ */
export function ClarityStepper({ steps, current, onStepClick }: {
  steps: readonly string[]; current: number; onStepClick?: (index: number) => void;
}) {
  return (
    <ol className="clx clx-stepper" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const content = (
          <>
            <span className="clx-stepper__dot" aria-hidden="true">{i < current ? <Icon name="Check" size={11} /> : i + 1}</span>
            <span>{label}</span>
          </>
        );
        return (
          <li key={label} className="clx-stepper__step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            {onStepClick ? <button style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={() => onStepClick(i)}>{content}</button> : content}
            <span className="clx-visually-hidden">{state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
 * ClarityTabs
 * ============================================================ */
export function ClarityTabs({ tabs, value, onChange, ariaLabel }: {
  tabs: readonly { id: string; label: string; disabled?: boolean }[]; value: string;
  onChange: (id: string) => void; ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === value);
    if (e.key === "ArrowRight") { const n = tabs[(idx + 1) % tabs.length]!; if (!n.disabled) onChange(n.id); refs.current[tabs.indexOf(n)]?.focus(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { const n = tabs[(idx - 1 + tabs.length) % tabs.length]!; if (!n.disabled) onChange(n.id); refs.current[tabs.indexOf(n)]?.focus(); e.preventDefault(); }
  };
  return (
    <div className="clx clx-tabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" className="clx-tab" aria-selected={value === t.id}
          disabled={t.disabled} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
 * ClarityModal / ClarityDrawer / ClarityPopover / ClarityTooltip
 * ============================================================ */
export function ClarityModal({ open, onClose, title, patientLabel, children }: {
  open: boolean; onClose: () => void; title: string; /** Wrong-patient protection: show patient identity inside clinical modals */
  patientLabel?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    globalThis.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="clx clx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="clx clx-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <button className="clx clx-btn clx-btn--secondary" style={{ minHeight: "1.75rem", padding: "0.125rem 0.5rem" }} onClick={onClose} aria-label="Close dialog"><Icon name="X" size={14} /></button>
        </div>
        {patientLabel && <div className="clx clx-badge clx-badge--information" style={{ marginBottom: "0.75rem" }}><Icon name="Pill" size={12} /> {patientLabel}</div>}
        {children}
      </div>
    </div>
  );
}

export function ClarityDrawer({ open, onClose, title, side = "right", children }: {
  open: boolean; onClose: () => void; title: string; side?: "left" | "right"; children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="clx clx-overlay" style={{ placeItems: "stretch end", padding: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`clx clx-drawer ${side === "left" ? "clx-drawer--left" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
          <button className="clx clx-btn clx-btn--secondary" style={{ minHeight: "1.75rem", padding: "0.125rem 0.5rem" }} onClick={onClose} aria-label="Close panel"><Icon name="X" size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ClarityPopover({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", zIndex: 50, marginTop: "0.375rem" }}>
      <div className="clx clx-card clx-card--elevated" style={{ padding: "0.625rem" }}>{children}</div>
      <button style={{ position: "fixed", inset: 0, opacity: 0, cursor: "default" }} aria-label="Close popover" onClick={onClose} />
    </div>
  );
}

export function ClarityTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }} tabIndex={0} aria-label={label} role="tooltip" title={label}>
      {children}
    </span>
  );
}

/* ============================================================
 * ClarityToast
 * ============================================================ */
interface Toast { id: number; tone: ClinicalTone; title: string; body?: string }
const ToastContext = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ClarityToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    globalThis.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="clx clx-toast-region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const sem = semanticsFor(t.tone);
          return (
            <div key={t.id} className="clx clx-toast">
              <Icon name={sem.icon} className="clx-alert__icon" />
              <div><strong>{t.title}</strong>{t.body && <div className="clx-metric__hint">{t.body}</div>}</div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useClarityToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: () => undefined };
}

/* ============================================================
 * ClarityFormSection / ClaritySmartField
 * ============================================================ */
export function ClarityFormSection({ title, description, required, children, hint }: {
  title: string; description?: string; required?: boolean; children: ReactNode; hint?: ReactNode;
}) {
  return (
    <fieldset className="clx" style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
      <legend style={{ fontWeight: 700, padding: 0 }}>
        {title}{required && <span aria-hidden="true"> *</span>}
        {required && <span className="clx-visually-hidden"> (required)</span>}
      </legend>
      {description && <p style={{ margin: 0, color: "hsl(var(--clarity-text-secondary))" }}>{description}</p>}
      {children}
      {hint && <p style={{ margin: 0, color: "hsl(var(--clarity-text-muted))", fontSize: "0.85em" }}>{hint}</p>}
    </fieldset>
  );
}

export function ClaritySmartField({ label, value, onChange, type = "text", required, error, hint, loading, placeholder, options, min, max, step }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean; error?: string; hint?: string; loading?: boolean; placeholder?: string;
  options?: readonly { value: string; label: string }[]; min?: number; max?: number; step?: number;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const common = { id, required, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, placeholder, min, max, step, style: { minHeight: "var(--clarity-density-control)", padding: "0.375rem 0.75rem", border: `1px solid hsl(${error ? "var(--clarity-status-danger)" : "var(--clarity-border-default)"})`, borderRadius: "var(--clarity-radius-md)", font: "inherit", background: "hsl(var(--clarity-bg-surface))", color: "inherit", width: "100%" } };
  return (
    <div className="clx" style={{ display: "grid", gap: "0.25rem" }}>
      <label htmlFor={id} style={{ fontWeight: 650 }}>
        {label}{required && <span aria-hidden="true"> *</span>}
        {required && <span className="clx-visually-hidden"> (required)</span>}
      </label>
      {loading ? (
        <div className="clx clx-skeleton" style={{ height: "var(--clarity-density-control)" }} />
      ) : type === "select" ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          {!required && <option value="">—</option>}
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea {...common} value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={{ ...common.style, minHeight: "6rem", resize: "vertical" }} />
      ) : (
        <input {...common} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <p id={`${id}-err`} style={{ margin: 0, color: "hsl(var(--clarity-status-danger))", fontWeight: 600 }} role="alert">{error}</p>}
      {!error && hint && <p id={`${id}-hint`} style={{ margin: 0, color: "hsl(var(--clarity-text-muted))", fontSize: "0.85em" }}>{hint}</p>}
    </div>
  );
}

/* ============================================================
 * ClarityPatientBanner (Clinical Patient Identity Banner)
 * ============================================================ */
export interface PatientBannerData {
  fullName: string; preferredName?: string; dateOfBirth: string; age: number;
  pronouns?: string; clinicId: string; identityVerified: boolean; careStatus: string;
  assignedClinician: string; allergiesSummary?: string; safeguardingIndicator?: RiskLevel;
  communicationNeeds?: string[]; reasonableAdjustments?: boolean; duplicateRecordWarning?: boolean;
  medicationSummary?: string; alerts?: readonly { tone: ClinicalTone; text: string }[];
}

export function ClarityPatientBanner({ data, onOpenFullRecord }: { data: PatientBannerData; onOpenFullRecord?: () => void }) {
  return (
    <header className="clx clx-patient-banner" role="region" aria-label="Patient identity banner">
      <div>
        <div className="clx-patient-banner__name">
          {data.fullName}
          {data.preferredName && data.preferredName !== data.fullName.split(" ")[0] && <span style={{ fontWeight: 400, color: "hsl(var(--clarity-text-secondary))" }}> (“{data.preferredName}”)</span>}
        </div>
        <div className="clx-patient-banner__facts">
          <span>DOB <strong>{data.dateOfBirth}</strong> · {data.age} yrs</span>
          {data.pronouns && <span>{data.pronouns}</span>}
          <span>Clinic ID <strong>{data.clinicId}</strong></span>
          <ClarityBadge tone={data.identityVerified ? "success" : "warning"} icon={data.identityVerified ? "BadgeCheck" : "AlertTriangle"}>
            {data.identityVerified ? "Identity verified" : "Identity not verified"}
          </ClarityBadge>
        </div>
      </div>
      <div className="clx-patient-banner__facts">
        <span>Care: <strong>{data.careStatus}</strong></span>
        <span>Clinician: <strong>{data.assignedClinician}</strong></span>
        {data.medicationSummary && <span>Medication: <strong>{data.medicationSummary}</strong></span>}
        {data.allergiesSummary && <ClarityBadge tone={data.allergiesSummary.toLowerCase().includes("no known") ? "normal" : "danger"} icon="AlertTriangle">{data.allergiesSummary}</ClarityBadge>}
        {data.safeguardingIndicator && <ClarityRiskChip level={data.safeguardingIndicator} />}
        {data.communicationNeeds && data.communicationNeeds.length > 0 && <ClarityBadge tone="information" icon="Info">Needs: {data.communicationNeeds.join(", ")}</ClarityBadge>}
        {data.reasonableAdjustments && <ClarityBadge tone="information" icon="CheckCircle2">Reasonable adjustments</ClarityBadge>}
        {data.duplicateRecordWarning && <ClarityBadge tone="warning" icon="AlertTriangle">Possible duplicate record</ClarityBadge>}
      </div>
      {data.alerts && data.alerts.length > 0 && (
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {data.alerts.map((a) => <ClarityStatusChip key={a.text} tone={a.tone} label={a.text} />)}
        </div>
      )}
      {onOpenFullRecord && <button className="clx clx-btn clx-btn--secondary" style={{ marginLeft: "auto" }} onClick={onOpenFullRecord}>Full record</button>}
    </header>
  );
}

/* ============================================================
 * ClarityTimeline
 * ============================================================ */
export interface TimelineEvent {
  id: string; date: string; type: string; title: string; tone?: ClinicalTone;
  author?: string; detail?: ReactNode; sourceHref?: string;
}

export function ClarityTimeline({ events, loading, emptyTitle = "No events recorded" }: {
  events: TimelineEvent[]; loading?: boolean; emptyTitle?: string;
}) {
  if (loading) return <ClaritySkeleton lines={5} height="3rem" />;
  if (events.length === 0) return <ClarityEmptyState title={emptyTitle} body="Events appear here as care progresses." />;
  return (
    <ol className="clx clx-timeline" style={{ listStyle: "none", margin: 0 }}>
      {events.map((e) => (
        <li key={e.id} className="clx-timeline__item">
          <span className={`clx-timeline__dot`} style={{ background: e.tone ? `hsl(var(--clarity-clinical-${e.tone}))` : "hsl(var(--clarity-border-strong))" }} aria-hidden="true" />
          <div className="clx-card" style={{ padding: "0.625rem 0.875rem", marginBottom: "0.375rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
              <ClarityBadge tone={e.tone ?? "neutral"}>{e.type}</ClarityBadge>
              <time style={{ color: "hsl(var(--clarity-text-muted))", fontVariantNumeric: "tabular-nums" }}>{e.date}</time>
              {e.author && <span style={{ color: "hsl(var(--clarity-text-muted))" }}>by {e.author}</span>}
            </div>
            <div style={{ fontWeight: 650, marginTop: "0.25rem" }}>{e.title}</div>
            {e.detail && <div className="clx-metric__hint" style={{ marginTop: "0.25rem" }}>{e.detail}</div>}
            {e.sourceHref && <a href={e.sourceHref} style={{ fontWeight: 600 }}>Open source record</a>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ============================================================
 * Shell: ClarityAppShell / ClaritySidebar / ClarityTopBar / ClarityPageHeader / ClarityBreadcrumbs
 * ============================================================ */
export function ClarityAppShell({ sidebar, topBar, children, sidebarOpen }: {
  sidebar: ReactNode; topBar: ReactNode; children: ReactNode; sidebarOpen?: boolean;
}) {
  return (
    <div className="clx clx-shell">
      <nav className="clx-clarity-sidebar-wrapper" aria-label="Primary">
        <div className="clx-sidebar" data-open={sidebarOpen ? "true" : undefined}>{sidebar}</div>
      </nav>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minWidth: 0 }}>
        {topBar}
        <main className="clx clx-main" id="clarity-main">{children}</main>
      </div>
    </div>
  );
}

export function ClaritySidebar({ header, groups }: { header?: ReactNode; groups: readonly { label: string; items: readonly { label: string; href: string; icon?: string; current?: boolean; badge?: string }[] }[] }) {
  return (
    <>
      {header}
      {groups.map((g) => (
        <div key={g.label} style={{ display: "grid", gap: "0.125rem" }}>
          <div style={{ fontSize: "0.7em", textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--clarity-text-muted))", fontWeight: 700, padding: "0.75rem 0.75rem 0.25rem" }}>{g.label}</div>
          {g.items.map((it) => (
            <a key={it.href} href={it.href} className="clx-sidebar__link" aria-current={it.current ? "page" : undefined}>
              {it.icon && <Icon name={it.icon} size={16} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && <ClarityBadge tone="information">{it.badge}</ClarityBadge>}
            </a>
          ))}
        </div>
      ))}
    </>
  );
}

export function ClarityTopBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <div className="clx clx-topbar" role="banner">
      {left}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>{center}</div>
      {right}
    </div>
  );
}

export function ClarityBreadcrumbs({ trail }: { trail: readonly { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: "0.85em", color: "hsl(var(--clarity-text-muted))" }}>
      <ol style={{ display: "flex", gap: "0.375rem", listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}>
        {trail.map((t, i) => (
          <li key={i} style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
            {i > 0 && <span aria-hidden="true">/</span>}
            {t.href ? <a href={t.href} style={{ color: "inherit" }}>{t.label}</a> : <span aria-current="page" style={{ fontWeight: 650, color: "hsl(var(--clarity-text-primary))" }}>{t.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ClarityPageHeader({ title, subtitle, actions, meta }: { title: string; subtitle?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: "14rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.35rem", letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ margin: "0.25rem 0 0", color: "hsl(var(--clarity-text-secondary))" }}>{subtitle}</p>}
        {meta && <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{meta}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}

/* ============================================================
 * ClarityCommandBar (Universal Command Centre)
 * ============================================================ */
export interface CommandItem {
  id: string; label: string; category: string; icon?: string; keywords?: string;
  perform?: () => void; href?: string;
}

export function ClarityCommandBar({ open, onClose, items, placeholder = "Search patients, tasks, actions…" }: {
  open: boolean; onClose: () => void; items: readonly CommandItem[]; placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQuery(""); setActive(0); inputRef.current?.focus(); } }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 9);
    const score = (item: CommandItem) => {
      const hay = `${item.label} ${item.category} ${item.keywords ?? ""}`.toLowerCase();
      if (hay.includes(q)) return 0;
      // simple typo tolerance: subsequence match
      let qi = 0;
      for (const ch of hay) if (ch === q[qi]) qi++;
      return qi === q.length ? 1 : 2;
    };
    return items.map((item) => ({ item, s: score(item) })).filter((x) => x.s < 2)
      .sort((a, b) => a.s - b.s).slice(0, 9).map((x) => x.item);
  }, [items, query]);

  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, results.length - 1))); }, [results.length]);
  useEffect(() => { listRef.current?.querySelectorAll(".clx-command__item")[active]?.scrollIntoView({ block: "nearest" }); }, [active]);

  if (!open) return null;
  const run = (item: CommandItem) => { onClose(); item.perform?.(); if (item.href) globalThis.location.assign(item.href); };
  return (
    <div className="clx clx-command-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="clx clx-command" role="dialog" aria-modal="true" aria-label="Command centre">
        <div style={{ display: "flex", alignItems: "center", padding: "0 0.75rem" }}>
          <Icon name="Search" size={16} />
          <input ref={inputRef} className="clx clx-command__input" value={query} placeholder={placeholder}
            aria-label="Search commands and records"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { setActive((a) => Math.min(a + 1, results.length - 1)); e.preventDefault(); }
              if (e.key === "ArrowUp") { setActive((a) => Math.max(a - 1, 0)); e.preventDefault(); }
              if (e.key === "Enter" && results[active]) { run(results[active]!); }
              if (e.key === "Escape") onClose();
            }} />
          <kbd style={{ fontSize: "0.75em", color: "hsl(var(--clarity-text-muted))" }}>esc</kbd>
        </div>
        <div className="clx-command__list" ref={listRef} role="listbox" aria-label="Results">
          {results.length === 0 && <div className="clx-empty"><div className="clx-empty__title">No matches</div><div>Try fewer characters, or a different category.</div></div>}
          {results.map((item, i) => (
            <div key={item.id} role="option" aria-selected={i === active} data-active={i === active} className="clx-command__item"
              onMouseEnter={() => setActive(i)} onClick={() => run(item)}>
              <Icon name={item.icon ?? "Search"} size={15} />
              <span>{item.label}</span>
              <span className="clx-command__category">{item.category}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid hsl(var(--clarity-border-default))", padding: "0.375rem 0.875rem", display: "flex", gap: "1rem", color: "hsl(var(--clarity-text-muted))", fontSize: "0.75em" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * ClarityContextPanel / ClaritySplitView / ClarityFilterBar / ClaritySearchBox
 * ============================================================ */
export function ClarityContextPanel({ title, sections, defaultOpen = true }: {
  title: string; sections: readonly { label: string; content: ReactNode }[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <aside className="clx" aria-label={title} style={{ width: open ? "17rem" : "2.25rem", transition: "width var(--clarity-motion-base)", borderLeft: "1px solid hsl(var(--clarity-border-default))", background: "hsl(var(--clarity-bg-subtle) / 0.5)", overflow: "hidden" }}>
      <button style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.75rem", fontWeight: 700 }}
        onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="clarity-context-body">
        <Icon name="ChevronDown" size={14} style={{ transform: open ? undefined : "rotate(-90deg)" }} />
        {open ? title : <span className="clx-visually-hidden">{title} — expand</span>}
      </button>
      {open && (
        <div id="clarity-context-body" style={{ display: "grid", gap: "0.75rem", padding: "0 0.75rem 0.75rem", fontSize: "0.9em" }}>
          {sections.map((s) => (
            <section key={s.label} aria-label={s.label}>
              <div style={{ fontSize: "0.75em", textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(var(--clarity-text-muted))", fontWeight: 700, marginBottom: "0.25rem" }}>{s.label}</div>
              {s.content}
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

export function ClaritySplitView({ primary, secondary, split = 50 }: { primary: ReactNode; secondary: ReactNode; split?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${split}% ${100 - split}%`, gap: "var(--clarity-density-gap)", minHeight: 0 }}>
      <div style={{ minWidth: 0 }}>{primary}</div>
      <div style={{ minWidth: 0 }}>{secondary}</div>
    </div>
  );
}

export function ClaritySearchBox({ value, onChange, label = "Search", placeholder }: { value: string; onChange: (v: string) => void; label?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="clx" style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Icon name="Search" size={15} style={{ position: "absolute", left: "0.75rem", color: "hsl(var(--clarity-text-muted))" }} />
      <input id={id} aria-label={label} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: "var(--clarity-density-control)", width: "100%", paddingLeft: "2.25rem", paddingRight: "0.75rem", border: "1px solid hsl(var(--clarity-border-default))", borderRadius: "999px", font: "inherit", background: "hsl(var(--clarity-bg-surface))", color: "inherit" }} />
    </div>
  );
}

export function ClarityFilterBar({ filters, onClear }: { filters: readonly { id: string; label: string; options: readonly { value: string; label: string }[]; value: string; onChange: (v: string) => void }[]; onClear?: () => void }) {
  return (
    <div className="clx" role="group" aria-label="Filters" style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", alignItems: "end" }}>
      {filters.map((f) => (
        <ClaritySmartField key={f.id} label={f.label} type="select" value={f.value} options={f.options} onChange={f.onChange} />
      ))}
      {onClear && <button className="clx clx-btn clx-btn--secondary" onClick={onClear}>Clear filters</button>}
    </div>
  );
}

export function ClarityActionMenu({ label, actions }: { label: string; actions: readonly { label: string; onSelect: () => void; disabled?: boolean; tone?: ClinicalTone }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button className="clx clx-btn clx-btn--secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <Icon name="ChevronDown" size={14} />
      </button>
      <ClarityPopover open={open} onClose={() => setOpen(false)}>
        <div role="menu" aria-label={label} style={{ display: "grid", minWidth: "12rem" }}>
          {actions.map((a) => (
            <button key={a.label} role="menuitem" disabled={a.disabled} className="clx"
              style={{ all: "unset", cursor: a.disabled ? "not-allowed" : "pointer", padding: "0.5rem 0.75rem", borderRadius: "var(--clarity-radius-sm)", fontWeight: 600, color: a.tone === "danger" ? "hsl(var(--clarity-status-danger))" : "inherit", opacity: a.disabled ? 0.5 : 1 }}
              onClick={() => { setOpen(false); a.onSelect(); }}>
              {a.label}
            </button>
          ))}
        </div>
      </ClarityPopover>
    </div>
  );
}

export function ClarityDateRangePicker({ from, to, onFromChange, onToChange, label = "Date range" }: {
  from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void; label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="clx" style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
      <ClaritySmartField label="From" type="date" value={from} onChange={onFromChange} />
      <ClaritySmartField label="To" type="date" value={to} onChange={onToChange} />
    </div>
  );
}

/* Visually-hidden helper (screen-reader only) */
const style = globalThis.document?.createElement?.("style");
if (style && !globalThis.document.getElementById("clarity-base-styles")) {
  style.id = "clarity-base-styles";
  style.textContent = `
    .clx-visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
    .clx-sr-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  `;
  globalThis.document.head.appendChild(style);
}
