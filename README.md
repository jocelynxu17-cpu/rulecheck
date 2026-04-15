# RuleCheck — 台灣廣告合規檢查 MVP

Next.js 15 + TypeScript + Tailwind + **Supabase（Auth + Postgres）**。Day 1 使用 **Mock 關鍵字分析**（尚未串 OpenAI）。Stripe 可之後再接。

## 功能

- 首頁（Landing）
- 登入／註冊（Supabase Email + Password）
- 儀表板
- **POST `/api/analyze`**：回傳 Mock JSON，並寫入 `analysis_logs`（若資料表已建立）
- 文案檢測頁：文字框 + 按鈕，顯示 JSON 與卡片式摘要

## 本機開發

### 1. 安裝依賴

```bash
npm install
```

### 2. Supabase 專案

1. 在 [Supabase](https://supabase.com) 建立專案。
2. **Project Settings → API**：複製 `Project URL` 與 `anon public` key。
3. **Authentication → URL Configuration**：
   - **Site URL**：`http://localhost:3000`（上線後改為 Vercel 網域）
   - **Redirect URLs** 加入：`http://localhost:3000/auth/callback`
4. 開啟 **SQL Editor**，執行 `supabase/migrations/20260415000000_init.sql` 全文（建立 `public.users`、`public.analysis_logs`、RLS、註冊同步 trigger）。

### 3. 環境變數

```bash
cp .env.local.example .env.local
```

編輯 `.env.local`：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. 啟動

```bash
npm run dev
```

瀏覽 <http://localhost:3000>。

## Vercel 部署

1. 將專案推上 GitHub 並在 [Vercel](https://vercel.com) Import。
2. 在 Vercel **Environment Variables** 設定與本機相同的兩個 `NEXT_PUBLIC_SUPABASE_*`。
3. 回到 Supabase，把 **Site URL**、**Redirect URLs** 改為正式網域（例如 `https://你的專案.vercel.app` 與 `https://你的專案.vercel.app/auth/callback`）。

## Mock 分析規則

偵測關鍵字：**治療、消炎、瘦身、排毒**。每筆結果包含：`riskyPhrase`、`riskType`、`severity`、`legalReference`（示意文字）、`suggestion`。

## 之後擴充

- **OpenAI**：在 `/api/analyze` 改為呼叫模型，保留同一 JSON 形狀或版本欄位。
- **Stripe**：訂閱與用量限制於 Middleware 或 API 內檢查。

## 免責

本工具僅供內部自查與產品演示，**不構成法律意見**；實際合規仍以主管機關與律師意見為準。
