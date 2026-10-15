-- Slice 1: referral → assessment (docs/delivery/SLICE1_DESIGN.md)
-- Additive only: safe to apply with `pnpm --filter @workspace/db push`.
-- Runtime in the slice branch uses the in-memory SliceStore; these tables are
-- the reviewed target schema for the Drizzle-backed store (gap register).

create table if not exists public.referrals (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  pathway text not null,
  referral_source text not null,
  presenting_concern text not null,
  validation_status text not null default 'PENDING_VALIDATION',
  validation_note text,
  assigned_clinician_profile_id text,
  appointment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referrals_patient_idx on public.referrals(patient_id);
create index if not exists referrals_validation_idx on public.referrals(validation_status);

create table if not exists public.journey_states (
  id text primary key,
  clinic_id text,
  patient_id text not null unique,
  stage text not null,
  version integer not null default 0,
  has_intake_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only: no updates, no deletes (optimistic concurrency via journey_states.version).
create table if not exists public.journey_transitions (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  from_stage text,
  to_stage text not null,
  command text not null,
  actor_profile_id text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists journey_transitions_patient_idx on public.journey_transitions(patient_id, created_at);

create table if not exists public.timeline_events (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null,
  actor_profile_id text,
  title text not null,
  summary text,
  visibility text not null,
  related_type text,
  related_id text,
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists timeline_events_patient_idx on public.timeline_events(patient_id, occurred_at desc);

create table if not exists public.consultation_consents (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  referral_id text not null,
  wording_version text not null,
  purpose text not null,
  consenting_party text not null,
  clinician_profile_id text not null,
  restrictions text,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  referral_id text not null,
  speaker text not null,
  start_ms integer not null,
  end_ms integer not null,
  segment_text text not null,
  excluded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists transcript_segments_referral_idx on public.transcript_segments(referral_id, start_ms);

create table if not exists public.ai_drafts (
  id text primary key,
  clinic_id text,
  patient_id text not null,
  referral_id text not null,
  status text not null,
  statements jsonb not null,
  missing_information jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  safety_findings jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_by_profile_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_drafts_patient_idx on public.ai_drafts(patient_id);