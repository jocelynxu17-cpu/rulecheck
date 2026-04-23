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

/** 關鍵字由長到短排序，避免短詞先吃掉長詞（仍允許多筆不重疊命中）。 */
const RULES_UNSORTED: Rule[] = [
  {
    match: "七天瘦五公斤",
    category: "誇大",
    riskType: "具體時程與體重承諾，高度易被認定為虛偽不實或誇大廣告",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    reason: "對減重成效與期程的具體承諾，若無充分科學依證，極易構成誇大或不實廣告。",
    legalReference:
      "《公平交易法》第21條：廣告表示應避免引人錯誤；涉及食品／健康宣稱亦受食品安全衛生管理法等規範（示意）。",
    suggestion: "移除具體天數／公斤數承諾，改為需個人差異警語之生活型態描述，並保留可驗證依據。",
    rewrites: {
      conservative: "刪除具體瘦身時程與公斤數；改為「需配合飲食與運動」並附個人差異聲明。",
      marketing: "以「循序調整」與「體態管理」敘事取代數字承諾，並揭露個人差異。",
      ecommerce: "主圖／副標避免數字保證；短句強調習慣與營養，不宣稱必然結果。",
    },
  },
  {
    match: "快速減肥",
    category: "誇大",
    riskType: "「快速」搭配減肥易被認定為誇大或不實宣稱",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    reason: "暗示短期必然成效，食品／一般商品通常不得宣稱醫療或減肥療效。",
    legalReference: "公平交易法對引人錯誤、誇大廣告之裁處類型（概念整理）。",
    suggestion: "避免「快速」「保證」與減重結果連結；改為可驗證、需個人配合之描述。",
    rewrites: {
      conservative: "改為「需時間與生活習慣配合」之中性敘述，並附警語。",
      marketing: "以「日常節奏調整」取代「快速減肥」承諾。",
      ecommerce: "刪除「快速減肥」字樣，改寫為營養／運動搭配之提示。",
    },
  },
  {
    match: "治療痘痘",
    category: "醫療效能",
    riskType: "涉及疾病治療暗示，化粧品與一般商品不得宣稱醫療效能",
    severity: "high",
    lawName: "化粧品衛生安全管理法",
    article: "相關規範",
    reason: "「治療」結合特定皮膚症狀，易被認定為醫療效能宣稱。",
    legalReference: "化粧品標示與廣告不得宣稱醫療效能（法規概念整理）。",
    suggestion: "改為可驗證之日常護理或清潔描述，避免連結「治療」與疾病名稱。",
    rewrites: {
      conservative: "改為「清潔／調理」等中性用途，並依核准範圍標示。",
      marketing: "以「舒適清爽」等感受描述，避免「治療痘痘」。",
      ecommerce: "短句呈現成分與使用方式，不出現治療承諾。",
    },
  },
  {
    match: "消炎抗菌",
    category: "醫療效能",
    riskType: "「消炎」「抗菌」常被認定屬醫療或藥事宣稱",
    severity: "high",
    lawName: "化粧品衛生安全管理法",
    article: "相關規範",
    reason: "組合用語易被認定暗示醫療或抗菌藥效，化粧品廣告須特別謹慎。",
    legalReference: "化粧品不得宣稱醫療效能；抗菌宣稱亦可能涉及藥事法規（示意）。",
    suggestion: "改為中性、可驗證之清潔或護理描述，並保留科學依據與標示合規。",
    rewrites: {
      conservative: "刪除「消炎抗菌」；改為已核准可宣稱之範圍內用語。",
      marketing: "以「清潔感」「日常護理」取代醫療暗示。",
      ecommerce: "避免併用醫療暗示詞，改寫為用途與成分重點。",
    },
  },
  {
    match: "保證有效",
    category: "誇大",
    riskType: "「保證」搭配效果宣稱，易被認定為虛偽不實或誇大",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    reason: "絕對化用語暗示必然結果，實務上高度敏感。",
    legalReference: "公平交易法第21條對引人錯誤表示之規範（示意）。",
    suggestion: "刪除「保證」「100%」等絕對化用語，改附個人差異與必要條件。",
    rewrites: {
      conservative: "改為「可能因個人體質而異」並避免保證式文案。",
      marketing: "以「許多使用者回饋」等可佐證敘事取代保證。",
      ecommerce: "主圖不出現「保證有效」；改短句＋警語。",
    },
  },
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

const RULES = [...RULES_UNSORTED].sort((a, b) => b.match.length - a.match.length);

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
