-- Google Calendar + Meet: every booking becomes an event with its own Meet link on the
-- host's own Google Calendar. Run in Supabase → SQL Editor AFTER schema.sql and
-- notifications.sql. Then deploy supabase/functions/google (see README).
--
-- Flow: bookings trigger (notifications.sql) → pg_net → Edge Function "google"
--   → creates / deletes the host's calendar event → saves meet_url on the booking
--   → forwards the same payload (+ meet_url) to the Apps Script that sends the emails.
-- Hosts who haven't connected Google just get the emails, as before.

-- Settings the Edge Function reads (it connects to the database directly, so nothing
-- secret lives in the function code or this public repo). Replace the placeholders.
insert into private.settings (key, value) values
  ('google_client_id',     'PASTE-GOOGLE-CLIENT-ID'),
  ('google_client_secret', 'PASTE-GOOGLE-CLIENT-SECRET'),
  ('app_url',              'https://zhengtianhuang.github.io/booking-app/')
on conflict (key) do nothing;

-- The trigger used to call Apps Script directly. Keep that URL as the forward target,
-- and point the trigger at the Edge Function instead.
insert into private.settings (key, value)
  select 'apps_script_url', value from private.settings where key = 'webhook_url' and value like 'https://script.google.com/%'
on conflict (key) do nothing;
update private.settings set value = 'https://stkwjmhkcnpxlunghipr.supabase.co/functions/v1/google'
  where key = 'webhook_url';

create table if not exists private.google_tokens (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  email         text not null,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);
create table if not exists private.oauth_states (
  state      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.google_tokens enable row level security;
alter table private.oauth_states  enable row level security;

alter table public.bookings add column if not exists meet_url text;
alter table public.bookings add column if not exists gcal_event_id text;

-- Logged-in host: which Google account is connected (null = none).
create or replace function public.my_google()
returns text language sql stable security definer set search_path = public as $$
  select email from private.google_tokens where user_id = auth.uid();
$$;

-- Logged-in host: one-time state for the Google sign-in redirect (valid 15 minutes).
create or replace function public.google_oauth_state()
returns text language plpgsql security definer set search_path = public as $$
declare v text := md5(gen_random_uuid()::text || clock_timestamp()::text);
begin
  if auth.uid() is null then raise exception 'NOT_LOGGED_IN'; end if;
  delete from private.oauth_states where created_at < now() - interval '15 minutes';
  insert into private.oauth_states (state, user_id) values (v, auth.uid());
  return v;
end;
$$;

create or replace function public.google_disconnect()
returns void language sql security definer set search_path = public as $$
  delete from private.google_tokens where user_id = auth.uid();
$$;

-- Invitee's success page polls this for the Meet link (the booking id is an unguessable uuid).
create or replace function public.booking_meet(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select meet_url from bookings where id = p_id;
$$;

revoke all on function public.my_google(), public.google_oauth_state(), public.google_disconnect() from public, anon;
grant execute on function public.my_google(), public.google_oauth_state(), public.google_disconnect() to authenticated;
grant execute on function public.booking_meet(uuid) to anon, authenticated;
