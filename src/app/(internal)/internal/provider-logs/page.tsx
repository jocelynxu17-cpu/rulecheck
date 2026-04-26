import { redirect } from "next/navigation";

/** 舊網址：供應商紀錄已併入「分析營運」。 */
export default function InternalProviderLogsRedirectPage() {
  redirect("/internal/analysis");
}
