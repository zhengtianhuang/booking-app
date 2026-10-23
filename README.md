# Slotly — 免費預約系統（Calendly 自架版）

任何人都能註冊、設定自己的可預約時間，再把連結分享出去，讓別人直接挑時間預約。

- 前端：純靜態網頁，放 GitHub Pages（免費）
- 後端：Supabase 免費方案（登入 + Postgres 資料庫）
- 防止重複預約：資料庫層級的 exclusion constraint，兩個人同時按也只會有一個成功

## 功能
- Email + 密碼註冊 / 登入
- 自訂網址名稱 → 公開預約頁 `…/#/u/你的名稱`
- 多種預約類型（名稱、長度、地點、說明、開關）
- 每週可預約時間，一天可以設多個時段，以主人的時區為準
- 預約者看到的是自己的時區，可以手動切換
- 預約成功後可以「加到 Google 日曆」或下載 .ics
- 後台看預約紀錄、取消預約
- **專屬連結**（後台「專屬連結」分頁）：每個連結可以選要顯示哪些預約類型、用不同幣別和價格，例如台灣學生給 TWD 連結、澳洲學生給 AUD 連結。網址 `…/#/p/<隨機代碼>`，猜不到；價格由伺服器決定，改網頁也改不了價。預約類型取消勾選「顯示在公開預約頁」就只能透過專屬連結預約
- 中文 / English 切換

## 設定步驟（第一次）

1. **建立 Supabase 專案**：到 https://supabase.com 用 GitHub 登入 → New project（Region 選 Sydney）→ 設一組資料庫密碼。
2. **建立資料表**：專案左側 **SQL Editor** → New query → 把 `schema.sql` 整份貼上 → Run。
3. **填 config.js**：左側 **Project Settings → API**，把 `Project URL` 和 `anon public` key 貼進 `config.js`。
   - anon key 本來就是公開的，可以放上 GitHub；**絕對不要**放 `service_role` key。
4. **登入設定**：左側 **Authentication → URL Configuration**
   - Site URL 填 `https://zhengtianhuang.github.io/booking-app/`
   - Redirect URLs 也加同一個網址
   - （選擇性）**Authentication → Providers → Email** 關掉 “Confirm email”，註冊後就能直接登入。Supabase 內建寄信每小時只能寄幾封，測試時建議先關掉。
5. 推上 GitHub，Pages 會自動更新。

## 手機 App（PWA）
網站可以直接安裝成手機 App，不用上架：
- iPhone：用 Safari 打開 → 分享 → 加入主畫面
- Android：用 Chrome 打開 → 選單 → 安裝應用程式 / 加到主畫面
- `manifest.webmanifest` + `sw.js` + `icons/`。sw.js 只快取網站本身和 CDN 套件，Supabase 的資料一律即時抓。
- 改了 style/app/config 要同時把 index.html 和 sw.js 裡的 `?v=N` 和 `CACHE` 名稱加 1。

## 本機測試
```
cd ~/Desktop/booking-app && python3 -m http.server 8000
```
打開 http://localhost:8000

## Email 通知（已接上）
預約成功 / 取消 → Postgres trigger（`notifications.sql`）→ `pg_net` → Google Apps Script（`apps-script/Code.gs`，跑在 zhengtian0629@gmail.com）→ 寄信。
- 主人和預約者各收到一封信，附「加到 Google 日曆」按鈕 + .ics；**不會自動寫進任何人的日曆**（使用者選的）
- 取消預約 → 寄取消通知給預約者
- 信從 zhengtian0629@gmail.com 寄出，Gmail 一天約 100 封
- 密鑰和 Web App 網址只存在 Supabase `private.settings` 和 Apps Script 裡，repo 裡是 placeholder
- 除錯：SQL Editor 跑 `select * from net._http_response order by created desc limit 5;`
- 改 Code.gs 後要「部署 → 管理部署作業 → 編輯 → 新版本」才會生效

## 目前限制 / 之後可以加
- 沒有同步 Google 日曆的忙碌時間（需要 OAuth，比較複雜）。
- 一個時段只能一個人訂（沒有「一堂課 10 個名額」）。之後如果要給 1010dance 開課用，可以再加。
- 預約範圍固定是未來 60 天，最少要提前 5 分鐘。

## 狀態
- 2026-10-23：加專屬連結（price_links / price_link_items、get_price_link()、book_slot 多一個 p_link 參數）。schema.sql 已在 Supabase 重跑，後端 7 項測試（rollback）+ 畫面都確認過。
- 2026-10-20：Supabase 專案 `booking-app`（stkwjmhkcnpxlunghipr，Seoul）已建立、schema 已執行、Site URL / Redirect 已設、Email 驗證已關。
- 後端 22 項測試全過（重複預約、超出時段、過去時間、隱私 RLS、取消後可再訂）；公開預約頁畫面確認正常。
- 測試資料：使用者 `test-520f17` 和兩個 slotly-test-…@example.com 帳號，可在 Supabase → Authentication → Users 刪掉。
