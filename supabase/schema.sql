
create extension if not exists pgcrypto;

create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text,
 max_points numeric not null default 20,
 deadline timestamptz,
 rules jsonb not null default '[]'::jsonb,
 public_token text unique not null,
 status text not null default 'published',
 created_at timestamptz not null default now()
);

create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 student_name text not null,
 file_path text not null,
 points numeric,
 grade numeric,
 status text not null default 'queued',
 details jsonb,
 error text,
 created_at timestamptz not null default now()
);

alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- The backend uses the Supabase service role. Do NOT expose the service role key
-- in GitHub Pages JavaScript.
-- Keep the Storage bucket private.
