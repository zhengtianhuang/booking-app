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
-- added 2026-10-21: optional price shown to invitees (null = free). Display only, no payment.
alter table public.event_types add column if not exists price numeric(10,2) check (price >= 0);
alter table public.event_types add column if not exists currency text not null default 'AUD'
  check (currency ~ '^[A-Z]{3}$');

-- Weekly hours, in the host's own timezone. weekday: 0 = Sunday … 6 = Saturday.
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);

-- added 2026-10-24: date-specific hours. If a date has any rows here, they replace the
-- weekly hours for that date. A row with null times means "closed that day".
create table if not exists public.date_overrides (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  start_time time,
  end_time   time,
  check ((start_time is null and end_time is null) or end_time > start_time)
);
create index if not exists date_overrides_user_day on public.date_overrides (user_id, day);

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
  price          numeric(10,2),             -- snapshot of the event type's price when booked
  currency       text,
  constraint no_double_booking exclude using gist (
    host_id with =,
    tstzrange(start_at, end_at) with &&
  ) where (status = 'confirmed')
);

alter table public.bookings add column if not exists price numeric(10,2);
alter table public.bookings add column if not exists currency text;

-- added 2026-10-23: private price links. Each link shows a chosen set of event types with its
-- own price/currency (e.g. one link in TWD for Taiwan, one in AUD). The token is random, so a
-- link can't be guessed; there is no public read policy — invitees go through get_price_link().
create table if not exists public.price_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text unique not null default substr(md5(gen_random_uuid()::text), 1, 12),
  name       text not null,                -- host-only label, never shown to invitees
  created_at timestamptz not null default now()
);
create table if not exists public.price_link_items (
  link_id       uuid not null references public.price_links(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  price         numeric(10,2) check (price >= 0),   -- null = free
  currency      text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  primary key (link_id, event_type_id)
);
-- false = hidden from the public page; bookable only through a price link
alter table public.event_types add column if not exists listed boolean not null default true;
alter table public.bookings add column if not exists price_link_id uuid
  references public.price_links(id) on delete set null;

-- ---------- row level security ----------
alter table public.profiles     enable row level security;
alter table public.event_types  enable row level security;
alter table public.availability enable row level security;
alter table public.date_overrides enable row level security;
alter table public.bookings     enable row level security;
alter table public.price_links      enable row level security;
alter table public.price_link_items enable row level security;

drop policy if exists "price_links own" on public.price_links;
create policy "price_links own" on public.price_links for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "price_link_items own" on public.price_link_items;
create policy "price_link_items own" on public.price_link_items for all
  using (exists (select 1 from price_links l where l.id = link_id and l.user_id = auth.uid()))
  with check (exists (select 1 from price_links l join event_types e on e.user_id = l.user_id
                      where l.id = link_id and e.id = event_type_id and l.user_id = auth.uid()));

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

drop policy if exists "date_overrides public read" on public.date_overrides;
drop policy if exists "date_overrides own write"   on public.date_overrides;
create policy "date_overrides public read" on public.date_overrides for select using (true);
create policy "date_overrides own write"   on public.date_overrides for all
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

-- Public view of one price link: the host and the link's active event types at the link's prices.
create or replace function public.get_price_link(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'host', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'timezone', p.timezone),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) || jsonb_build_object('price', i.price, 'currency', i.currency) order by e.created_at)
      from price_link_items i join event_types e on e.id = i.event_type_id
      where i.link_id = l.id and e.active), '[]'::jsonb))
  from price_links l join profiles p on p.id = l.user_id
  where l.token = p_token;
$$;

-- Books a slot after re-checking everything server side, so a modified client can't
-- book outside the host's hours, in the past, or on top of another booking.
drop function if exists public.book_slot(uuid, timestamptz, text, text, text);
create or replace function public.book_slot(
  p_event_type uuid, p_start timestamptz,
  p_name text, p_email text, p_note text default '', p_link text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  et      event_types;
  tz      text;
  v_end   timestamptz;
  l_start timestamp;
  l_end   timestamp;
  v_id    uuid;
  v_link  uuid;
begin
  select * into et from event_types where id = p_event_type and active;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  -- The price always comes from the server: the link's price if booked through a link,
  -- otherwise the event type's own price (and unlisted event types need a link).
  if p_link is not null then
    select l.id, i.price, i.currency into v_link, et.price, et.currency
    from price_links l join price_link_items i on i.link_id = l.id
    where l.token = p_link and i.event_type_id = et.id;
    if v_link is null then raise exception 'EVENT_NOT_FOUND'; end if;
  elsif not et.listed then
    raise exception 'EVENT_NOT_FOUND';
  end if;

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
  -- Date-specific hours replace the weekly hours for that date.
  -- An end_time of 23:59 means "until midnight", so a slot ending at 00:00 fits it.
  if not exists (
    select 1 from (
      select o.start_time, o.end_time from date_overrides o
      where o.user_id = et.user_id and o.day = l_start::date and o.start_time is not null
      union all
      select a.start_time, a.end_time from availability a
      where a.user_id = et.user_id
        and a.weekday = extract(dow from l_start)::int
        and not exists (select 1 from date_overrides o where o.user_id = et.user_id and o.day = l_start::date)
    ) h
    where h.start_time <= l_start::time
      and case when l_end::time = time '00:00' then h.end_time = time '23:59'
               else h.end_time >= l_end::time end
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
    insert into bookings (event_type_id, host_id, start_at, end_at, invitee_name, invitee_email, note, price, currency, price_link_id)
    values (et.id, et.user_id, p_start, v_end, trim(p_name), lower(trim(p_email)), coalesce(p_note, ''), et.price, et.currency, v_link)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_id;
end;
$$;

grant execute on function public.get_busy(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_slot(uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.get_price_link(text) to anon, authenticated;

-- Explicit table grants (RLS above still decides which rows), so this doesn't depend
-- on the project's "automatically expose new tables" setting.
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.event_types, public.availability, public.date_overrides to anon, authenticated;
grant insert, update, delete on public.profiles, public.event_types, public.availability, public.date_overrides to authenticated;
grant select, update on public.bookings to authenticated;
grant select, insert, update, delete on public.price_links, public.price_link_items to authenticated;
