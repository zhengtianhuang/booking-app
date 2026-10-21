-- Booking notifications → Google Apps Script (see apps-script/Code.gs).
-- Run in Supabase → SQL Editor AFTER schema.sql. Replace the two placeholders first;
-- the real values must never be committed (this repo is public).

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
alter table private.settings enable row level security; -- no policies: only definer functions read it

insert into private.settings (key, value) values
  ('webhook_url',    'PASTE-APPS-SCRIPT-WEB-APP-URL'),
  ('webhook_secret', 'PASTE-SHARED-SECRET')
on conflict (key) do update set value = excluded.value;

-- Fires after a booking is created or cancelled. pg_net sends the request after the
-- transaction commits and never blocks or fails the booking itself.
create or replace function private.notify_booking()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text;
  v_secret text;
  v_kind   text;
  v_body   jsonb;
begin
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    v_kind := 'booked';
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    v_kind := 'cancelled';
  else
    return new;
  end if;

  select value into v_url    from private.settings where key = 'webhook_url';
  select value into v_secret from private.settings where key = 'webhook_secret';
  if v_url is null or v_url like 'PASTE-%' then return new; end if;

  select jsonb_build_object(
    'secret',        v_secret,
    'type',          v_kind,
    'booking_id',    new.id,
    'start_at',      new.start_at,
    'end_at',        new.end_at,
    'invitee_name',  new.invitee_name,
    'invitee_email', new.invitee_email,
    'note',          new.note,
    'price',         new.price,
    'currency',      new.currency,
    'event_title',   et.title,
    'location',      et.location,
    'description',   et.description,
    'host_name',     coalesce(nullif(p.display_name, ''), p.username),
    'host_email',    u.email,
    'host_timezone', p.timezone
  ) into v_body
  from event_types et
  join profiles p   on p.id = et.user_id
  join auth.users u on u.id = p.id
  where et.id = new.event_type_id;

  perform net.http_post(
    url := v_url,
    body := v_body,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  );
  return new;
end;
$$;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status on public.bookings
  for each row execute function private.notify_booking();
