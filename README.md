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

## 本機測試
```
cd ~/Desktop/booking-app && python3 -m http.server 8000
```
打開 http://localhost:8000

## 目前限制 / 之後可以加
- 預約成功**不會寄 email 通知**（免費方案沒有好用的寄信服務）。主人要到後台看；之後可以接 EmailJS 或 Google Apps Script 寄信。
- 沒有同步 Google 日曆的忙碌時間（需要 OAuth，比較複雜）。
- 一個時段只能一個人訂（沒有「一堂課 10 個名額」）。之後如果要給 1010dance 開課用，可以再加。
- 預約範圍固定是未來 60 天，最少要提前 5 分鐘。

## 狀態
- 2026-10-20：程式寫好，等 Supabase 專案建立後填入 config.js 才能實際測試。
