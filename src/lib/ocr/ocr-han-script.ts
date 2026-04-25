/**
 * 依「繁／簡對照字」在 OCR 原文中的出現次數，做輕量字形摘要（僅標示引擎輸出，不改正文）。
 * Tesseract 同時載入 chi_tra+chi_sim 時仍可能混碼；此摘要供 UI 與顯示層決策參考，非語言學判定。
 * 實際顯示字形優化見 `ocr-script-normalize.ts`（`text` 仍保留引擎原文）。
 */

export type OcrHanScriptCode = "trad" | "simp" | "mixed";

export type OcrHanScriptMeta = {
  code: OcrHanScriptCode;
  labelZh: "繁體" | "簡體" | "混合";
  tradMarkerCount: number;
  simpMarkerCount: number;
};

const CJK_RE = /[\u4e00-\u9fff]/;

/** 常見繁簡一對一字形（左繁右簡）；去重後建表 */
const TRAD_SIMP_PAIRS: readonly (readonly [string, string])[] = [
  ["國", "国"],
  ["內", "内"],
  ["體", "体"],
  ["廣", "广"],
  ["會", "会"],
  ["經", "经"],
  ["開", "开"],
  ["關", "关"],
  ["臺", "台"],
  ["灣", "湾"],
  ["電", "电"],
  ["腦", "脑"],
  ["車", "车"],
  ["門", "门"],
  ["龍", "龙"],
  ["鳥", "鸟"],
  ["魚", "鱼"],
  ["馬", "马"],
  ["時", "时"],
  ["間", "间"],
  ["題", "题"],
  ["檔", "档"],
  ["處", "处"],
  ["務", "务"],
  ["個", "个"],
  ["們", "们"],
  ["來", "来"],
  ["說", "说"],
  ["話", "话"],
  ["認", "认"],
  ["識", "识"],
  ["購", "购"],
  ["銷", "销"],
  ["錢", "钱"],
  ["鐘", "钟"],
  ["長", "长"],
  ["閱", "阅"],
  ["陳", "陈"],
  ["無", "无"],
  ["為", "为"],
  ["愛", "爱"],
  ["優", "优"],
  ["點", "点"],
  ["發", "发"],
  ["選", "选"],
  ["進", "进"],
  ["過", "过"],
  ["達", "达"],
  ["遠", "远"],
  ["還", "还"],
  ["這", "这"],
  ["邊", "边"],
  ["運", "运"],
  ["邏", "逻"],
  ["鏈", "链"],
  ["險", "险"],
  ["難", "难"],
  ["雲", "云"],
  ["書", "书"],
  ["畫", "画"],
  ["兒", "儿"],
  ["幾", "几"],
  ["萬", "万"],
  ["東", "东"],
  ["專", "专"],
  ["業", "业"],
  ["參", "参"],
  ["與", "与"],
  ["義", "义"],
  ["樂", "乐"],
  ["習", "习"],
  ["鄉", "乡"],
  ["買", "买"],
  ["亂", "乱"],
  ["爭", "争"],
  ["產", "产"],
  ["親", "亲"],
  ["億", "亿"],
  ["僅", "仅"],
  ["從", "从"],
  ["倉", "仓"],
  ["儀", "仪"],
  ["對", "对"],
  ["總", "总"],
  ["級", "级"],
  ["結", "结"],
  ["絕", "绝"],
  ["統", "统"],
  ["計", "计"],
  ["記", "记"],
  ["訊", "讯"],
  ["討", "讨"],
  ["訓", "训"],
  ["託", "托"],
  ["評", "评"],
  ["詞", "词"],
  ["詢", "询"],
  ["試", "试"],
  ["詩", "诗"],
  ["誠", "诚"],
  ["請", "请"],
  ["諮", "咨"],
  ["論", "论"],
  ["諾", "诺"],
  ["謀", "谋"],
  ["謝", "谢"],
  ["證", "证"],
  ["譜", "谱"],
  ["讀", "读"],
  ["變", "变"],
  ["環", "环"],
  ["現", "现"],
  ["補", "补"],
  ["課", "课"],
  ["稅", "税"],
  ["價", "价"],
  ["報", "报"],
  ["據", "据"],
  ["擊", "击"],
  ["擇", "择"],
  ["換", "换"],
  ["擋", "挡"],
  ["擁", "拥"],
  ["護", "护"],
  ["擠", "挤"],
  ["擴", "扩"],
  ["擬", "拟"],
  ["攜", "携"],
  ["攔", "拦"],
  ["攝", "摄"],
  ["攤", "摊"],
  ["攪", "搅"],
  ["歷", "历"],
  ["曆", "历"],
  ["於", "于"],
  ["並", "并"],
  ["個", "个"],
  ["備", "备"],
  ["傳", "传"],
  ["債", "债"],
  ["傷", "伤"],
  ["僑", "侨"],
  ["儲", "储"],
  ["兩", "两"],
  ["冊", "册"],
  ["凍", "冻"],
  ["準", "准"],
  ["涼", "凉"],
  ["減", "减"],
  ["測", "测"],
  ["湯", "汤"],
  ["溫", "温"],
  ["滿", "满"],
  ["漢", "汉"],
  ["潤", "润"],
  ["濕", "湿"],
  ["濟", "济"],
  ["瀏", "浏"],
  ["災", "灾"],
  ["為", "为"],
  ["無", "无"],
  ["煙", "烟"],
  ["熱", "热"],
  ["燈", "灯"],
  ["營", "营"],
  ["爺", "爷"],
  ["牆", "墙"],
  ["獎", "奖"],
  ["獨", "独"],
  ["獻", "献"],
  ["現", "现"],
  ["琺", "珐"],
  ["瑪", "玛"],
  ["產", "产"],
  ["畢", "毕"],
  ["異", "异"],
  ["當", "当"],
  ["疊", "叠"],
  ["療", "疗"],
  ["癒", "愈"],
  ["發", "发"],
  ["盜", "盗"],
  ["盡", "尽"],
  ["眾", "众"],
  ["矯", "矫"],
  ["硃", "朱"],
  ["碼", "码"],
  ["磚", "砖"],
  ["礦", "矿"],
  ["祕", "秘"],
  ["禮", "礼"],
  ["禦", "御"],
  ["種", "种"],
  ["稱", "称"],
  ["穀", "谷"],
  ["穩", "稳"],
  ["窮", "穷"],
  ["竊", "窃"],
  ["場", "场"],
];

const TRAD_MARKERS = new Set<string>();
const SIMP_MARKERS = new Set<string>();

for (const pair of TRAD_SIMP_PAIRS) {
  const [a, b] = pair;
  if (a.length !== 1 || b.length !== 1) continue;
  if (a === b) continue;
  TRAD_MARKERS.add(a);
  SIMP_MARKERS.add(b);
}

/**
 * 單字替換用對照表（與 {@link detectHanScriptSummary} 同一字表）。
 * 簡→繁：同一簡字取表內**首次**出現之繁體，以降低一簡對多繁之任意性。
 * 繁→簡：後方表項覆蓋前方（與引擎混碼時之實務取捨一致即可）。
 */
const SIMP_TO_TRAD_CHAR = new Map<string, string>();
const TRAD_TO_SIMP_CHAR = new Map<string, string>();

for (const pair of TRAD_SIMP_PAIRS) {
  const [trad, simp] = pair;
  if (trad.length !== 1 || simp.length !== 1 || trad === simp) continue;
  if (!SIMP_TO_TRAD_CHAR.has(simp)) SIMP_TO_TRAD_CHAR.set(simp, trad);
  TRAD_TO_SIMP_CHAR.set(trad, simp);
}

export function getHanCharScriptMaps(): {
  simpToTrad: ReadonlyMap<string, string>;
  tradToSimp: ReadonlyMap<string, string>;
} {
  return { simpToTrad: SIMP_TO_TRAD_CHAR, tradToSimp: TRAD_TO_SIMP_CHAR };
}

function hasAnyCjk(text: string): boolean {
  return CJK_RE.test(text);
}

/**
 * 僅統計對照表中出現之字形，不修改 `text`。
 */
export function detectHanScriptSummary(text: string): OcrHanScriptMeta {
  let tradMarkerCount = 0;
  let simpMarkerCount = 0;
  for (const ch of text) {
    if (TRAD_MARKERS.has(ch)) tradMarkerCount++;
    if (SIMP_MARKERS.has(ch)) simpMarkerCount++;
  }

  let code: OcrHanScriptCode;
  if (tradMarkerCount >= 1 && simpMarkerCount >= 1) {
    code = "mixed";
  } else if (tradMarkerCount >= 1 && simpMarkerCount === 0) {
    code = "trad";
  } else if (simpMarkerCount >= 1 && tradMarkerCount === 0) {
    code = "simp";
  } else if (hasAnyCjk(text)) {
    code = "mixed";
  } else {
    code = "mixed";
  }

  const labelZh: OcrHanScriptMeta["labelZh"] =
    code === "trad" ? "繁體" : code === "simp" ? "簡體" : "混合";

  return { code, labelZh, tradMarkerCount, simpMarkerCount };
}
