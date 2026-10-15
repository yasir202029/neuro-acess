import type { NextFunction, Request, Response } from "express";
import { hasPermission, type Permission, type PlatformRole, platformRoles } from "./roles";

type AuthenticatedUser = { id: string; email: string; role: PlatformRole; clinicId: string | null };
export type { AuthenticatedUser };
declare global { namespace Express { interface Request { user?: AuthenticatedUser; } } }

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || !supabaseUrl || !supabaseAnonKey) return res.status(401).json({ error: "Authentication is required." });
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, authorization: `Bearer ${token}` } });
    if (!response.ok) return res.status(401).json({ error: "Invalid or expired session." });
    const identity = (await response.json()) as { id?: string; email?: string; app_metadata?: { role?: unknown; clinic_id?: unknown } };
    const role = identity.app_metadata?.role;
    if (!identity.id || !identity.email || typeof role !== "string" || !platformRoles.includes(role as PlatformRole)) return res.status(403).json({ error: "No authorised platform role is assigned." });
    req.user = { id: identity.id, email: identity.email, role: role as PlatformRole, clinicId: typeof identity.app_metadata?.clinic_id === "string" ? identity.app_metadata.clinic_id : null };
    return next();
  } catch { return res.status(503).json({ error: "Authentication service is unavailable." }); }
}

export const requirePermission = (...required: Permission[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Authentication is required." });
  if (!required.every((permission) => hasPermission(req.user!.role, permission))) return res.status(403).json({ error: "You are not permitted to perform this action." });
  return next();
};
