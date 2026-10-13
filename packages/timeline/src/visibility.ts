/**
 * Visibility levels for timeline events. These are enforced in the query layer,
 * not merely by hiding elements in the UI. A viewer can only see events at or
 * below their clearance.
 */
export const visibilityLevels = [
  "PATIENT", // safe to show the patient
  "ASSIGNED_TEAM", // the patient's assigned clinical team
  "CLINICAL_ORG", // any clinical staff in the organisation
  "ADMIN", // operations staff
  "FINANCE", // finance staff
  "RESTRICTED", // governance / break-glass only
] as const;

export type VisibilityLevel = (typeof visibilityLevels)[number];

/** Ordered from most-open to most-restricted; lower index = wider audience. */
const clearanceOrder: readonly VisibilityLevel[] = [
  "PATIENT",
  "ASSIGNED_TEAM",
  "CLINICAL_ORG",
  "ADMIN",
  "FINANCE",
  "RESTRICTED",
];

/** The clearance a viewer holds. */
export type ViewerClearance =
  | { readonly kind: "PATIENT" }
  | { readonly kind: "ASSIGNED_TEAM" }
  | { readonly kind: "CLINICAL_ORG" }
  | { readonly kind: "ADMIN" }
  | { readonly kind: "FINANCE" }
  | { readonly kind: "RESTRICTED" };

export function clearanceRank(level: VisibilityLevel): number {
  return clearanceOrder.indexOf(level);
}

/**
 * A viewer may see an event iff their clearance rank is >= the event's
 * visibility rank (i.e. they are at least as privileged as the event requires).
 * Deny-by-default: unknown levels are treated as RESTRICTED.
 */
export function canViewerSeeEvent(viewer: ViewerClearance, eventVisibility: VisibilityLevel): boolean {
  const eventRank = clearanceRank(eventVisibility);
  if (eventRank < 0) return false; // unknown -> restricted
  const viewerRank = clearanceRank(viewer.kind);
  return viewerRank >= eventRank;
}
