/* Slotly — a free Calendly-style scheduler. Static SPA (GitHub Pages) + Supabase. */
(() => {
  "use strict";
  const { DateTime } = luxon;
  const cfg = window.SLOTLY_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT");
  const sb = configured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $app = document.getElementById("app");
  const $nav = document.getElementById("nav");

  const BOOKING_WINDOW_DAYS = 60;
  const MIN_NOTICE_MIN = 5;
  const DURATIONS = [15, 30, 45, 60, 90, 120];

  // ---------- i18n ----------
  const STR = {
    zh: {
      login: "登入", signup: "註冊", logout: "登出", dashboard: "後台", email: "Email", password: "密碼",
      noAccount: "還沒有帳號？註冊", haveAccount: "已經有帳號？登入",
      checkEmail: "註冊成功！請到信箱點確認連結後再登入。",
      tagline: "分享一個連結，讓別人直接挑時間跟你約。完全免費。",
      setupTitle: "先完成你的預約頁", username: "網址名稱", usernameHint: "3–30 個小寫英文、數字或 -，會出現在你的預約連結裡",
      displayName: "顯示名稱", timezone: "你的時區", save: "儲存", saved: "已儲存",
      events: "預約類型", availability: "可預約時間", bookings: "預約紀錄", profile: "個人設定",
      newEvent: "+ 新增預約類型", editEvent: "編輯預約類型", title: "名稱", slug: "網址代號",
      duration: "長度", minutes: "分鐘", description: "說明", location: "地點 / 會議連結", active: "開放預約",
      copyLink: "複製連結", copied: "連結已複製", edit: "編輯", delete: "刪除", cancel: "取消", close: "關閉",
      off: "已關閉", noEvents: "還沒有預約類型，先新增一個吧", yourPage: "你的公開預約頁",
      weekdays: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"], addRange: "+ 時段", unavailable: "不開放",
      availHint: "以下時間以你的時區為準：", upcoming: "即將到來", past: "已過 / 已取消", noBookings: "目前沒有預約",
      cancelBooking: "取消這筆預約", confirmCancel: "確定要取消這筆預約嗎？", cancelled: "已取消",
      confirmDelete: "確定要刪除這個預約類型？相關預約紀錄也會一起刪除。",
      notFound: "找不到這個頁面", pickDay: "選擇日期", pickTime: "選擇時間", noSlots: "這天沒有空檔",
      noSlotsAtAll: "接下來 60 天都沒有可預約的時間", showingIn: "顯示時區",
      yourName: "你的名字", yourEmail: "你的 Email", notes: "想先說的事（選填）", confirmBooking: "確認預約", back: "← 返回",
      booked: "預約成功！", bookedWith: "已經幫你跟 {name} 約好了", addGoogle: "加到 Google 日曆", downloadIcs: "下載 .ics",
      bookAnother: "再約一個時間",
      SLOT_TAKEN: "這個時段剛剛被訂走了，請選別的時間", SLOT_IN_PAST: "這個時段已經過了",
      SLOT_OUTSIDE_HOURS: "這個時段不在可預約時間內", INVALID_INVITEE: "請填寫名字和正確的 Email",
      EVENT_NOT_FOUND: "這個預約類型已關閉", genericError: "出錯了：",
      notConfigured: "還沒設定 Supabase", notConfiguredBody: "請照 README.md 建立免費的 Supabase 專案，再把網址和 anon key 填進 config.js。",
      usernameTaken: "這個網址名稱已經有人用了", slugTaken: "你已經有一樣網址代號的預約類型",
      invitee: "預約人", lang: "EN",
    },
    en: {
      login: "Log in", signup: "Sign up", logout: "Log out", dashboard: "Dashboard", email: "Email", password: "Password",
      noAccount: "No account? Sign up", haveAccount: "Have an account? Log in",
      checkEmail: "Signed up! Check your inbox for the confirmation link, then log in.",
      tagline: "Share one link and let people pick a time with you. Free.",
      setupTitle: "Set up your booking page", username: "Username", usernameHint: "3–30 lowercase letters, numbers or -. Used in your booking link.",
      displayName: "Display name", timezone: "Your timezone", save: "Save", saved: "Saved",
      events: "Event types", availability: "Availability", bookings: "Bookings", profile: "Profile",
      newEvent: "+ New event type", editEvent: "Edit event type", title: "Title", slug: "URL slug",
      duration: "Duration", minutes: "min", description: "Description", location: "Location / meeting link", active: "Accepting bookings",
      copyLink: "Copy link", copied: "Link copied", edit: "Edit", delete: "Delete", cancel: "Cancel", close: "Close",
      off: "Off", noEvents: "No event types yet — create one", yourPage: "Your public booking page",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], addRange: "+ Hours", unavailable: "Unavailable",
      availHint: "Times are in your timezone:", upcoming: "Upcoming", past: "Past / cancelled", noBookings: "No bookings yet",
      cancelBooking: "Cancel booking", confirmCancel: "Cancel this booking?", cancelled: "Cancelled",
      confirmDelete: "Delete this event type? Its bookings will be deleted too.",
      notFound: "Page not found", pickDay: "Select a date", pickTime: "Select a time", noSlots: "No times on this day",
      noSlotsAtAll: "No available times in the next 60 days", showingIn: "Timezone",
      yourName: "Your name", yourEmail: "Your email", notes: "Anything to share beforehand? (optional)", confirmBooking: "Confirm booking", back: "← Back",
      booked: "You're booked!", bookedWith: "You're scheduled with {name}", addGoogle: "Add to Google Calendar", downloadIcs: "Download .ics",
      bookAnother: "Book another time",
      SLOT_TAKEN: "That time was just taken — please pick another", SLOT_IN_PAST: "That time has already passed",
      SLOT_OUTSIDE_HOURS: "That time is outside available hours", INVALID_INVITEE: "Please enter your name and a valid email",
      EVENT_NOT_FOUND: "This event type is no longer available", genericError: "Something went wrong: ",
      notConfigured: "Supabase not configured", notConfiguredBody: "Follow README.md to create a free Supabase project, then put its URL and anon key in config.js.",
      usernameTaken: "That username is taken", slugTaken: "You already have an event type with that slug",
      invitee: "Invitee", lang: "中文",
    },
  };
  let lang = (() => {
    try { const s = localStorage.getItem("slotly-lang"); if (s) return s; } catch (_) {}
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  })();
  const t = (k, vars) => {
    let s = STR[lang][k] ?? k;
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, b);
    return s;
  };

  // ---------- helpers ----------
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const guessTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const allTimezones = () => (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [guessTz()]);
  const baseUrl = () => location.origin + location.pathname;
  const pageUrl = (username, slug) => `${baseUrl()}#/u/${username}${slug ? "/" + slug : ""}`;
  const locale = () => (lang === "zh" ? "zh-TW" : "en-AU");

  let toastTimer;
  function toast(msg, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "toast" + (isError ? " error" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), isError ? 5000 : 2500);
  }
  function errMsg(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    for (const code of ["SLOT_TAKEN", "SLOT_IN_PAST", "SLOT_OUTSIDE_HOURS", "INVALID_INVITEE", "EVENT_NOT_FOUND", "SLOT_TOO_FAR"]) {
      if (m.includes(code)) return t(code);
    }
    return t("genericError") + m;
  }
  const must = ({ data, error }) => { if (error) throw error; return data; };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast(t("copied")); }
    catch (_) { prompt(t("copyLink"), text); }
  }

  // ---------- auth state ----------
  let session = null;
  let me = null; // profile row

  async function loadMe() {
    session = sb ? (await sb.auth.getSession()).data.session : null;
    me = null;
    if (session) {
      me = must(await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle());
    }
  }

  function renderNav() {
    const langBtn = `<button class="btn-ghost btn-small" data-act="lang">${t("lang")}</button>`;
    if (session) {
      $nav.innerHTML = `${langBtn}<a class="btn btn-ghost btn-small" href="#/dashboard">${t("dashboard")}</a>
        <button class="btn-ghost btn-small" data-act="logout">${t("logout")}</button>`;
    } else {
      $nav.innerHTML = `${langBtn}<a class="btn btn-small" href="#/login">${t("login")}</a>`;
    }
  }
  $nav.addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    if (act === "lang") {
      lang = lang === "zh" ? "en" : "zh";
      try { localStorage.setItem("slotly-lang", lang); } catch (_) {}
      route();
    } else if (act === "logout") {
      await sb.auth.signOut();
      location.hash = "#/";
    }
  });

  // ---------- router ----------
  async function route() {
    renderNav();
    if (!configured) return viewNotConfigured();
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (parts[0] === "u" && parts[1] && parts[2]) return await viewBook(parts[1], parts[2]);
      if (parts[0] === "u" && parts[1]) return await viewPublicProfile(parts[1]);
      if (parts[0] === "login") return viewAuth("login");
      if (parts[0] === "signup") return viewAuth("signup");
      if (!session) return viewAuth("login");
      if (!me) return viewOnboarding();
      return await viewDashboard(parts[1] || "events");
    } catch (e) {
      console.error(e);
      $app.innerHTML = `<div class="card center">${esc(errMsg(e))}</div>`;
    }
  }

  function viewNotConfigured() {
    $app.innerHTML = `<div class="card narrow"><h2>⚙️ ${t("notConfigured")}</h2><p class="muted">${t("notConfiguredBody")}</p></div>`;
  }

  // ---------- auth views ----------
  function viewAuth(mode) {
    if (session) { location.hash = "#/dashboard"; return; }
    const isLogin = mode === "login";
    $app.innerHTML = `
      <div class="narrow">
        <p class="center muted">${t("tagline")}</p>
        <form class="card" id="authForm">
          <h2>${isLogin ? t("login") : t("signup")}</h2>
          <label>${t("email")}</label><input type="email" name="email" required autocomplete="email">
          <label>${t("password")}</label><input type="password" name="password" required minlength="6"
            autocomplete="${isLogin ? "current-password" : "new-password"}">
          <button class="btn-block" type="submit">${isLogin ? t("login") : t("signup")}</button>
          <p class="center small"><a href="#/${isLogin ? "signup" : "login"}">${isLogin ? t("noAccount") : t("haveAccount")}</a></p>
        </form>
      </div>`;
    document.getElementById("authForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      try {
        const creds = { email: f.get("email"), password: f.get("password") };
        if (isLogin) {
          must(await sb.auth.signInWithPassword(creds));
          await loadMe();
          location.hash = "#/dashboard";
          route();
        } else {
          const data = must(await sb.auth.signUp({ ...creds, options: { emailRedirectTo: baseUrl() } }));
          if (data.session) { await loadMe(); location.hash = "#/dashboard"; route(); }
          else { toast(t("checkEmail")); location.hash = "#/login"; }
        }
      } catch (err) { toast(errMsg(err), true); }
      btn.disabled = false;
    });
  }

  function tzOptions(selected) {
    return allTimezones().map((z) => `<option ${z === selected ? "selected" : ""}>${esc(z)}</option>`).join("");
  }

  function viewOnboarding() {
    const suggested = slugify(session.user.email.split("@")[0]).slice(0, 30).padEnd(3, "0");
    $app.innerHTML = `
      <form class="card narrow" id="onb">
        <h2>${t("setupTitle")}</h2>
        <label>${t("displayName")}</label><input name="display_name" required>
        <label>${t("username")}</label><input name="username" required value="${esc(suggested)}" pattern="[a-z0-9][a-z0-9\\-]{2,29}">
        <div class="hint">${t("usernameHint")}</div>
        <label>${t("timezone")}</label><select name="timezone">${tzOptions(guessTz())}</select>
        <button class="btn-block" type="submit">${t("save")}</button>
      </form>`;
    document.getElementById("onb").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const { error } = await sb.from("profiles").insert({
          id: session.user.id, username: f.get("username").toLowerCase(),
          display_name: f.get("display_name"), timezone: f.get("timezone"),
        });
        if (error) throw error.code === "23505" ? new Error(t("usernameTaken")) : error;
        // Sensible defaults so the page works right away: Mon–Fri 9–5 and one 30-min meeting.
        must(await sb.from("availability").insert([1, 2, 3, 4, 5].map((d) => ({
          user_id: session.user.id, weekday: d, start_time: "09:00", end_time: "17:00",
        }))));
        must(await sb.from("event_types").insert({
          user_id: session.user.id, slug: "30min", title: lang === "zh" ? "30 分鐘會面" : "30 Minute Meeting", duration_min: 30,
        }));
        await loadMe();
        route();
      } catch (err) { toast(errMsg(err), true); }
    });
  }

  // ---------- dashboard ----------
  async function viewDashboard(tab) {
    const tabs = ["events", "availability", "bookings", "profile"];
    if (!tabs.includes(tab)) tab = "events";
    $app.innerHTML = `
      <div class="row spread"><div><h1>${esc(me.display_name || me.username)}</h1>
        <p class="muted small">${t("yourPage")}: <a href="${esc(pageUrl(me.username))}" target="_blank"><code class="link">${esc(pageUrl(me.username))}</code></a></p></div>
        <button class="btn-ghost btn-small" id="copyMain">${t("copyLink")}</button></div>
      <nav class="tabs">${tabs.map((k) => `<a href="#/dashboard/${k}" class="${k === tab ? "active" : ""}">${t(k)}</a>`).join("")}</nav>
      <section id="tab"></section>`;
    document.getElementById("copyMain").onclick = () => copy(pageUrl(me.username));
    const $tab = document.getElementById("tab");
    await { events: tabEvents, availability: tabAvailability, bookings: tabBookings, profile: tabProfile }[tab]($tab);
  }

  async function tabEvents($tab) {
    const rows = must(await sb.from("event_types").select("*").eq("user_id", me.id).order("created_at"));
    $tab.innerHTML = `
      <div class="card">
        <div class="row spread"><h2>${t("events")}</h2><button class="btn-small" id="newEv">${t("newEvent")}</button></div>
        ${rows.length ? rows.map((r) => `
          <div class="list-item">
            <div><strong>${esc(r.title)}</strong> <span class="pill ${r.active ? "" : "off"}">${r.active ? `${r.duration_min} ${t("minutes")}` : t("off")}</span>
              <div class="muted small">/${esc(me.username)}/${esc(r.slug)}</div></div>
            <div class="row">
              <button class="btn-ghost btn-small" data-copy="${esc(r.slug)}">${t("copyLink")}</button>
              <button class="btn-ghost btn-small" data-edit="${esc(r.id)}">${t("edit")}</button>
            </div>
          </div>`).join("") : `<div class="empty">${t("noEvents")}</div>`}
      </div>
      <div id="evForm"></div>`;
    $tab.querySelector("#newEv").onclick = () => eventForm(null);
    $tab.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(pageUrl(me.username, b.dataset.copy))));
    $tab.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => eventForm(rows.find((r) => r.id === b.dataset.edit))));

    function eventForm(ev) {
      const $f = document.getElementById("evForm");
      const d = ev || { title: "", slug: "", duration_min: 30, description: "", location: "", active: true };
      $f.innerHTML = `
        <form class="card" id="ef">
          <h2>${ev ? t("editEvent") : t("newEvent").replace("+ ", "")}</h2>
          <label>${t("title")}</label><input name="title" required value="${esc(d.title)}">
          <label>${t("slug")}</label><input name="slug" required pattern="[a-z0-9][a-z0-9\\-]{0,39}" value="${esc(d.slug)}">
          <label>${t("duration")}</label>
          <select name="duration_min">${[...new Set([...DURATIONS, d.duration_min])].sort((a, b) => a - b)
            .map((m) => `<option value="${m}" ${m === d.duration_min ? "selected" : ""}>${m} ${t("minutes")}</option>`).join("")}</select>
          <label>${t("location")}</label><input name="location" value="${esc(d.location)}">
          <label>${t("description")}</label><textarea name="description">${esc(d.description)}</textarea>
          <label class="row"><input type="checkbox" name="active" style="width:auto" ${d.active ? "checked" : ""}> ${t("active")}</label>
          <div class="row spread" style="margin-top:16px">
            <div class="row"><button type="submit">${t("save")}</button><button type="button" class="btn-ghost" id="efCancel">${t("cancel")}</button></div>
            ${ev ? `<button type="button" class="btn-danger" id="efDel">${t("delete")}</button>` : ""}
          </div>
        </form>`;
      const form = $f.querySelector("#ef");
      const titleIn = form.elements.title, slugIn = form.elements.slug;
      let slugTouched = !!ev;
      slugIn.oninput = () => (slugTouched = true);
      titleIn.oninput = () => { if (!slugTouched) slugIn.value = slugify(titleIn.value) || "event"; };
      form.querySelector("#efCancel").onclick = () => ($f.innerHTML = "");
      if (ev) form.querySelector("#efDel").onclick = async () => {
        if (!confirm(t("confirmDelete"))) return;
        try { must(await sb.from("event_types").delete().eq("id", ev.id)); tabEvents($tab); }
        catch (err) { toast(errMsg(err), true); }
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const row = {
          user_id: me.id, title: f.get("title"), slug: f.get("slug").toLowerCase(),
          duration_min: +f.get("duration_min"), location: f.get("location"),
          description: f.get("description"), active: f.get("active") === "on",
        };
        const { error } = ev ? await sb.from("event_types").update(row).eq("id", ev.id) : await sb.from("event_types").insert(row);
        if (error) return toast(error.code === "23505" ? t("slugTaken") : errMsg(error), true);
        toast(t("saved"));
        tabEvents($tab);
      };
      form.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function tabAvailability($tab) {
    const rows = must(await sb.from("availability").select("*").eq("user_id", me.id).order("start_time"));
    const byDay = Array.from({ length: 7 }, (_, d) => rows.filter((r) => r.weekday === d).map((r) => [r.start_time.slice(0, 5), r.end_time.slice(0, 5)]));
    const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
    // Dropdowns instead of <input type="time">: the native control squeezes "上午/下午" in and hides the time.
    const STEPS = [];
    for (let m = 0; m < 24 * 60; m += 15) STEPS.push(`${String(m / 60 | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    STEPS.push("23:59"); // end of day, shown as 24:00
    const timeSelect = (cls, val) => `<select class="${cls}">${[...new Set([...STEPS, val])].sort()
      .map((v) => `<option value="${v}" ${v === val ? "selected" : ""}>${v === "23:59" ? "24:00" : v}</option>`).join("")}</select>`;
    const rangeHtml = ([s, e]) => `<div class="range">${timeSelect("rs", s)} – ${timeSelect("re", e)}
      <button type="button" class="btn-ghost btn-small rm" title="${t("delete")}">✕</button></div>`;
    $tab.innerHTML = `
      <form class="card" id="av">
        <h2>${t("availability")}</h2>
        <p class="muted small">${t("availHint")} <strong>${esc(me.timezone)}</strong></p>
        ${order.map((d) => `
          <div class="day-row" data-day="${d}">
            <label class="day-name" style="margin:0"><input type="checkbox" class="on" ${byDay[d].length ? "checked" : ""}> ${t("weekdays")[d]}</label>
            <div><div class="ranges">${byDay[d].map(rangeHtml).join("")}</div>
              <span class="muted small un" ${byDay[d].length ? "hidden" : ""}>${t("unavailable")}</span>
              <button type="button" class="btn-ghost btn-small add" ${byDay[d].length ? "" : "hidden"}>${t("addRange")}</button></div>
          </div>`).join("")}
        <button class="btn-block" type="submit">${t("save")}</button>
      </form>`;
    const form = $tab.querySelector("#av");
    const sync = (row) => {
      const has = row.querySelectorAll(".range").length > 0;
      row.querySelector(".on").checked = has;
      row.querySelector(".un").hidden = has;
      row.querySelector(".add").hidden = !has;
    };
    form.addEventListener("click", (e) => {
      const row = e.target.closest(".day-row");
      if (!row) return;
      if (e.target.classList.contains("rm")) { e.target.closest(".range").remove(); sync(row); }
      if (e.target.classList.contains("add")) {
        const last = [...row.querySelectorAll(".re")].pop();
        const start = last ? last.value : "09:00";
        row.querySelector(".ranges").insertAdjacentHTML("beforeend", rangeHtml([start, start < "17:00" ? "17:00" : "23:59"]));
      }
    });
    form.addEventListener("change", (e) => {
      if (!e.target.classList.contains("on")) return;
      const row = e.target.closest(".day-row");
      row.querySelector(".ranges").innerHTML = e.target.checked ? rangeHtml(["09:00", "17:00"]) : "";
      sync(row);
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const out = [];
      for (const row of form.querySelectorAll(".day-row")) {
        for (const r of row.querySelectorAll(".range")) {
          const s = r.querySelector(".rs").value, en = r.querySelector(".re").value;
          if (!s || !en || en <= s) return toast(`${t("weekdays")[row.dataset.day]}: ${s}–${en} ✕`, true);
          out.push({ user_id: me.id, weekday: +row.dataset.day, start_time: s, end_time: en });
        }
      }
      try {
        must(await sb.from("availability").delete().eq("user_id", me.id));
        if (out.length) must(await sb.from("availability").insert(out));
        toast(t("saved"));
      } catch (err) { toast(errMsg(err), true); }
    };
  }

  async function tabBookings($tab) {
    const rows = must(await sb.from("bookings").select("*, event_types(title)").eq("host_id", me.id).order("start_at"));
    const now = new Date().toISOString();
    const upcoming = rows.filter((r) => r.status === "confirmed" && r.end_at >= now);
    const past = rows.filter((r) => !(r.status === "confirmed" && r.end_at >= now)).reverse();
    const fmt = (iso) => DateTime.fromISO(iso).setZone(me.timezone).setLocale(locale()).toFormat("ccc, d LLL yyyy · HH:mm");
    const item = (r, canCancel) => `
      <div class="list-item">
        <div><strong>${esc(fmt(r.start_at))}</strong> <span class="pill ${r.status === "cancelled" ? "off" : ""}">${esc(r.event_types?.title || "")}${r.status === "cancelled" ? " · " + t("cancelled") : ""}</span>
          <div class="small">${t("invitee")}: ${esc(r.invitee_name)} · <a href="mailto:${esc(r.invitee_email)}">${esc(r.invitee_email)}</a></div>
          ${r.note ? `<div class="muted small">“${esc(r.note)}”</div>` : ""}</div>
        ${canCancel ? `<button class="btn-danger btn-small" data-cancel="${esc(r.id)}">${t("cancelBooking")}</button>` : ""}
      </div>`;
    $tab.innerHTML = `
      <div class="card"><h2>${t("upcoming")}</h2>${upcoming.length ? upcoming.map((r) => item(r, true)).join("") : `<div class="empty">${t("noBookings")}</div>`}</div>
      ${past.length ? `<div class="card"><h2>${t("past")}</h2>${past.map((r) => item(r, false)).join("")}</div>` : ""}`;
    $tab.querySelectorAll("[data-cancel]").forEach((b) => (b.onclick = async () => {
      if (!confirm(t("confirmCancel"))) return;
      try { must(await sb.from("bookings").update({ status: "cancelled" }).eq("id", b.dataset.cancel)); tabBookings($tab); }
      catch (err) { toast(errMsg(err), true); }
    }));
  }

  function tabProfile($tab) {
    $tab.innerHTML = `
      <form class="card" id="pf">
        <h2>${t("profile")}</h2>
        <label>${t("displayName")}</label><input name="display_name" required value="${esc(me.display_name)}">
        <label>${t("username")}</label><input name="username" required pattern="[a-z0-9][a-z0-9\\-]{2,29}" value="${esc(me.username)}">
        <div class="hint">${t("usernameHint")}</div>
        <label>${t("timezone")}</label><select name="timezone">${tzOptions(me.timezone)}</select>
        <p class="muted small">${t("email")}: ${esc(session.user.email)}</p>
        <button class="btn-block" type="submit">${t("save")}</button>
      </form>`;
    $tab.querySelector("#pf").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const { error } = await sb.from("profiles").update({
        display_name: f.get("display_name"), username: f.get("username").toLowerCase(), timezone: f.get("timezone"),
      }).eq("id", me.id);
      if (error) return toast(error.code === "23505" ? t("usernameTaken") : errMsg(error), true);
      await loadMe();
      toast(t("saved"));
      viewDashboard("profile");
    };
  }

  // ---------- public pages ----------
  async function fetchHost(username) {
    return must(await sb.from("profiles").select("id, username, display_name, timezone").eq("username", username.toLowerCase()).maybeSingle());
  }

  async function viewPublicProfile(username) {
    const host = await fetchHost(username);
    if (!host) { $app.innerHTML = `<div class="card center">${t("notFound")}</div>`; return; }
    const evs = must(await sb.from("event_types").select("*").eq("user_id", host.id).eq("active", true).order("created_at"));
    $app.innerHTML = `
      <div class="card narrow center"><h1>${esc(host.display_name || host.username)}</h1></div>
      <div class="narrow">${evs.length ? evs.map((e) => `
        <a class="card" style="display:block;color:inherit" href="#/u/${encodeURIComponent(host.username)}/${encodeURIComponent(e.slug)}">
          <strong>${esc(e.title)}</strong> <span class="pill">${e.duration_min} ${t("minutes")}</span>
          ${e.description ? `<p class="muted small" style="margin:6px 0 0">${esc(e.description)}</p>` : ""}
        </a>`).join("") : `<div class="card empty">${t("noEvents")}</div>`}</div>`;
  }

  // All bookable start times (UTC ISO strings) for the next BOOKING_WINDOW_DAYS days.
  function computeSlots(avail, hostTz, duration, busy) {
    const now = DateTime.now().plus({ minutes: MIN_NOTICE_MIN });
    const busyMs = busy.map((b) => [Date.parse(b.start_at), Date.parse(b.end_at)]);
    const slots = [];
    let day = DateTime.now().setZone(hostTz).startOf("day");
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++, day = day.plus({ days: 1 })) {
      const weekday = day.weekday % 7; // luxon: Mon=1…Sun=7 → 0=Sun
      for (const w of avail.filter((a) => a.weekday === weekday)) {
        const [sh, sm] = w.start_time.split(":").map(Number);
        const [eh, em] = w.end_time.split(":").map(Number);
        let s = day.set({ hour: sh, minute: sm });
        const end = eh === 23 && em === 59 ? day.plus({ days: 1 }) : day.set({ hour: eh, minute: em });
        for (; s.plus({ minutes: duration }) <= end; s = s.plus({ minutes: duration })) {
          if (s < now) continue;
          const a = s.toMillis(), b = a + duration * 60000;
          if (busyMs.some(([x, y]) => a < y && b > x)) continue;
          slots.push(s.toUTC().toISO());
        }
      }
    }
    return [...new Set(slots)].sort();
  }

  async function viewBook(username, slug) {
    const host = await fetchHost(username);
    const ev = host && must(await sb.from("event_types").select("*").eq("user_id", host.id).eq("slug", slug).eq("active", true).maybeSingle());
    if (!ev) { $app.innerHTML = `<div class="card center">${t("notFound")}</div>`; return; }
    const avail = must(await sb.from("availability").select("weekday, start_time, end_time").eq("user_id", host.id));
    const from = new Date().toISOString();
    const to = DateTime.now().plus({ days: BOOKING_WINDOW_DAYS + 2 }).toUTC().toISO();
    const busy = must(await sb.rpc("get_busy", { p_host: host.id, p_from: from, p_to: to }));
    const slots = computeSlots(avail, host.timezone, ev.duration_min, busy);

    let viewTz = guessTz();
    let month = null, selDay = null;

    const infoHtml = () => `
      <div class="event-info">
        <p class="muted" style="margin:0">${esc(host.display_name || host.username)}</p>
        <h1>${esc(ev.title)}</h1>
        <p>⏱ ${ev.duration_min} ${t("minutes")}</p>
        ${ev.location ? `<p>📍 ${esc(ev.location)}</p>` : ""}
        ${ev.description ? `<p class="muted small" style="white-space:pre-wrap">${esc(ev.description)}</p>` : ""}
      </div>`;

    function byLocalDay() {
      const m = new Map();
      for (const iso of slots) {
        const k = DateTime.fromISO(iso).setZone(viewTz).toISODate();
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(iso);
      }
      return m;
    }

    function renderPicker() {
      const days = byLocalDay();
      const first = days.keys().next().value;
      if (!month) month = first ? DateTime.fromISO(first, { zone: viewTz }).startOf("month") : DateTime.now().setZone(viewTz).startOf("month");
      if (selDay && !days.has(selDay)) selDay = null;
      if (!selDay && first && DateTime.fromISO(first).hasSame(month, "month")) selDay = first;

      const lead = month.weekday % 7; // blanks before the 1st (Sunday-first grid)
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(`<span></span>`);
      for (let d = 1; d <= month.daysInMonth; d++) {
        const k = month.set({ day: d }).toISODate();
        const has = days.has(k);
        cells.push(`<button class="day ${has ? "has" : ""} ${k === selDay ? "sel" : ""}" ${has ? `data-day="${k}"` : "disabled"}>${d}</button>`);
      }
      const minMonth = DateTime.now().setZone(viewTz).startOf("month");
      const maxMonth = DateTime.now().setZone(viewTz).plus({ days: BOOKING_WINDOW_DAYS }).startOf("month");
      const daySlots = selDay ? days.get(selDay) : [];

      $app.innerHTML = `
        <div class="card booker">
          ${infoHtml()}
          <div>
            ${slots.length ? `
            <div class="pick">
              <div>
                <h2>${t("pickDay")}</h2>
                <div class="cal-head">
                  <button class="btn-ghost" id="prevM" ${month <= minMonth ? "disabled" : ""}>‹</button>
                  <strong>${esc(month.setLocale(locale()).toFormat("LLLL yyyy"))}</strong>
                  <button class="btn-ghost" id="nextM" ${month >= maxMonth ? "disabled" : ""}>›</button>
                </div>
                <div class="cal">${t("weekdays").map((w) => `<span class="dow">${esc(w)}</span>`).join("")}${cells.join("")}</div>
              </div>
              <div>
                <h2>${selDay ? esc(DateTime.fromISO(selDay).setLocale(locale()).toFormat("ccc d LLL")) : t("pickTime")}</h2>
                <div class="slots">${selDay ? daySlots.map((iso) => `<button data-slot="${iso}">${DateTime.fromISO(iso).setZone(viewTz).toFormat("HH:mm")}</button>`).join("") : `<span class="muted small">${t("pickDay")}</span>`}</div>
              </div>
            </div>` : `<div class="empty">${t("noSlotsAtAll")}</div>`}
            <div class="tz-select"><label>🌏 ${t("showingIn")}</label><select id="tz">${tzOptions(viewTz)}</select></div>
          </div>
        </div>`;
      $app.querySelector("#tz").onchange = (e) => { viewTz = e.target.value; month = null; selDay = null; renderPicker(); };
      $app.querySelector("#prevM")?.addEventListener("click", () => { month = month.minus({ months: 1 }); selDay = null; renderPicker(); });
      $app.querySelector("#nextM")?.addEventListener("click", () => { month = month.plus({ months: 1 }); selDay = null; renderPicker(); });
      $app.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { selDay = b.dataset.day; renderPicker(); }));
      $app.querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => renderForm(b.dataset.slot)));
    }

    function slotLabel(iso) {
      const s = DateTime.fromISO(iso).setZone(viewTz).setLocale(locale());
      return `${s.toFormat("cccc, d LLLL yyyy")} · ${s.toFormat("HH:mm")}–${s.plus({ minutes: ev.duration_min }).toFormat("HH:mm")} (${viewTz})`;
    }

    function renderForm(iso) {
      $app.innerHTML = `
        <div class="card booker">
          ${infoHtml()}
          <form id="bk">
            <button type="button" class="btn-ghost btn-small" id="bkBack">${t("back")}</button>
            <p><strong>🗓 ${esc(slotLabel(iso))}</strong></p>
            <label>${t("yourName")}</label><input name="name" required autocomplete="name">
            <label>${t("yourEmail")}</label><input name="email" type="email" required autocomplete="email">
            <label>${t("notes")}</label><textarea name="note"></textarea>
            <button class="btn-block" type="submit">${t("confirmBooking")}</button>
          </form>
        </div>`;
      $app.querySelector("#bkBack").onclick = renderPicker;
      $app.querySelector("#bk").onsubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector("button[type=submit]");
        btn.disabled = true;
        try {
          must(await sb.rpc("book_slot", {
            p_event_type: ev.id, p_start: iso, p_name: f.get("name"), p_email: f.get("email"), p_note: f.get("note") || "",
          }));
          renderDone(iso);
        } catch (err) {
          toast(errMsg(err), true);
          btn.disabled = false;
          if (String(err.message).includes("SLOT_TAKEN")) {
            const i = slots.indexOf(iso);
            if (i >= 0) slots.splice(i, 1);
            renderPicker();
          }
        }
      };
    }

    function renderDone(iso) {
      const start = DateTime.fromISO(iso).toUTC();
      const end = start.plus({ minutes: ev.duration_min });
      const stamp = (d) => d.toFormat("yyyyLLdd'T'HHmmss'Z'");
      const name = host.display_name || host.username;
      const title = `${ev.title} — ${name}`;
      const gcal = "https://calendar.google.com/calendar/render?action=TEMPLATE"
        + `&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}`
        + `&details=${encodeURIComponent(ev.description || "")}&location=${encodeURIComponent(ev.location || "")}`;
      const icsEsc = (s) => String(s || "").replace(/([\\,;])/g, "\\$1").replace(/\n/g, "\\n");
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Slotly//EN", "BEGIN:VEVENT",
        `UID:${stamp(start)}-${ev.id}@slotly`, `DTSTAMP:${stamp(DateTime.utc())}`,
        `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${icsEsc(title)}`,
        `DESCRIPTION:${icsEsc(ev.description)}`, `LOCATION:${icsEsc(ev.location)}`,
        "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      const icsUrl = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      $app.innerHTML = `
        <div class="card narrow center">
          <div class="success">✅</div>
          <h1>${t("booked")}</h1>
          <p class="muted">${esc(t("bookedWith", { name }))}</p>
          <p><strong>${esc(ev.title)}</strong><br>${esc(slotLabel(iso))}</p>
          ${ev.location ? `<p>📍 ${esc(ev.location)}</p>` : ""}
          <div class="row" style="justify-content:center">
            <a class="btn" href="${gcal}" target="_blank" rel="noopener">${t("addGoogle")}</a>
            <a class="btn btn-ghost" href="${icsUrl}" download="booking.ics">${t("downloadIcs")}</a>
          </div>
          <p class="small" style="margin-top:20px"><a href="#/u/${encodeURIComponent(host.username)}">${t("bookAnother")}</a></p>
        </div>`;
    }

    renderPicker();
  }

  // ---------- boot ----------
  window.addEventListener("hashchange", route);
  (async () => {
    if (sb) {
      sb.auth.onAuthStateChange(async (event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") { await loadMe(); route(); }
      });
      try { await loadMe(); } catch (e) { console.error(e); }
    }
    route();
  })();
})();
