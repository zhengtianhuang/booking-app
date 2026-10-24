/* Slotly — a free Calendly-style scheduler. Static SPA (GitHub Pages) + Supabase. */
(() => {
  "use strict";
  const { DateTime } = luxon;
  const cfg = window.SLOTLY_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT");
  // Per-tab lock instead of supabase-js's default cross-tab navigator.locks: with the default,
  // one stuck tab holds the auth lock and every other tab of the site hangs on "Loading…".
  let lockChain = Promise.resolve();
  const tabLock = (_name, _timeout, fn) => {
    const run = lockChain.then(fn, fn);
    lockChain = run.catch(() => {});
    return run;
  };
  // iOS (especially the home-screen app) often fails the first request after the app was in
  // the background with "TypeError: Load failed" — a dead keep-alive connection. Retry once.
  const retryFetch = (url, opts) => fetch(url, opts).catch((err) => {
    if (!(err instanceof TypeError) || opts?.signal?.aborted) throw err;
    return new Promise((r) => setTimeout(r, 400)).then(() => fetch(url, opts));
  });
  const sb = configured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { lock: tabLock }, global: { fetch: retryFetch } }) : null;
  const $app = document.getElementById("app");
  const $nav = document.getElementById("nav");

  const BOOKING_WINDOW_DAYS = 60;
  const MIN_NOTICE_MIN = 5;
  const DURATIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 10); // 10 min … 8 h
  const CURRENCIES = ["AUD", "TWD", "USD", "NZD", "JPY", "EUR", "GBP"];

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
      duration: "長度", minutes: "分鐘", buffer: "預約間隔", bufferHint: "每個預約前後保留的空檔", price: "價格", priceHint: "留空 = 免費。只顯示價格，不會線上收款", free: "免費", durationHint: "以 10 分鐘為單位", description: "說明", location: "地點 / 會議連結", active: "開放預約",
      copyLink: "複製連結", copied: "連結已複製", edit: "編輯", delete: "刪除", cancel: "取消", close: "關閉",
      off: "已關閉", noEvents: "還沒有預約類型，先新增一個吧", yourPage: "你的公開預約頁",
      weekdays: ["週日", "週一", "週二", "週三", "週四", "週五", "週六"], addRange: "+ 時段", unavailable: "不開放",
      weeklyHours: "每週固定時間", dateHours: "指定日期", dateHint: "點日曆上的日期，單獨設定那天開放的時段，或設成休息。指定日期會取代那天的每週時間。只想開放特定日期的話，把上面每週時間全部關掉，再在這裡點選要開放的日期。", noDates: "還沒有指定日期", openThatDay: "開放", closedDay: "休息",
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
      gTitle: "Google 日曆 + Meet", gHint: "連結後，每筆新預約都會自動加到你的 Google 日曆，並產生一個新的 Google Meet 連結，寄給你和預約人。",
      gConnect: "連結 Google 帳號", gConnected: "已連結：", gDisconnect: "取消連結", gOk: "Google 帳號已連結", gErr: "Google 連結失敗，請再試一次",
      gWarn: "Google 會顯示「這個應用程式未經驗證」，按「進階」→「前往」即可。", confirmDisconnect: "取消連結後，新預約就不會自動建立 Meet。確定嗎？",
      meetSoon: "Meet 連結產生中…", meetEmail: "Meet 連結會寄到你的信箱",
      links: "專屬連結", newLink: "+ 新增專屬連結", editLink: "編輯專屬連結", linkName: "連結名稱（只有你看得到）",
      linkNameHint: "例如：台灣學生 TWD、澳洲學生 AUD", linkItems: "這個連結要顯示的預約類型和價格", linkCurrency: "這個連結顯示的幣別", convert: "依今天匯率換算", converted: "已依今天匯率換算，價格可以再自己改", original: "原價",
      linkHint: "每個連結可以有不同的幣別和價格。連結網址是隨機的，別人猜不到；只有拿到連結的人看得到這些價格。",
      noLinks: "還沒有專屬連結", pickOne: "至少要勾選一個預約類型", confirmDeleteLink: "確定要刪除這個連結？已經拿到連結的人就不能再用了。",
      listed: "顯示在公開預約頁", listedHint: "取消勾選 = 只能透過專屬連結預約", hidden: "只限專屬連結", via: "連結",
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
      duration: "Duration", minutes: "min", buffer: "Buffer between bookings", bufferHint: "Free time kept before and after each booking", price: "Price", priceHint: "Leave empty for free. Shown only — no online payment", free: "Free", durationHint: "In 10-minute steps", description: "Description", location: "Location / meeting link", active: "Accepting bookings",
      copyLink: "Copy link", copied: "Link copied", edit: "Edit", delete: "Delete", cancel: "Cancel", close: "Close",
      off: "Off", noEvents: "No event types yet — create one", yourPage: "Your public booking page",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], addRange: "+ Hours", unavailable: "Unavailable",
      weeklyHours: "Weekly hours", dateHours: "Specific dates", dateHint: "Tap a date to set its own hours or mark it as a day off. These replace the weekly hours for that date. To open only certain dates, turn off every weekday above and pick the dates here.", noDates: "No specific dates yet", openThatDay: "Open", closedDay: "Day off",
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
      gTitle: "Google Calendar + Meet", gHint: "Once connected, every new booking is added to your Google Calendar with its own Google Meet link, emailed to you and the invitee.",
      gConnect: "Connect Google account", gConnected: "Connected: ", gDisconnect: "Disconnect", gOk: "Google account connected", gErr: "Couldn't connect Google — please try again",
      gWarn: "Google will say the app isn't verified — click Advanced → Go to continue.", confirmDisconnect: "New bookings won't get a Meet link after disconnecting. Continue?",
      meetSoon: "Creating Meet link…", meetEmail: "The Meet link will be emailed to you",
      links: "Price links", newLink: "+ New price link", editLink: "Edit price link", linkName: "Link name (only you see this)",
      linkNameHint: "e.g. Taiwan students TWD, Australia AUD", linkItems: "Event types and prices on this link", linkCurrency: "Currency shown on this link", convert: "Convert at today's rate", converted: "Converted at today's rate — edit as you like", original: "Base",
      linkHint: "Each link can use its own currency and prices. The URL is random and can't be guessed — only people you send it to see these prices.",
      noLinks: "No price links yet", pickOne: "Pick at least one event type", confirmDeleteLink: "Delete this link? Anyone who has it won't be able to use it.",
      listed: "Show on public booking page", listedHint: "Unticked = bookable only through a price link", hidden: "Links only", via: "Link",
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
  const linkUrl = (token) => `${baseUrl()}#/p/${token}`;
  const locale = () => (lang === "zh" ? "zh-TW" : "en-AU");
  const fmtDur = (m) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} ${t("minutes")}` : `${m} ${t("minutes")}`);
  const fmtPrice = (price, cur) => {
    if (price == null) return t("free");
    // Always show the code: zh-TW renders both TWD and AUD as plain "$".
    return `${cur || "AUD"} ${Number(price).toLocaleString(locale(), { minimumFractionDigits: price % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  };

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
      if (parts[0] === "p" && parts[1]) return await viewPriceLink(parts[1], parts[2]);
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
    const tabs = ["events", "links", "availability", "bookings", "profile"];
    if (!tabs.includes(tab)) tab = "events";
    $app.innerHTML = `
      <div class="row spread"><div><h1>${esc(me.display_name || me.username)}</h1>
        <p class="muted small">${t("yourPage")}: <a href="${esc(pageUrl(me.username))}" target="_blank"><code class="link">${esc(pageUrl(me.username))}</code></a></p></div>
        <button class="btn-ghost btn-small" id="copyMain">${t("copyLink")}</button></div>
      <nav class="tabs">${tabs.map((k) => `<a href="#/dashboard/${k}" class="${k === tab ? "active" : ""}">${t(k)}</a>`).join("")}</nav>
      <section id="tab"></section>`;
    document.getElementById("copyMain").onclick = () => copy(pageUrl(me.username));
    const $tab = document.getElementById("tab");
    await { events: tabEvents, links: tabLinks, availability: tabAvailability, bookings: tabBookings, profile: tabProfile }[tab]($tab);
    // Back from Google's sign-in (the Edge Function redirects to ?google=connected|error).
    const g = new URLSearchParams(location.search).get("google");
    if (g) { toast(g === "connected" ? t("gOk") : t("gErr"), g !== "connected"); history.replaceState(null, "", location.pathname + location.hash); }
  }

  async function tabEvents($tab) {
    const rows = must(await sb.from("event_types").select("*").eq("user_id", me.id).order("created_at"));
    $tab.innerHTML = `
      <div class="card">
        <div class="row spread"><h2>${t("events")}</h2><button class="btn-small" id="newEv">${t("newEvent")}</button></div>
        ${rows.length ? rows.map((r) => `
          <div class="list-item">
            <div><strong>${esc(r.title)}</strong> <span class="pill ${r.active ? "" : "off"}">${r.active ? `${fmtDur(r.duration_min)} · ${esc(fmtPrice(r.price, r.currency))}` : t("off")}</span>${r.listed === false ? ` <span class="pill off">${t("hidden")}</span>` : ""}
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
      const d = ev || { title: "", slug: "", duration_min: 30, buffer_min: 10, price: null, currency: "AUD", description: "", location: "", active: true, listed: true };
      $f.innerHTML = `
        <form class="card" id="ef">
          <h2>${ev ? t("editEvent") : t("newEvent").replace("+ ", "")}</h2>
          <label>${t("title")}</label><input name="title" required value="${esc(d.title)}">
          <label>${t("slug")}</label><input name="slug" required pattern="[a-z0-9][a-z0-9\\-]{0,39}" value="${esc(d.slug)}">
          <label>${t("duration")}</label>
          <select name="duration_min">${[...new Set([...DURATIONS, d.duration_min])].sort((a, b) => a - b)
            .map((m) => `<option value="${m}" ${m === d.duration_min ? "selected" : ""}>${fmtDur(m)}</option>`).join("")}</select>
          <div class="hint">${t("durationHint")}</div>
          <label>${t("price")}</label>
          <div class="row" style="flex-wrap:nowrap">
            <select name="currency" style="width:100px">${[...new Set([...CURRENCIES, d.currency])]
              .map((c) => `<option ${c === d.currency ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
            <input name="price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t("free")}" value="${d.price ?? ""}">
          </div>
          <div class="hint">${t("priceHint")}</div>
          <label>${t("buffer")}</label>
          <select name="buffer_min">${[...new Set([0, 5, 10, 15, 20, 30, d.buffer_min])].sort((a, b) => a - b)
            .map((m) => `<option value="${m}" ${m === d.buffer_min ? "selected" : ""}>${m} ${t("minutes")}</option>`).join("")}</select>
          <div class="hint">${t("bufferHint")}</div>
          <label>${t("location")}</label><input name="location" value="${esc(d.location)}">
          <label>${t("description")}</label><textarea name="description">${esc(d.description)}</textarea>
          <label class="row"><input type="checkbox" name="active" style="width:auto" ${d.active ? "checked" : ""}> ${t("active")}</label>
          <label class="row"><input type="checkbox" name="listed" style="width:auto" ${d.listed !== false ? "checked" : ""}> ${t("listed")}</label>
          <div class="hint">${t("listedHint")}</div>
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
          duration_min: +f.get("duration_min"), buffer_min: +f.get("buffer_min"), location: f.get("location"),
          price: f.get("price") === "" ? null : +f.get("price"), currency: f.get("currency"),
          description: f.get("description"), active: f.get("active") === "on", listed: f.get("listed") === "on",
        };
        const { error } = ev ? await sb.from("event_types").update(row).eq("id", ev.id) : await sb.from("event_types").insert(row);
        if (error) return toast(error.code === "23505" ? t("slugTaken") : errMsg(error), true);
        toast(t("saved"));
        tabEvents($tab);
      };
      form.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function tabLinks($tab) {
    const [links, evs] = await Promise.all([
      sb.from("price_links").select("*, price_link_items(*)").eq("user_id", me.id).order("created_at").then(must),
      sb.from("event_types").select("*").eq("user_id", me.id).order("created_at").then(must),
    ]);
    const evTitle = (id) => evs.find((e) => e.id === id)?.title || "?";
    $tab.innerHTML = `
      <div class="card">
        <div class="row spread"><h2>${t("links")}</h2><button class="btn-small" id="newLk">${t("newLink")}</button></div>
        <p class="muted small">${t("linkHint")}</p>
        ${links.length ? links.map((l) => `
          <div class="list-item">
            <div><strong>${esc(l.name)}</strong>
              <div class="small">${l.price_link_items.map((i) => `${esc(evTitle(i.event_type_id))} <span class="pill">${esc(fmtPrice(i.price, i.currency))}</span>`).join(" ")}</div>
              <div class="muted small"><code class="link">${esc(linkUrl(l.token))}</code></div></div>
            <div class="row">
              <button class="btn-ghost btn-small" data-copy="${esc(l.token)}">${t("copyLink")}</button>
              <button class="btn-ghost btn-small" data-edit="${esc(l.id)}">${t("edit")}</button>
            </div>
          </div>`).join("") : `<div class="empty">${t("noLinks")}</div>`}
      </div>
      <div id="lkForm"></div>`;
    $tab.querySelector("#newLk").onclick = () => linkForm(null);
    $tab.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(linkUrl(b.dataset.copy))));
    $tab.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => linkForm(links.find((l) => l.id === b.dataset.edit))));

    function linkForm(lk) {
      const $f = document.getElementById("lkForm");
      const items = new Map((lk?.price_link_items || []).map((i) => [i.event_type_id, i]));
      const linkCur = lk?.price_link_items[0]?.currency || evs[0]?.currency || "AUD";
      $f.innerHTML = `
        <form class="card" id="lf">
          <h2>${lk ? t("editLink") : t("newLink").replace("+ ", "")}</h2>
          <label>${t("linkName")}</label><input name="name" required value="${esc(lk?.name || "")}">
          <div class="hint">${t("linkNameHint")}</div>
          <label>${t("linkCurrency")}</label>
          <div class="row" style="flex-wrap:nowrap">
            <select name="currency" style="width:110px">${[...new Set([...CURRENCIES, linkCur])].map((c) => `<option ${c === linkCur ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
            <button type="button" class="btn-ghost btn-small" id="lfConvert">${t("convert")}</button>
          </div>
          <label>${t("linkItems")}</label>
          ${evs.length ? evs.map((e) => {
            const it = items.get(e.id);
            const price = it ? it.price : e.currency === linkCur ? e.price : null;
            return `
            <div class="list-item" data-ev="${esc(e.id)}">
              <label class="row link-ev"><input type="checkbox" class="inc" style="width:auto" ${it || !lk ? "checked" : ""}>
                <span><strong>${esc(e.title)}</strong> <span class="muted small">${fmtDur(e.duration_min)} · ${t("original")} ${esc(fmtPrice(e.price, e.currency))}${e.active ? "" : " · " + t("off")}</span></span></label>
              <div class="row" style="flex-wrap:nowrap">
                <span class="cur-label small"><strong>${esc(linkCur)}</strong></span>
                <input class="pr" type="number" min="0" step="0.01" inputmode="decimal" placeholder="${t("free")}" value="${price ?? ""}" style="width:120px">
              </div>
            </div>`;
          }).join("") : `<div class="empty">${t("noEvents")}</div>`}
          <div class="row spread" style="margin-top:16px">
            <div class="row"><button type="submit">${t("save")}</button><button type="button" class="btn-ghost" id="lfCancel">${t("cancel")}</button></div>
            ${lk ? `<button type="button" class="btn-danger" id="lfDel">${t("delete")}</button>` : ""}
          </div>
        </form>`;
      const form = $f.querySelector("#lf");
      form.elements.currency.onchange = () =>
        form.querySelectorAll(".cur-label strong").forEach((el) => (el.textContent = form.elements.currency.value));
      form.querySelector("#lfConvert").onclick = async () => {
        const to = form.elements.currency.value;
        try {
          const r = await (await fetch(`https://open.er-api.com/v6/latest/${to}`)).json();
          if (r.result !== "success") throw new Error(r["error-type"] || "rate");
          for (const row of form.querySelectorAll("[data-ev]")) {
            const ev = evs.find((x) => x.id === row.dataset.ev);
            if (ev.price == null) continue;
            const v = ev.currency === to ? ev.price : ev.price / r.rates[ev.currency];
            const step = v >= 100 ? 10 : 1; // whole units; tens once prices reach the hundreds (TWD, JPY)
            row.querySelector(".pr").value = Math.round(v / step) * step;
          }
          toast(t("converted"));
        } catch (err) { toast(errMsg(err), true); }
      };
      form.querySelector("#lfCancel").onclick = () => ($f.innerHTML = "");
      if (lk) form.querySelector("#lfDel").onclick = async () => {
        if (!confirm(t("confirmDeleteLink"))) return;
        try { must(await sb.from("price_links").delete().eq("id", lk.id)); tabLinks($tab); }
        catch (err) { toast(errMsg(err), true); }
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const rows = [...form.querySelectorAll("[data-ev]")].filter((r) => r.querySelector(".inc").checked).map((r) => ({
          event_type_id: r.dataset.ev, currency: form.elements.currency.value,
          price: r.querySelector(".pr").value === "" ? null : +r.querySelector(".pr").value,
        }));
        if (!rows.length) return toast(t("pickOne"), true);
        try {
          const name = form.elements.name.value.trim();
          const id = lk ? lk.id : must(await sb.from("price_links").insert({ user_id: me.id, name }).select("id").single()).id;
          if (lk) must(await sb.from("price_links").update({ name }).eq("id", id));
          must(await sb.from("price_link_items").delete().eq("link_id", id));
          must(await sb.from("price_link_items").insert(rows.map((r) => ({ ...r, link_id: id }))));
          toast(t("saved"));
          tabLinks($tab);
        } catch (err) { toast(errMsg(err), true); }
      };
      form.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function tabAvailability($tab) {
    const rows = must(await sb.from("availability").select("*").eq("user_id", me.id).order("start_time"));
    const byDay = Array.from({ length: 7 }, (_, d) => rows.filter((r) => r.weekday === d).map((r) => [r.start_time.slice(0, 5), r.end_time.slice(0, 5)]));
    const today = DateTime.now().setZone(me.timezone).startOf("day");
    const lastDay = today.plus({ days: BOOKING_WINDOW_DAYS });
    const ovRows = must(await sb.from("date_overrides").select("*").eq("user_id", me.id).gte("day", today.toISODate()).order("start_time"));
    // date → ranges; an empty list means a day off
    const dates = new Map();
    for (const r of ovRows) {
      if (!dates.has(r.day)) dates.set(r.day, []);
      if (r.start_time) dates.get(r.day).push([r.start_time.slice(0, 5), r.end_time.slice(0, 5)]);
    }
    let month = today.startOf("month");
    const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
    // Dropdowns instead of <input type="time">: the native control squeezes "上午/下午" in and hides the time.
    const STEPS = [];
    for (let m = 0; m < 24 * 60; m += 15) STEPS.push(`${String(m / 60 | 0).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    STEPS.push("23:59"); // end of day, shown as 24:00
    const timeSelect = (cls, val) => `<select class="${cls}">${[...new Set([...STEPS, val])].sort()
      .map((v) => `<option value="${v}" ${v === val ? "selected" : ""}>${v === "23:59" ? "24:00" : v}</option>`).join("")}</select>`;
    const rangeHtml = ([s, e]) => `<div class="range">${timeSelect("rs", s)} – ${timeSelect("re", e)}
      <button type="button" class="btn-ghost btn-small rm" title="${t("delete")}">✕</button></div>`;
    const rangesHtml = (ranges, offLabel) => `<div><div class="ranges">${ranges.map(rangeHtml).join("")}</div>
      <span class="muted small un" ${ranges.length ? "hidden" : ""}>${offLabel}</span>
      <button type="button" class="btn-ghost btn-small add" ${ranges.length ? "" : "hidden"}>${t("addRange")}</button></div>`;
    const readRanges = (row) => [...row.querySelectorAll(".range")].map((r) => [r.querySelector(".rs").value, r.querySelector(".re").value]);
    const dateLabel = (k) => DateTime.fromISO(k).setLocale(locale()).toFormat(lang === "zh" ? "M/d (ccc)" : "ccc d LLL");

    $tab.innerHTML = `
      <form class="card" id="av">
        <h2>${t("weeklyHours")}</h2>
        <p class="muted small">${t("availHint")} <strong>${esc(me.timezone)}</strong></p>
        ${order.map((d) => `
          <div class="day-row" data-day="${d}">
            <label class="day-name" style="margin:0"><input type="checkbox" class="on" ${byDay[d].length ? "checked" : ""}> ${t("weekdays")[d]}</label>
            ${rangesHtml(byDay[d], t("unavailable"))}
          </div>`).join("")}
        <h2 style="margin-top:24px">${t("dateHours")}</h2>
        <p class="muted small">${t("dateHint")}</p>
        <div class="ov-cal"></div>
        <div class="ov-list"></div>
        <button class="btn-block" type="submit">${t("save")}</button>
      </form>`;
    const form = $tab.querySelector("#av");

    // Keep edits made in the date rows before redrawing them.
    const collectDates = () => form.querySelectorAll(".day-row[data-date]").forEach((row) => dates.set(row.dataset.date, readRanges(row)));
    function drawDates() {
      const lead = month.weekday % 7;
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(`<span></span>`);
      for (let d = 1; d <= month.daysInMonth; d++) {
        const day = month.set({ day: d }), k = day.toISODate();
        const ok = day >= today && day <= lastDay;
        const cls = !dates.has(k) ? (ok ? "has" : "") : dates.get(k).length ? "sel" : "sel closed";
        cells.push(`<button type="button" class="day ${cls}" ${ok ? `data-pick="${k}"` : "disabled"}>${d}</button>`);
      }
      form.querySelector(".ov-cal").innerHTML = `
        <div class="cal-head">
          <button type="button" class="btn-ghost" id="ovPrev" ${month <= today.startOf("month") ? "disabled" : ""}>‹</button>
          <strong>${esc(month.setLocale(locale()).toFormat("LLLL yyyy"))}</strong>
          <button type="button" class="btn-ghost" id="ovNext" ${month >= lastDay.startOf("month") ? "disabled" : ""}>›</button>
        </div>
        <div class="cal">${t("weekdays").map((w) => `<span class="dow">${esc(w)}</span>`).join("")}${cells.join("")}</div>`;
      const keys = [...dates.keys()].sort();
      form.querySelector(".ov-list").innerHTML = keys.length ? keys.map((k) => `
        <div class="day-row" data-date="${k}">
          <div class="day-name">
            <label style="margin:0;display:flex;gap:8px;align-items:center"><input type="checkbox" class="on" ${dates.get(k).length ? "checked" : ""}> ${esc(dateLabel(k))}</label>
            <button type="button" class="btn-ghost btn-small rmdate" title="${t("delete")}">✕</button>
          </div>
          ${rangesHtml(dates.get(k), t("closedDay"))}
        </div>`).join("") : `<p class="muted small">${t("noDates")}</p>`;
    }
    drawDates();

    const sync = (row) => {
      const has = row.querySelectorAll(".range").length > 0;
      row.querySelector(".on").checked = has;
      row.querySelector(".un").hidden = has;
      row.querySelector(".add").hidden = !has;
    };
    const redraw = () => { collectDates(); drawDates(); };
    form.addEventListener("click", (e) => {
      if (e.target.id === "ovPrev") { collectDates(); month = month.minus({ months: 1 }); return drawDates(); }
      if (e.target.id === "ovNext") { collectDates(); month = month.plus({ months: 1 }); return drawDates(); }
      const pick = e.target.closest("[data-pick]");
      if (pick) {
        collectDates();
        const k = pick.dataset.pick;
        if (dates.has(k)) dates.delete(k);
        else {
          const wk = byDay[DateTime.fromISO(k).weekday % 7];
          dates.set(k, wk.length ? wk.map((r) => [...r]) : [["09:00", "17:00"]]);
        }
        return drawDates();
      }
      const row = e.target.closest(".day-row");
      if (!row) return;
      if (e.target.classList.contains("rmdate")) { row.remove(); dates.delete(row.dataset.date); return redraw(); }
      if (e.target.classList.contains("rm")) { e.target.closest(".range").remove(); sync(row); if (row.dataset.date) redraw(); }
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
      if (row.dataset.date) redraw();
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      collectDates();
      const bad = (s, en) => !s || !en || en <= s;
      const out = [];
      for (const row of form.querySelectorAll(".day-row[data-day]")) {
        for (const [s, en] of readRanges(row)) {
          if (bad(s, en)) return toast(`${t("weekdays")[row.dataset.day]}: ${s}–${en} ✕`, true);
          out.push({ user_id: me.id, weekday: +row.dataset.day, start_time: s, end_time: en });
        }
      }
      const ov = [];
      for (const [k, ranges] of dates) {
        if (!ranges.length) ov.push({ user_id: me.id, day: k, start_time: null, end_time: null });
        for (const [s, en] of ranges) {
          if (bad(s, en)) return toast(`${dateLabel(k)}: ${s}–${en} ✕`, true);
          ov.push({ user_id: me.id, day: k, start_time: s, end_time: en });
        }
      }
      try {
        must(await sb.from("availability").delete().eq("user_id", me.id));
        if (out.length) must(await sb.from("availability").insert(out));
        must(await sb.from("date_overrides").delete().eq("user_id", me.id).gte("day", today.toISODate()));
        if (ov.length) must(await sb.from("date_overrides").insert(ov));
        toast(t("saved"));
      } catch (err) { toast(errMsg(err), true); }
    };
  }

  async function tabBookings($tab) {
    const rows = must(await sb.from("bookings").select("*, event_types(title), price_links(name)").eq("host_id", me.id).order("start_at"));
    const now = new Date().toISOString();
    const upcoming = rows.filter((r) => r.status === "confirmed" && r.end_at >= now);
    const past = rows.filter((r) => !(r.status === "confirmed" && r.end_at >= now)).reverse();
    const fmt = (iso) => DateTime.fromISO(iso).setZone(me.timezone).setLocale(locale()).toFormat("ccc, d LLL yyyy · HH:mm");
    const item = (r, canCancel) => `
      <div class="list-item">
        <div><strong>${esc(fmt(r.start_at))}</strong> <span class="pill ${r.status === "cancelled" ? "off" : ""}">${esc(r.event_types?.title || "")}${r.price != null ? " · " + esc(fmtPrice(r.price, r.currency)) : ""}${r.status === "cancelled" ? " · " + t("cancelled") : ""}</span>${r.price_links ? ` <span class="pill">${t("via")}: ${esc(r.price_links.name)}</span>` : ""}
          <div class="small">${t("invitee")}: ${esc(r.invitee_name)} · <a href="mailto:${esc(r.invitee_email)}">${esc(r.invitee_email)}</a></div>
          ${r.meet_url ? `<div class="small">🎥 <a href="${esc(r.meet_url)}" target="_blank" rel="noopener">${esc(r.meet_url)}</a></div>` : ""}
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

  async function tabProfile($tab) {
    const gOn = !!cfg.GOOGLE_CLIENT_ID;
    const gEmail = gOn ? must(await sb.rpc("my_google")) : null;
    $tab.innerHTML = `
      <form class="card" id="pf">
        <h2>${t("profile")}</h2>
        <label>${t("displayName")}</label><input name="display_name" required value="${esc(me.display_name)}">
        <label>${t("username")}</label><input name="username" required pattern="[a-z0-9][a-z0-9\\-]{2,29}" value="${esc(me.username)}">
        <div class="hint">${t("usernameHint")}</div>
        <label>${t("timezone")}</label><select name="timezone">${tzOptions(me.timezone)}</select>
        <p class="muted small">${t("email")}: ${esc(session.user.email)}</p>
        <button class="btn-block" type="submit">${t("save")}</button>
      </form>
      ${gOn ? `<div class="card">
        <h2>🎥 ${t("gTitle")}</h2>
        <p class="muted small">${t("gHint")}</p>
        ${gEmail
          ? `<div class="row spread"><span>✅ ${t("gConnected")}<strong>${esc(gEmail)}</strong></span>
              <button class="btn-ghost btn-small" id="gOff">${t("gDisconnect")}</button></div>`
          : `<button class="btn-block" id="gOn">${t("gConnect")}</button><p class="hint">${t("gWarn")}</p>`}
      </div>` : ""}`;
    $tab.querySelector("#gOn")?.addEventListener("click", async () => {
      try {
        const state = must(await sb.rpc("google_oauth_state"));
        location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
          client_id: cfg.GOOGLE_CLIENT_ID, redirect_uri: `${cfg.SUPABASE_URL}/functions/v1/google`, response_type: "code",
          scope: "openid email https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", state,
        });
      } catch (err) { toast(errMsg(err), true); }
    });
    $tab.querySelector("#gOff")?.addEventListener("click", async () => {
      if (!confirm(t("confirmDisconnect"))) return;
      try { must(await sb.rpc("google_disconnect")); tabProfile($tab); } catch (err) { toast(errMsg(err), true); }
    });
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
    const evs = must(await sb.from("event_types").select("*").eq("user_id", host.id).eq("active", true).eq("listed", true).order("created_at"));
    renderEventList(host, evs, `#/u/${encodeURIComponent(host.username)}`);
  }

  // Price link page: same layout as the public page, but with the link's own prices.
  async function viewPriceLink(token, slug) {
    const data = must(await sb.rpc("get_price_link", { p_token: token }));
    const ev = data && slug && data.events.find((e) => e.slug === slug);
    if (!data || (slug && !ev)) { $app.innerHTML = `<div class="card center">${t("notFound")}</div>`; return; }
    const base = `#/p/${encodeURIComponent(token)}`;
    if (ev) return bookingPage(data.host, ev, { link: token, back: base });
    renderEventList(data.host, data.events, base);
  }

  function renderEventList(host, evs, base) {
    $app.innerHTML = `
      <div class="card narrow center"><h1>${esc(host.display_name || host.username)}</h1></div>
      <div class="narrow">${evs.length ? evs.map((e) => `
        <a class="card" style="display:block;color:inherit" href="${base}/${encodeURIComponent(e.slug)}">
          <strong>${esc(e.title)}</strong> <span class="pill">${fmtDur(e.duration_min)} · ${esc(fmtPrice(e.price, e.currency))}</span>
          ${e.description ? `<p class="muted small" style="margin:6px 0 0">${esc(e.description)}</p>` : ""}
        </a>`).join("") : `<div class="card empty">${t("noEvents")}</div>`}</div>`;
  }

  // All bookable start times (UTC ISO strings) for the next BOOKING_WINDOW_DAYS days.
  // Slots step by duration + buffer, and stay `buffer` minutes clear of existing bookings.
  function computeSlots(avail, overrides, hostTz, duration, buffer, busy) {
    const now = DateTime.now().plus({ minutes: MIN_NOTICE_MIN });
    const busyMs = busy.map((b) => [Date.parse(b.start_at), Date.parse(b.end_at)]);
    const slots = [];
    let day = DateTime.now().setZone(hostTz).startOf("day");
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++, day = day.plus({ days: 1 })) {
      const weekday = day.weekday % 7; // luxon: Mon=1…Sun=7 → 0=Sun
      // Date-specific hours replace that date's weekly hours (a row with no times = day off).
      const ov = overrides.filter((o) => o.day === day.toISODate());
      const hours = ov.length ? ov.filter((o) => o.start_time) : avail.filter((a) => a.weekday === weekday);
      for (const w of hours) {
        const [sh, sm] = w.start_time.split(":").map(Number);
        const [eh, em] = w.end_time.split(":").map(Number);
        let s = day.set({ hour: sh, minute: sm });
        const end = eh === 23 && em === 59 ? day.plus({ days: 1 }) : day.set({ hour: eh, minute: em });
        for (; s.plus({ minutes: duration }) <= end; s = s.plus({ minutes: duration + buffer })) {
          if (s < now) continue;
          const a = s.toMillis() - buffer * 60000, b = s.toMillis() + (duration + buffer) * 60000;
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
    if (!ev || ev.listed === false) { $app.innerHTML = `<div class="card center">${t("notFound")}</div>`; return; }
    return bookingPage(host, ev, { link: null, back: `#/u/${encodeURIComponent(host.username)}` });
  }

  async function bookingPage(host, ev, { link, back }) {
    const avail = must(await sb.from("availability").select("weekday, start_time, end_time").eq("user_id", host.id));
    const overrides = must(await sb.from("date_overrides").select("day, start_time, end_time").eq("user_id", host.id)
      .gte("day", DateTime.now().setZone(host.timezone).toISODate()));
    const from = new Date().toISOString();
    const to = DateTime.now().plus({ days: BOOKING_WINDOW_DAYS + 2 }).toUTC().toISO();
    const busy = must(await sb.rpc("get_busy", { p_host: host.id, p_from: from, p_to: to }));
    const slots = computeSlots(avail, overrides, host.timezone, ev.duration_min, ev.buffer_min ?? 0, busy);

    let viewTz = guessTz();
    let month = null, selDay = null;

    const infoHtml = () => `
      <div class="event-info">
        <p class="muted" style="margin:0">${esc(host.display_name || host.username)}</p>
        <h1>${esc(ev.title)}</h1>
        <p>⏱ ${fmtDur(ev.duration_min)}</p>
        <p>💲 ${esc(fmtPrice(ev.price, ev.currency))}</p>
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
          const id = must(await sb.rpc("book_slot", {
            p_event_type: ev.id, p_start: iso, p_name: f.get("name"), p_email: f.get("email"), p_note: f.get("note") || "", p_link: link,
          }));
          renderDone(iso, id);
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

    function renderDone(iso, id) {
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
          <p><strong>${esc(ev.title)}</strong><br>${esc(slotLabel(iso))}<br>💲 ${esc(fmtPrice(ev.price, ev.currency))}</p>
          ${ev.location ? `<p>📍 ${esc(ev.location)}</p>` : ""}
          <p id="meet" class="small muted"></p>
          <div class="row" style="justify-content:center">
            <a class="btn" href="${gcal}" target="_blank" rel="noopener">${t("addGoogle")}</a>
            <a class="btn btn-ghost" href="${icsUrl}" download="booking.ics">${t("downloadIcs")}</a>
          </div>
          <p class="small" style="margin-top:20px"><a href="${back}">${t("bookAnother")}</a></p>
        </div>`;
      pollMeet(id);
    }

    // The Meet link is created a few seconds after booking (trigger → Edge Function), if the
    // host has connected Google. Poll briefly; stay silent for hosts without Google.
    async function pollMeet(id) {
      const $m = document.getElementById("meet");
      for (let i = 0; i < 8 && $m.isConnected; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const url = (await sb.rpc("booking_meet", { p_id: id })).data;
        if (url) { $m.innerHTML = `🎥 <a href="${esc(url)}" target="_blank" rel="noopener"><strong>Google Meet</strong></a> · ${esc(url)}`; $m.className = "small"; return; }
      }
    }

    renderPicker();
  }

  // ---------- boot ----------
  window.addEventListener("hashchange", route);
  (async () => {
    if (sb) {
      // supabase-js holds an auth lock while this callback runs, so calling getSession()
      // (via loadMe) inside it deadlocks signIn. Defer the work, and only re-render when
      // the user actually changed — SIGNED_IN also fires on tab refocus and would wipe forms.
      sb.auth.onAuthStateChange((event, s) => {
        const uid = s?.user?.id ?? null;
        if (uid === (session?.user?.id ?? null)) return;
        setTimeout(async () => { await loadMe(); route(); }, 0);
      });
      try { await loadMe(); } catch (e) { console.error(e); }
    }
    route();
  })();
})();
