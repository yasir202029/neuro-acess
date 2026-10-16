import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auditEvent } from "../security/audit";
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
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return res.status(401).json({ error: "Authentication is required.", code: "AUTH_REQUIRED" });
  }
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, authorization: `Bearer ${token}` },
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

export default router;