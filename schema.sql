-- Slotly schema — paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: drops and recreates the functions/policies, keeps tables if they exist.

create extension if not exists btree_gist;

-- ---------- tables ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  display_name text not null default '',
  timezone     text not null default 'Australia/Melbourne',
  created_at   timestamptz not null default now()
);

create table if not exists public.event_types (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  title        text not null,
  description  text not null default '',
  duration_min int  not null check (duration_min between 5 and 480),
  buffer_min   int  not null default 10 check (buffer_min between 0 and 120), -- gap kept free around each booking
  location     text not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (user_id, slug)
);
-- added 2026-10-21; for databases created before buffer_min existed
alter table public.event_types add column if not exists buffer_min int not null default 10
  check (buffer_min between 0 and 120);

-- Weekly hours, in the host's own timezone. weekday: 0 = Sunday … 6 = Saturday.
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  event_type_id  uuid not null references public.event_types(id) on delete cascade,
  host_id        uuid not null references public.profiles(id) on delete cascade,
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  invitee_name   text not null,
  invitee_email  text not null,
  note           text not null default '',
  status         text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at     timestamptz not null default now(),
  -- Database-level guarantee: one host can never have two overlapping confirmed bookings.
  constraint no_double_booking exclude using gist (
    host_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed')
);

-- ---------- row level security ----------
alter table public.profiles     enable row level security;
alter table public.event_types  enable row level security;
alter table public.availability enable row level security;
alter table public.bookings     enable row level security;

drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles own write"   on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles own write"   on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "event_types public read" on public.event_types;
drop policy if exists "event_types own write"   on public.event_types;
create policy "event_types public read" on public.event_types for select
  using (active or auth.uid() = user_id);
create policy "event_types own write"   on public.event_types for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "availability public read" on public.availability;
drop policy if exists "availability own write"   on public.availability;
create policy "availability public read" on public.availability for select using (true);
create policy "availability own write"   on public.availability for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bookings hold invitee names/emails, so only the host can see them.
-- Invitees create bookings through book_slot() below, never by direct insert.
drop policy if exists "bookings host read"   on public.bookings;
drop policy if exists "bookings host update" on public.bookings;
create policy "bookings host read"   on public.bookings for select using (auth.uid() = host_id);
create policy "bookings host update" on public.bookings for update
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- ---------- public RPCs ----------
-- Busy intervals for a host (times only, no invitee details), for drawing free slots.
create or replace function public.get_busy(p_host uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.start_at, b.end_at
  from bookings b
  where b.host_id = p_host
    and b.status = 'confirmed'
    and b.start_at < p_to
    and b.end_at > p_from;
$$;

-- Books a slot after re-checking everything server side, so a modified client can't
-- book outside the host's hours, in the past, or on top of another booking.
create or replace function public.book_slot(
  p_event_type uuid, p_start timestamptz,
  p_name text, p_email text, p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  et      event_types;
  tz      text;
  v_end   timestamptz;
  l_start timestamp;
  l_end   timestamp;
  v_id    uuid;
begin
  select * into et from event_types where id = p_event_type and active;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  if coalesce(trim(p_name), '') = '' or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INVITEE';
  end if;
  if p_start < now() + interval '5 minutes' then raise exception 'SLOT_IN_PAST'; end if;
  if p_start > now() + interval '90 days'  then raise exception 'SLOT_TOO_FAR'; end if;

  select timezone into tz from profiles where id = et.user_id;
  v_end   := p_start + make_interval(mins => et.duration_min);
  l_start := p_start at time zone tz;
  l_end   := v_end   at time zone tz;

  if l_start::date <> l_end::date and l_end::time <> time '00:00' then
    raise exception 'SLOT_OUTSIDE_HOURS';
  end if;
  if not exists (
    select 1 from availability a
    where a.user_id = et.user_id
      and a.weekday = extract(dow from l_start)::int
      and a.start_time <= l_start::time
      -- an end_time of 23:59 means "until midnight", so a slot ending at 00:00 fits it
      and case when l_end::time = time '00:00' then a.end_time = time '23:59'
               else a.end_time >= l_end::time end
  ) then
    raise exception 'SLOT_OUTSIDE_HOURS';
  end if;

  -- Keep buffer_min free on both sides of every booking. The exclusion constraint only
  -- stops true overlaps, so serialize per host to make this check race-free.
  perform pg_advisory_xact_lock(hashtext(et.user_id::text));
  if et.buffer_min > 0 and exists (
    select 1 from bookings b
    where b.host_id = et.user_id and b.status = 'confirmed'
      and b.start_at < v_end + make_interval(mins => et.buffer_min)
      and b.end_at   > p_start - make_interval(mins => et.buffer_min)
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  begin
    insert into bookings (event_type_id, host_id, start_at, end_at, invitee_name, invitee_email, note)
    values (et.id, et.user_id, p_start, v_end, trim(p_name), lower(trim(p_email)), coalesce(p_note, ''))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_id;
end;
$$;

grant execute on function public.get_busy(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, text, text, text) to anon, authenticated;

-- Explicit table grants (RLS above still decides which rows), so this doesn't depend
-- on the project's "automatically expose new tables" setting.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.event_types, public.availability to anon, authenticated;
grant insert, update, delete on public.profiles, public.event_types, public.availability to authenticated;
grant select, update on public.bookings to authenticated;
