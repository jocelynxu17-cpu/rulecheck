# 工作區帳務 SSOT — QA 檢查清單

同一工作區在下列介面應指向**同一筆** `workspaces` 列（同一 `id`），且方案、訂閱狀態、帳務來源、月度額度上限、週期結束等欄位語意一致。

## 檢查步驟

1. **帳務頁**（`/billing`）  
   確認顯示之工作區名稱、方案、狀態、額度與 Stripe／營運預期相符。

2. **儀表板**（`/dashboard`）  
   與帳務頁同一工作區之用量／狀態文案應一致（皆讀 workspace SSOT）。

3. **分析 API**（例如透過 App 內分析）  
   回傳或儲存之 `result.meta` 應含：`workspaceId`、`plan`（工作區方案）、`workspaceMonthlyQuotaUnits`、`workspaceSubscriptionStatus`、`workspaceBillingProvider`、`quotaRemaining`（扣點後）等；與當下 DB 工作區列對齊。

4. **歷史詳情**（`/history/[id]`）  
   - 標題下方可見工作區名稱（來自 meta 或舊資料之 `workspaces.name` join）。  
   - 「工作區與配額（此筆分析）」卡：新紀錄應與步驟 1–3 語意一致；**數值為分析當下快照**，若之後改訂閱，舊紀錄不必與現況相同。

5. **內部營運後台**  
   - **工作區列表**（`/internal/workspaces`）：點工作區名稱進入詳情。  
   - **工作區詳情**（`/internal/workspaces/[id]`）：與步驟 1 之帳務欄位應一致；可對照近期 `usage_events`、`analysis_logs`、`payment_events`（後者可能依 payload 之 `workspace_id` 或成員 `user_id` 關聯）。

## 除錯

- 伺服器環境變數 `ADMIN_DEBUG=1` 時，工作區詳情頁底部會展開原始工作區列 JSON（僅管理員可進入之路由）。
