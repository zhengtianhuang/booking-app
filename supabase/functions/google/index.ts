// Slotly ↔ Google Calendar + Meet. Deploy with "Verify JWT" OFF: Google's redirect and the
// database trigger can't send a Supabase JWT. Requests are checked by the OAuth state
// (GET) or the shared webhook secret (POST) instead.
//
// GET  ?code&state  Google's OAuth redirect after a host clicks "Connect Google".
// POST {secret, type, booking_id, ...}  From the bookings trigger (notifications.sql).
//      Creates/deletes the host's calendar event with a Meet link, then forwards the
//      payload (+ meet_url) to the Apps Script that sends the emails.
import postgres from "npm:postgres@3.4.4";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const SELF_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google`;
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function settings(): Promise<Record<string, string>> {
  const rows = await sql`select key, value from private.settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function tokenRequest(s: Record<string, string>, params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: s.google_client_id, client_secret: s.google_client_secret, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(`token: ${data.error} ${data.error_description ?? ""}`), { code: data.error });
  return data;
}

async function onOAuthRedirect(url: URL): Promise<Response> {
  const s = await settings();
  const back = (status: string) => Response.redirect(`${s.app_url}?google=${status}#/dashboard/profile`, 302);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const [st] = await sql`delete from private.oauth_states where state = ${state}
    and created_at > now() - interval '15 minutes' returning user_id`;
  if (!st || !code) return back("error");
  try {
    const tok = await tokenRequest(s, { code, grant_type: "authorization_code", redirect_uri: SELF_URL });
    if (!tok.refresh_token) return back("error");
    const me = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    })).json();
    await sql`insert into private.google_tokens (user_id, email, refresh_token)
      values (${st.user_id}, ${me.email ?? "?"}, ${tok.refresh_token})
      on conflict (user_id) do update set email = excluded.email, refresh_token = excluded.refresh_token, updated_at = now()`;
    return back("connected");
  } catch (e) {
    console.error(e);
    return back("error");
  }
}

async function accessToken(s: Record<string, string>, hostId: string): Promise<string | null> {
  const [row] = await sql`select refresh_token from private.google_tokens where user_id = ${hostId}`;
  if (!row) return null;
  try {
    return (await tokenRequest(s, { refresh_token: row.refresh_token, grant_type: "refresh_token" })).access_token;
  } catch (e) {
    // Host revoked access in their Google account: forget the token so the UI shows "not connected".
    if ((e as { code?: string }).code === "invalid_grant") await sql`delete from private.google_tokens where user_id = ${hostId}`;
    throw e;
  }
}

async function onBookingChange(d: Record<string, unknown>, s: Record<string, string>) {
  const [b] = await sql`select host_id, gcal_event_id from bookings where id = ${d.booking_id as string}`;
  if (!b) return;
  const token = await accessToken(s, b.host_id);
  if (!token) return;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (d.type === "booked") {
    // sendUpdates=none: the invitee is on the guest list (so they can join without knocking)
    // but Google doesn't email them — the Apps Script confirmation already does, with the link.
    const res = await fetch(`${CAL}?conferenceDataVersion=1&sendUpdates=none`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        summary: `${d.event_title} — ${d.invitee_name}`,
        description: [d.note, d.description].filter(Boolean).join("\n\n"),
        location: d.location || undefined,
        start: { dateTime: d.start_at },
        end: { dateTime: d.end_at },
        attendees: [{ email: d.invitee_email, displayName: d.invitee_name }],
        conferenceData: { createRequest: { requestId: d.booking_id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      }),
    });
    const ev = await res.json();
    if (!res.ok) throw new Error(`calendar insert: ${JSON.stringify(ev.error)}`);
    const meet = ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((p: { entryPointType: string }) => p.entryPointType === "video")?.uri ?? null;
    await sql`update bookings set gcal_event_id = ${ev.id}, meet_url = ${meet} where id = ${d.booking_id as string}`;
    d.meet_url = meet;
  } else if (d.type === "cancelled" && b.gcal_event_id) {
    const res = await fetch(`${CAL}/${b.gcal_event_id}?sendUpdates=none`, { method: "DELETE", headers: auth });
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`calendar delete: ${res.status}`);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") return onOAuthRedirect(url);
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const s = await settings();
  const d = await req.json().catch(() => null);
  if (!d || d.secret !== s.webhook_secret) return new Response("forbidden", { status: 403 });

  let calendarError: string | null = null;
  try { await onBookingChange(d, s); }
  catch (e) { calendarError = String(e); console.error(e); }

  // Emails go out even if the calendar step failed (they just won't have a Meet link).
  let mail = "skipped";
  if (s.apps_script_url) {
    const r = await fetch(s.apps_script_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    mail = `${r.status} ${(await r.text()).slice(0, 200)}`;
  }
  return Response.json({ ok: !calendarError, calendarError, meet_url: d.meet_url ?? null, mail });
});
