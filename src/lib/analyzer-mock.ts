import type { AnalysisFinding, AnalysisResult } from "@/types/analysis";
import { mergeFindingsSpans } from "@/lib/text-spans";

type Rule = {
  match: string;
  category: AnalysisFinding["category"];
  riskType: string;
  severity: AnalysisFinding["severity"];
  lawName: string;
  article: string;
  reason: string;
  legalReference: string;
  suggestion: string;
  rewrites: AnalysisFinding["rewrites"];
};

const RULES: Rule[] = [
  {
    match: "治療",
    category: "醫療效能",
    riskType: "涉及醫療效能之宣稱",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    reason: "「治療」易使一般大眾認為具醫療效能，化粧品／一般食品通常不得如此宣稱。",
    legalReference:
      "《公平交易法》第21條：廣告不得有不實、引人錯誤或其他違反公序良俗之表示（示意整理，非釋字）。",
    suggestion: "避免宣稱疾病「治療」效果；僅能於主管機關核准範圍內、以可佐證之方式描述。",
    rewrites: {
      conservative: "請依主管機關核准之用途與標示內容描述，避免涉及疾病治療暗示。",
      marketing: "以日常照護角度描述使用感受，並避免連結到疾病治療或療效承諾。",
      ecommerce: "重點式呈現成分與使用方法，避免「治療」等醫療用語。",
    },
  },
  {
    match: "消炎",
    category: "醫療效能",
    riskType: "可能涉及未經核准之醫療效能",
    severity: "high",
    lawName: "化粧品衛生安全管理法",
    article: "相關規範",
    reason: "「消炎」常被認定屬醫療效能宣稱，化粧品不得以醫療效能廣告。",
    legalReference:
      "化粧品之標示、廣告不得宣稱醫療效能（法規概念整理；實際適用請以主管機關見解為準）。",
    suggestion: "避免「消炎」等醫療用語；可改為中性、可驗證之描述並保留證據。",
    rewrites: {
      conservative: "建議改為「舒緩」等中性詞前，先確認是否有科學依據與試驗支持。",
      marketing: "以「舒適感」「穩定狀態」等可驗證感受描述，避免直接連結醫療效果。",
      ecommerce: "短句呈現「日常護理」重點，避免「消炎」等醫療暗示。",
    },
  },
  {
    match: "瘦身",
    category: "誇大",
    riskType: "減重／身材相關易構成誇大或不實廣告",
    severity: "medium",
    lawName: "公平交易法",
    article: "第21條",
    reason: "涉及身材／體重之承諾易被認定為誇大或不實，食品亦不得宣稱醫療效能。",
    legalReference:
      "《公平交易法》第21條：廣告表示應避免引人錯誤；食品廣告亦受食品安全衛生管理法規範（示意）。",
    suggestion: "避免保證或暗示必然瘦身；涉及食品須符合食安法與相關標示規範。",
    rewrites: {
      conservative: "避免保證瘦身；可改為「搭配飲食與運動」之生活型態描述並附警語。",
      marketing: "以「體態管理」方向描述，並清楚揭露個人差異與必要生活習慣。",
      ecommerce: "用短句強調「日常習慣」與「營養補給」，避免保證式承諾。",
    },
  },
  {
    match: "排毒",
    category: "誤導",
    riskType: "常見誇大或誤導性宣稱",
    severity: "medium",
    lawName: "公平交易法",
    article: "第21條",
    reason: "「排毒」語意模糊，易被認定引人錯誤或暗示未經證實之生理機制。",
    legalReference:
      "公平交易委員會對涉及誇大、引人錯誤之廣告裁處案例類型（概念整理；請自行查證最新函釋）。",
    suggestion: "以具體、可驗證之機制說明取代模糊「排毒」用語。",
    rewrites: {
      conservative: "以可驗證之機制與範圍描述，避免「排毒」等暗示疾病關聯之詞。",
      marketing: "改以「清爽感」「循環感」等中性感受描述，並保留科學依據。",
      ecommerce: "用「日常保養」導向短句，避免「排毒」承諾。",
    },
  },
];

export function analyzeTextMock(input: string): AnalysisResult {
  const text = input ?? "";
  const seen = new Set<string>();
  const findings: AnalysisFinding[] = [];

  for (const rule of RULES) {
    if (!text.includes(rule.match)) continue;
    if (seen.has(rule.match)) continue;
    seen.add(rule.match);
    const matchedText = rule.match;
    findings.push({
      riskyPhrase: rule.match,
      matchedText,
      spans: mergeFindingsSpans(text, matchedText, rule.match),
      category: rule.category,
      riskType: rule.riskType,
      severity: rule.severity,
      lawName: rule.lawName,
      article: rule.article,
      reason: rule.reason,
      legalReference: rule.legalReference,
      suggestion: rule.suggestion,
      rewrites: rule.rewrites,
    });
  }

  const summary =
    findings.length === 0
      ? "未偵測到預設規則中的高風險關鍵字（仍不代表合規）。"
      : `偵測到 ${findings.length} 項風險提示，建議逐條檢視並留存佐證資料。`;

  return {
    findings,
    summary,
    scannedAt: new Date().toISOString(),
    meta: {
      source: "mock",
      guest: false,
      quotaRemaining: null,
    },
  };
}
