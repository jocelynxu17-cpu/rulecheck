# 產品 QA 檢查清單（內部）

用於上線前與每次釋出回歸。環境需具備：已登入測試帳、Supabase migration 全數套用、`NEXT_PUBLIC_SITE_URL` 正確。

## 1. 新使用者工作區

- [ ] 註冊新帳號後進入 `/dashboard`，應出現預設工作區（名稱如「我的團隊」）與額度欄位。
- [ ] `/api/workspaces` 回傳至少一筆 `workspaces`，且當前使用者為 `owner`。
- [ ] 側欄工作區選擇器可見該工作區。

## 2. 舊帳／無成員列還原

- [ ] 模擬無 `workspace_members` 之帳號（或由 migration `ensure_user_workspace` 修復）後登入，頁面上方出現修復橫幅時，點「修復並同步工作區」應成功。
- [ ] `/dashboard`、`/billing`、`/team/members` 在修復後可顯示額度／帳務／成員，而非空白或僅錯誤文案。

## 3. 儀表板／帳務／成員修復流程

- [ ] 故意使 `ensure` RPC 未部署時，修復按鈕失敗有提示；部署後重新整理可恢復。
- [ ] `RepairWorkspaceButton`（伺服器頁）與 `WorkspaceRecoveryBanner`（全 App）行為一致、不造成重複建立多個擁有者工作區（併發時 DB advisory lock）。

## 4. 邀請／加入／移除

- [ ] 擁有者／管理員在 `/team/members` 建立邀請：成功 toast、連結可複製。
- [ ] 「待處理邀請」列表顯示 Email、狀態（待加入／已過期）、建立與到期時間。
- [ ] **重新寄送**：連結更新、到期日延長 14 天、舊 token 失效。
- [ ] **撤銷邀請**：該筆自列表消失，舊連結不可再加入。
- [ ] 受邀者以相同 Email 登入後開啟 `/team/join?token=…`：加入成功畫面與工作區列表。
- [ ] 移除成員：確認對話框、成功後對方不再出現在成員表。

## 5. 文字／圖片／PDF 扣點

- [ ] 文字分析：成功後 `meta.unitsCharged` 與工作區 `units_used_month` 一致（本月）。
- [ ] 圖片：同上 1 點（或可編輯 OCR 後仍計 1 點，依產品定義）。
- [ ] PDF：扣點 = 分析頁數（或後端定義），額度不足時回 429 與繁中錯誤文案。
- [ ] `/team/members` 用量表出現對應 `usage_events` 列。

## 6. 紀錄與內部營運

- [ ] `/history` 列出可讀取之分析紀錄（含工作區情境下之 RLS）。
- [ ] `/history/[id]` 可開啟單筆；舊 JSON 仍可正規化顯示。
- [ ] `/internal`：僅 `SUPERADMIN_EMAILS`（未設定時過渡為 `ADMIN_EMAILS`）允許之信箱可進入；無 service role key 時有明確錯誤而非白屏。
- [ ] 已套用 migration `internal_ops_audit_log` 後，`/internal` 與 `/internal/security` 可顯示近期稽核；執行工作區修復或營運 PATCH 後列表應新增一筆以上。

## 7. 帳務與審計（NewebPay 前置）

- [ ] `POST /api/billing/notify`（`kind: pro_interest`）在具 service role 時寫入 `payment_events` 且同日重複為 idempotent。
- [ ] Stripe webhook 觸發時，`payment_events` 出現 `idempotency_key = stripe:event:<id>` 之審計列（不重複）。

## 8. 迴歸快速路徑（5 分鐘）

登入 → 儀表板額度 → 檢測一則文字 → 歷史一筆 → 成員頁邀請列表 → 帳務頁 Pro 卡片「通知我開通」→ 內部營運 `/internal` 可開。
