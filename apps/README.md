# 應用程式結構（單一 Next.js 專案）

本 repo 以 **路由群組** 對應兩個產品介面，日後若要拆成獨立 `apps/web`、`apps/ops` 套件，可將下列對應關係整包遷移。

| 產品 | 程式位置 | URL 前綴 |
|------|-----------|-----------|
| 使用者端（極簡 AI 工作區） | `src/app/(web)/` | `/`、`/analyze`、`/history`、`/members`、`/billing`、`/settings`、`/api-settings` |
| 內部營運 | `src/app/(internal)/internal/` | `/internal`、`/internal/users`、… |
| 公開行銷（價格等） | `src/app/(marketing)/` | `/pricing` 等 |

共用邏輯維持在 `src/lib/`、`src/components/`（例如 workspace、billing、analysis），**不**為拆介面而複製商業邏輯。
