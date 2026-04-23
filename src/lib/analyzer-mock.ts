import type { AnalysisFinding, AnalysisResult } from "@/types/analysis";
import { mergeFindingsSpans } from "@/lib/text-spans";

/** 與 UI / Zod 一致之四大類；細緻分類寫入 riskType 前綴【…】。 */
type LegalRiskLabel =
  | "醫療療效暗示"
  | "誇大效果"
  | "絕對化/保證性表述"
  | "速效或數字結果承諾"
  | "容易誤導的效果描述";

type ClaimRule = {
  /** 去重用 */
  id: string;
  riskLabel: LegalRiskLabel;
  category: AnalysisFinding["category"];
  severity: AnalysisFinding["severity"];
  lawName: string;
  article: string;
  /** 從全文擷取第一個符合之宣稱片段（子句級），無則 null */
  extract: (text: string) => string | null;
  /** 說明「這類宣稱在說什麼」與法規意旨，不依賴單一禁字 */
  reason: string;
  legalReference: string;
  suggestion: string;
  rewrites: AnalysisFinding["rewrites"];
  /** 短標題：描述宣稱性質，不必等於原文詞 */
  phraseTitle: (matched: string) => string;
};

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  if (!m || !m[0]?.trim()) return null;
  return m[0].trim().slice(0, 200);
}

const CLAIM_RULES: ClaimRule[] = [
  {
    id: "timed-numeric-body-outcome",
    riskLabel: "速效或數字結果承諾",
    category: "誇大",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) =>
      firstMatch(
        t,
        /\d{1,3}\s*(?:天|日|週|周|個月|月)\s*[\s\S]{0,24}?(?:瘦|減重|減肥|公斤|kg|體重|腰圍|公分|cm)/i
      ),
    reason:
      "此類片語將「時間」與「可量化身體指標變化」綁定，屬對使用結果的具體承諾；在無充分、可驗證之科學與個案條件揭露下，實務上易被認為超出合理廣告範圍，而構成誇大或不實之虞。",
    legalReference:
      "公平交易法禁止引人錯誤或虛偽不實之表示；涉及健康宣稱時，亦可能與食品安全衛生管理法、化粧品標示廣告相關規範產生競合（概念整理，非釋字）。",
    suggestion:
      "改以「需配合飲食／運動」「效果因人而異」等可驗證條件之中性敘述，避免具體天數與身體數值之必然連結。",
    rewrites: {
      conservative: "刪除具體時程與公斤／腰圍數字承諾；改附個人差異與必要生活條件說明。",
      marketing: "改為「循序調整節奏」等敘事，並揭露影響結果之變因。",
      ecommerce: "主圖／副標避免數字＋身體結果之組合；改短句說明使用情境與非保證聲明。",
    },
    phraseTitle: () => "時程與身體數值結果之具體承諾",
  },
  {
    id: "absolute-guarantee-outcome",
    riskLabel: "絕對化/保證性表述",
    category: "誇大",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) =>
      firstMatch(
        t,
        /(?:保證|一定|必然|百分百|100\s*%|無效退款|沒效退錢|無效\s*退)\s*[\s\S]{0,20}?(?:有效|見效|成功|瘦|白|亮|改善|解決)/i
      ),
    reason:
      "將商品效果與「必然結果」或「退款承諾」綁定，易使消費者認為效果已獲確保；若實際條件、適用範圍或證據不足，可能被認定為引人錯誤或誇大。",
    legalReference:
      "公平交易法第21條對廣告真實性與是否引人錯誤之判斷架構（示意）；實際仍視整體文案與交易條件而定。",
    suggestion:
      "改為清楚揭露條件、適用範圍與個人差異之中性售後或體驗描述，避免「必然有效」之絕對化語氣。",
    rewrites: {
      conservative: "刪除保證／退款與效果之直接掛勾；改列可查證之使用條件與客服管道。",
      marketing: "以「許多人於某條件下之體驗」等可佐證敘述取代絕對保證。",
      ecommerce: "主圖不出現「保證／無效退款」與效果連寫；改短句＋完整退換政策連結。",
    },
    phraseTitle: () => "效果絕對化或與退款條款綁定之宣稱",
  },
  {
    id: "medical-efficacy-verbs",
    riskLabel: "醫療療效暗示",
    category: "醫療效能",
    severity: "high",
    lawName: "化粧品衛生安全管理法",
    article: "相關規範",
    extract: (t) =>
      firstMatch(
        t,
        /(?:治療|根治|消炎|殺菌|滅菌|抗菌藥效|藥用|醫療級|修復細胞|重建皮膚)\s*[\s\S]{0,20}?(?:痘|疮|炎|敏|病|疣|癣|傷口|感冒|疼痛|過敏|體質|菌)/i
      ),
    reason:
      "文案出現將商品與「疾病、症狀之治療或醫療級效果」連結之敘述；化粧品與多數一般商品依法不得為醫療效能宣稱，易被認定違反禁絕醫療廣告或標示之精神。",
    legalReference:
      "化粧品標示、廣告不得宣稱醫療效能；涉及藥品才容許之療效語彙於一般商品廣告中高度敏感（法規意旨整理）。",
    suggestion:
      "改為核准範圍內、可驗證之清潔／護理或感官描述，避免與疾病名稱、治療行為直接連結。",
    rewrites: {
      conservative: "全面改寫為非治療、非療效之中性用途描述，並請法務對照核准範圍。",
      marketing: "以使用感受、日常照護流程呈現，不出現治療或醫療級暗示。",
      ecommerce: "以成分、使用方法為主，避免疾病詞＋治療動詞之組合。",
    },
    phraseTitle: () => "與疾病或治療行為連結之宣稱",
  },
  {
    id: "constitution-allergy-claim",
    riskLabel: "醫療療效暗示",
    category: "醫療效能",
    severity: "high",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) => firstMatch(t, /(?:改善|調整|改變)\s*[\s\S]{0,8}?過敏體質/i),
    reason:
      "「體質」尤其是過敏體質，涉及個人生理狀態之改變；宣稱可改善易被理解為生理機能或過敏狀態之變更，而超出一般商品可得宣稱之範圍。",
    legalReference:
      "健康相關宣稱可能同時觸及公平交易法「引人錯誤」與食品安全衛生管理法對食品宣稱之限制（視產品性質而定；此處為意旨說明）。",
    suggestion:
      "改為不涉及體質改變承諾之中性描述，或僅在主管機關核准之健康食品宣稱範圍內為之。",
    rewrites: {
      conservative: "刪除體質改變承諾；改為「個人生活習慣搭配」並附非醫療聲明。",
      marketing: "改以「舒適感受」「日常節奏」等可驗證、不涉療效之語彙。",
      ecommerce: "避免「體質」與「改善」並列；改寫為情境與使用方式。",
    },
    phraseTitle: () => "涉及過敏體質改變之宣稱",
  },
  {
    id: "superlative-ranking",
    riskLabel: "誇大效果",
    category: "誇大",
    severity: "medium",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) =>
      firstMatch(t, /(?:最|第一|唯一|No\.?\s*1|冠軍|史上|全台|全國)(?:強|有效|好用|快|猛|厲害|專業|指定)/i),
    reason:
      "極度化或市場排序類用語，若無客觀、可驗證之依據與比較基準，易被認定為對品質或效果為超越合理範圍之宣稱。",
    legalReference:
      "公平交易委員會對「最好」「第一」等比較廣告之審查重點在於是否有主客觀依據及揭露比較對象（概念整理）。",
    suggestion:
      "改為可驗證之具體事實（例如試驗條件、樣本範圍）或刪除無從證明之極度化用語。",
    rewrites: {
      conservative: "刪除無法舉證之「最／第一／唯一」等用語。",
      marketing: "改為「許多使用者主觀感受」並附調查條件摘要。",
      ecommerce: "主圖改短句產品特色，不出現絕對化排名。",
    },
    phraseTitle: () => "極度化或無基準之排名／效果宣稱",
  },
  {
    id: "misleading-vague-physiology",
    riskLabel: "容易誤導的效果描述",
    category: "誤導",
    severity: "medium",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) =>
      firstMatch(t, /(?:排毒|清毒|淨化(?:血液|體內)|代謝毒素|體內(?:大)?掃除|深層(?:排毒|代謝))/i),
    reason:
      "此類語彙常缺乏可操作、可驗證之定義，易使消費者對生理作用產生具體聯想卻無從證成，而被認為屬引人錯誤或誇大之模糊宣稱。",
    legalReference:
      "公平交易法對「表示內容是否足以使一般消費者產生錯誤認知」之判斷框架（示意）。",
    suggestion:
      "改以可驗證之機制、範圍與條件說明取代模糊生理隱喻；若無科學共識支持應避免使用。",
    rewrites: {
      conservative: "刪除排毒／淨化血液等語；改列具體成分與物理性清潔或保濕等功能。",
      marketing: "改為「清爽感」「使用後觸感」等可感知描述。",
      ecommerce: "主圖用「日常保養」導向，不出現生理排毒承諾。",
    },
    phraseTitle: () => "模糊生理機轉或排毒隱喻",
  },
  {
    id: "rapid-weight-wording",
    riskLabel: "誇大效果",
    category: "誇大",
    severity: "medium",
    lawName: "公平交易法",
    article: "第21條",
    extract: (t) => firstMatch(t, /(?:快速|速效|立即|瞬間)\s*[\s\S]{0,12}?(?:瘦|減重|減肥|塑身|甩肉|鏟肉)/i),
    reason:
      "將身材／體重變化與「速度」連結，易使消費者認為無須長期條件即可獲致結果；涉及食品或一般商品時，與不得宣稱醫療減肥療效及誇大之規範意旨衝突。",
    legalReference:
      "涉及食品、健康食品或化粧品時，各自有標示與廣告限制；公平交易法亦禁止引人錯誤之表示（意旨整理）。",
    suggestion:
      "改為需個人配合之中性節奏描述，避免「快速」與必然身材結果之聯想。",
    rewrites: {
      conservative: "刪除「快速／速效」與減重結果之併用；改附警語與生活型態條件。",
      marketing: "改為「日常節奏中的調整」等敘述。",
      ecommerce: "主圖短句改營養與運動搭配，不連結速效減重。",
    },
    phraseTitle: () => "強調速度與身材結果之連結",
  },
];

function riskTypeLine(label: LegalRiskLabel, tail: string): string {
  return `【${label}】${tail}`;
}

export function analyzeTextMock(input: string): AnalysisResult {
  const text = input ?? "";
  const findings: AnalysisFinding[] = [];
  const usedRanges: { start: number; end: number }[] = [];

  function overlaps(start: number, end: number): boolean {
    return usedRanges.some((r) => !(end <= r.start || start >= r.end));
  }

  for (const rule of CLAIM_RULES) {
    const matchedText = rule.extract(text);
    if (!matchedText) continue;

    const idx = text.indexOf(matchedText);
    if (idx < 0) continue;
    const end = idx + matchedText.length;
    if (overlaps(idx, end)) continue;
    usedRanges.push({ start: idx, end });

    const riskyPhrase = rule.phraseTitle(matchedText);
    findings.push({
      riskyPhrase,
      matchedText,
      spans: mergeFindingsSpans(text, matchedText, riskyPhrase),
      category: rule.category,
      riskType: riskTypeLine(
        rule.riskLabel,
        rule.category === "醫療效能"
          ? "宣稱涉及生理或疾病層次之作用，與化粧品／一般商品可得廣告範圍可能不符。"
          : rule.category === "誤導"
            ? "表述方式易使一般受眾對效果或機制產生過度具體之聯想。"
            : "對效果強度或結果之表述可能逾越合理證明與揭露義務。"
      ),
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
      ? "規則層未偵測到常見之高風險「宣稱型態」（仍不代表合規；建議由模型就整篇文案與產業別完整檢視）。"
      : `規則層依「宣稱類型」偵測到 ${findings.length} 項可能風險，請對照實際產品類別與證據逐條覆核。`;

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
