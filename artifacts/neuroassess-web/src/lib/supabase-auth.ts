import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase auth integration.
 *
 * When NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set
 * the helpers degrade gracefully: the app falls back to the synthetic dev
 * session (see platform/session.tsx) and no network calls are made.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    if (!supabaseConfigured) {
      throw new Error("Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
    }
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export interface SupabaseSession {
  userId: string;
  email: string;
  accessToken: string;
}

function toSupabaseSession(session: Session | null): SupabaseSession | null {
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    accessToken: session.access_token,
  };
}

/** Current session, or null when signed out / unconfigured. */
export async function getSupabaseSession(): Promise<SupabaseSession | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getClient().auth.getSession();
  if (error) return null;
  return toSupabaseSession(data.session);
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function onSupabaseAuthChange(
  listener: (session: SupabaseSession | null) => void,
): () => void {
  if (!supabaseConfigured) return () => undefined;
  const { data } = getClient().auth.onAuthStateChange((_event, session) => {
    listener(toSupabaseSession(session));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutSupabase(): Promise<void> {
  if (!supabaseConfigured) return;
  await getClient().auth.signOut();
}

type SupabaseAuthResult = { ok: true } | { ok: false; message: string };

/** Request a passwordless magic-link sign-in email. */
export async function requestMagicLink(email: string): Promise<SupabaseAuthResult> {
  if (!supabaseConfigured) {
    // Dev fallback: report success so the synthetic session flow still works.
    return { ok: true };
  }
  const { error } = await getClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${globalThis.location.origin}${globalThis.location.pathname}` },
  });
  if (!error) return { ok: true };
  return { ok: false, message: error.message };
}