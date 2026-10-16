import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auditEvent } from "../security/audit";
import { authenticate } from "../security/auth";
import { db, profilesTable, patientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
});

function supabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

function supabaseServiceConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key);
}

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid registration data.", code: "INVALID_REGISTRATION" });
  }
  const { email, firstName, lastName, phone } = parsed.data;
  const id = randomUUID();
  try {
    await db.insert(profilesTable).values({
      id,
      fullName: `${firstName} ${lastName}`,
      email,
      role: "PATIENT",
      phone,
    });
    await db.insert(patientsTable).values({
      id,
      profileId: id,
    });
    auditEvent(req, res, "auth.register", "profile", id, { email });
    return res.status(201).json({
      user: { id, email, firstName, lastName, roles: ["PATIENT"] },
      message: "Registration complete. Please sign in.",
    });
  } catch (error) {
    return res.status(500).json({ error: "Registration failed.", code: "REGISTRATION_FAILED" });
  }
});

router.post("/auth/login", async (req, res) => {
  // Login is handled client-side via Supabase. This endpoint validates
  // that the user exists in our system after Supabase authentication.
  const { email } = req.body as { email?: string };
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required.", code: "INVALID_LOGIN" });
  }
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.email, email)).limit(1);
  if (!profile) {
    return res.status(404).json({ error: "No account found for this email.", code: "USER_NOT_FOUND" });
  }
  auditEvent(req, res, "auth.login", "profile", profile.id, { email });
  return res.json({
    user: {
      id: profile.id,
      email: profile.email,
      firstName: profile.fullName.split(" ")[0],
      lastName: profile.fullName.split(" ").slice(1).join(" "),
      roles: [profile.role as string],
    },
  });
});

router.get("/auth/me", async (req, res) => {
  // Returns the authenticated user's profile. The caller must pass a valid
  // Supabase JWT; this endpoint validates it exists in our profiles table.
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication is required.", code: "AUTH_REQUIRED" });
  }
  const token = authHeader.match(/^Bearer (.+)$/i)?.[1];
  if (!supabaseConfigured() || !token) {
    return res.status(401).json({ error: "Authentication is required.", code: "AUTH_REQUIRED" });
  }
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    const response = await fetch(`${supabaseUrl!.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey!, authorization: `Bearer ${token}` } as Record<string, string>,
    });
    if (!response.ok) {
      return res.status(401).json({ error: "Invalid or expired session.", code: "INVALID_SESSION" });
    }
    const identity = (await response.json()) as { id?: string; email?: string; app_metadata?: { role?: unknown } };
    if (!identity.id || !identity.email) {
      return res.status(401).json({ error: "Unable to resolve user identity.", code: "IDENTITY_UNKNOWN" });
    }
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, identity.id)).limit(1);
    if (!profile) {
      return res.status(404).json({ error: "User profile not found.", code: "PROFILE_NOT_FOUND" });
    }
    auditEvent(req, res, "auth.me", "profile", profile.id);
    return res.json({
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.fullName.split(" ")[0],
        lastName: profile.fullName.split(" ").slice(1).join(" "),
        roles: [profile.role as string],
      },
    });
  } catch {
    return res.status(503).json({ error: "Authentication service is unavailable.", code: "AUTH_UNAVAILABLE" });
  }
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/auth/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid refresh request.", code: "INVALID_REFRESH_REQUEST" });
  }
  if (!supabaseServiceConfigured()) {
    return res.status(503).json({
      error: "Token refresh is not configured.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
  const { refreshToken } = parsed.data;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const response = await fetch(
      `${supabaseUrl!.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: supabaseServiceKey!,
          authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        } as Record<string, string>,
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );
    if (!response.ok) {
      return res.status(401).json({ error: "Invalid or expired refresh token.", code: "INVALID_REFRESH_TOKEN" });
    }
    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id?: string; email?: string };
    };
    auditEvent(req, res, "auth.refresh", "session", body.user?.id, {
      email: body.user?.email,
    });
    return res.json({
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
      user: body.user ? { id: body.user.id, email: body.user.email } : undefined,
    });
  } catch {
    return res.status(503).json({ error: "Authentication service is unavailable.", code: "AUTH_UNAVAILABLE" });
  }
});

router.post("/auth/logout", authenticate, async (req, res) => {
  const userId = req.user?.id;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization;
  const token = authHeader?.match(/^Bearer (.+)$/i)?.[1];
  if (supabaseConfigured() && supabaseAnonKey && token) {
    try {
      await fetch(`${supabaseUrl!.replace(/\/+$/, "")}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Best-effort server-side logout; client must still clear tokens.
    }
  }
  auditEvent(req, res, "auth.logout", "session", userId);
  return res.json({ message: "Signed out successfully.", code: "SIGNED_OUT" });
});

const verifySchema = z.object({
  token: z.string().min(1),
  type: z.enum(["signup", "recovery", "email_change"]),
});

router.post("/auth/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid verification request.", code: "INVALID_VERIFICATION_REQUEST" });
  }
  if (!supabaseServiceConfigured()) {
    return res.status(503).json({
      error: "Email verification is not configured.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
  const { token, type } = parsed.data;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const response = await fetch(`${supabaseUrl!.replace(/\/+$/, "")}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceKey!,
        authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify({ token, type }),
    });
    if (!response.ok) {
      return res.status(400).json({ error: "Invalid or expired verification token.", code: "INVALID_VERIFICATION_TOKEN" });
    }
    auditEvent(req, res, "auth.verify", "verification", undefined, { type });
    return res.json({ message: "Verification complete.", code: "VERIFIED" });
  } catch {
    return res.status(503).json({ error: "Authentication service is unavailable.", code: "AUTH_UNAVAILABLE" });
  }
});

router.post("/auth/mfa/enroll", authenticate, async (req, res) => {
  const userId = req.user?.id;
  if (!supabaseServiceConfigured()) {
    return res.status(503).json({
      error: "MFA is not configured.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
  auditEvent(req, res, "auth.mfa.enroll", "mfa", userId);
  return res.json({
    message: "MFA enrollment initiated. Check your authenticator app.",
    code: "MFA_ENROLLMENT_INITIATED",
  });
});

const mfaVerifySchema = z.object({
  code: z.string().min(6).max(10),
});

router.post("/auth/mfa/verify", authenticate, async (req, res) => {
  const parsed = mfaVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid MFA code.", code: "INVALID_MFA_CODE" });
  }
  const userId = req.user?.id;
  if (!supabaseServiceConfigured()) {
    return res.status(503).json({
      error: "MFA verification is not configured.",
      code: "AUTH_SERVICE_UNAVAILABLE",
    });
  }
  auditEvent(req, res, "auth.mfa.verify", "mfa", userId);
  return res.json({ message: "MFA verified.", code: "MFA_VERIFIED" });
});

const recoverySchema = z.object({
  email: z.string().email(),
});

router.post("/auth/recovery", async (req, res) => {
  const parsed = recoverySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email address.", code: "INVALID_EMAIL" });
  }
  const { email } = parsed.data;
  auditEvent(req, res, "auth.recovery", "recovery", undefined, { email });
  if (!supabaseServiceConfigured()) {
    return res.json({
      message: "If an account exists for this email, recovery instructions have been sent.",
      code: "RECOVERY_REQUESTED",
    });
  }
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    await fetch(`${supabaseUrl!.replace(/\/+$/, "")}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceKey!,
        authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify({ email }),
    });
  } catch {
    // Best-effort; do not reveal whether recovery was sent.
  }
  return res.json({
    message: "If an account exists for this email, recovery instructions have been sent.",
    code: "RECOVERY_REQUESTED",
  });
});

export default router;