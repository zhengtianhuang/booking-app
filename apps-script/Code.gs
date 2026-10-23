/**
 * Slotly → email notifications.
 * Deploy as a Web app (Execute as: Me, Who has access: Anyone). Supabase calls doPost
 * from a database trigger (notifications.sql) whenever a booking is created or cancelled.
 *
 * Nothing is written to anyone's calendar automatically: host and invitee each get an
 * email with an "Add to Google Calendar" button and an .ics attachment.
 * Mail is sent from the Google account that owns this script (MailApp quota ~100/day).
 * Since google.sql, the trigger calls the Supabase Edge Function "google" first; it adds
 * meet_url when the host has connected Google Calendar, then forwards here.
 */
const SECRET = "PASTE-SHARED-SECRET"; // must match private.settings.webhook_secret

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: "bad json" }); }
  if (d.secret !== SECRET) return json({ ok: false, error: "forbidden" });
  try {
    if (d.type === "booked") onBooked(d);
    else if (d.type === "cancelled") onCancelled(d);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) });
  }
}

function onBooked(d) {
  const when = whenText(d);
  const ics = icsFile(d, "PUBLISH");
  const rows = [
    ["時間 When", when],
    ["預約人 Invitee", d.invitee_name + " <" + d.invitee_email + ">"],
    d.meet_url ? ["Google Meet", d.meet_url] : null,
    d.location ? ["地點 Location", d.location] : null,
    priceRow(d),
    d.note ? ["留言 Note", d.note] : null,
  ];
  MailApp.sendEmail({
    to: d.host_email,
    subject: "📅 新預約 New booking: " + d.invitee_name + " — " + when,
    htmlBody: page("有人預約了你的「" + d.event_title + "」", rows, d.meet_url ? null : gcalLink(d, d.invitee_name),
      d.meet_url ? "已經自動加到你的 Google 日曆。" : ""),
    replyTo: d.invitee_email,
    attachments: d.meet_url ? [] : [ics],
  });
  MailApp.sendEmail({
    to: d.invitee_email,
    subject: "✅ 預約成功 Booking confirmed: " + d.event_title + " — " + d.host_name,
    htmlBody: page("你已預約 " + d.host_name + " 的「" + d.event_title + "」",
      [["時間 When", when], d.meet_url ? ["Google Meet", d.meet_url] : null,
       d.location ? ["地點 Location", d.location] : null, priceRow(d)], gcalLink(d, d.host_name)),
    replyTo: d.host_email,
    attachments: [ics],
  });
}

function onCancelled(d) {
  const when = whenText(d);
  MailApp.sendEmail({
    to: d.invitee_email,
    subject: "❌ 預約已取消 Booking cancelled: " + d.event_title + " — " + d.host_name,
    htmlBody: page(d.host_name + " 取消了「" + d.event_title + "」的預約", [["時間 When", when]], null),
    replyTo: d.host_email,
  });
}

function priceRow(d) {
  if (d.price == null) return null;
  const n = Number(d.price);
  return ["價格 Price", (d.currency || "") + " " + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2))];
}

function whenText(d) {
  const tz = d.host_timezone || "UTC";
  return Utilities.formatDate(new Date(d.start_at), tz, "EEE d MMM yyyy HH:mm") + "–" +
    Utilities.formatDate(new Date(d.end_at), tz, "HH:mm") + " (" + tz + ")";
}

function gcalLink(d, other) {
  const stamp = function (iso) { return Utilities.formatDate(new Date(iso), "UTC", "yyyyMMdd'T'HHmmss'Z'"); };
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(d.event_title + " — " + other) +
    "&dates=" + stamp(d.start_at) + "/" + stamp(d.end_at) +
    "&details=" + encodeURIComponent(d.note || d.description || "") +
    "&location=" + encodeURIComponent(d.meet_url || d.location || "");
}

function page(heading, rows, calUrl, extra) {
  const esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  const body = rows.filter(Boolean).map(function (r) {
    return '<tr><td style="padding:6px 12px 6px 0;color:#6b7083;white-space:nowrap">' + esc(r[0]) +
      '</td><td style="padding:6px 0">' +
      (/^https:\/\//.test(String(r[1])) ? '<a href="' + esc(r[1]) + '">' + esc(r[1]) + "</a>" : esc(r[1])) + "</td></tr>";
  }).join("");
  const button = calUrl
    ? '<p style="margin:20px 0"><a href="' + esc(calUrl) + '" style="background:#4f46e5;color:#fff;padding:10px 18px;' +
      'border-radius:8px;text-decoration:none;font-weight:600">加到 Google 日曆 Add to Google Calendar</a></p>' +
      '<p style="color:#6b7083;font-size:13px">也可以打開附件 booking.ics 加到其他日曆。</p>'
    : "";
  const note = extra ? '<p style="color:#6b7083;font-size:13px">' + esc(extra) + "</p>" : "";
  return '<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1c1f2a;max-width:520px">' +
    '<h2 style="font-size:18px">' + esc(heading) + "</h2><table>" + body + "</table>" + note + button +
    '<p style="color:#9a9eb3;font-size:12px;margin-top:24px">Sent by Kee&#39;s Japanese Class</p></div>';
}

function icsFile(d, method) {
  const stamp = function (iso) { return Utilities.formatDate(new Date(iso), "UTC", "yyyyMMdd'T'HHmmss'Z'"); };
  const esc = function (s) { return String(s || "").replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n"); };
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Slotly//EN", "METHOD:" + method,
    "BEGIN:VEVENT",
    "UID:" + d.booking_id + "@slotly",
    "DTSTAMP:" + stamp(new Date().toISOString()),
    "DTSTART:" + stamp(d.start_at),
    "DTEND:" + stamp(d.end_at),
    "SUMMARY:" + esc(d.event_title + " — " + d.host_name + " & " + d.invitee_name),
    "DESCRIPTION:" + esc(d.note || d.description),
    "LOCATION:" + esc(d.meet_url || d.location),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return Utilities.newBlob(lines.join("\r\n"), "text/calendar", "booking.ics");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to grant the Gmail-sending permission. */
function authorize() {
  console.log("Authorized as " + Session.getEffectiveUser().getEmail() + ", mail quota left: " + MailApp.getRemainingDailyQuota());
}
