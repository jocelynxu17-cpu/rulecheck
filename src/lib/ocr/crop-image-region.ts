/** 以原圖像素座標表示之框選區（與 `HTMLImageElement.naturalWidth/Height` 對齊） */
export type OcrRegionNatural = { x: number; y: number; w: number; h: number };

export function clampNaturalRegion(rect: OcrRegionNatural, natW: number, natH: number): OcrRegionNatural {
  const x = Math.max(0, Math.min(Math.floor(rect.x), Math.max(0, natW - 1)));
  const y = Math.max(0, Math.min(Math.floor(rect.y), Math.max(0, natH - 1)));
  const w = Math.max(1, Math.min(Math.ceil(rect.w), natW - x));
  const h = Math.max(1, Math.min(Math.ceil(rect.h), natH - y));
  return { x, y, w, h };
}

/** 顯示座標（與縮放後 `<img>` 可見像素一致）→ 原圖座標 */
export function displayRectToNaturalRect(
  selDisp: { x: number; y: number; w: number; h: number },
  natW: number,
  natH: number,
  dispW: number,
  dispH: number
): OcrRegionNatural {
  if (dispW <= 0 || dispH <= 0 || natW <= 0 || natH <= 0) {
    return { x: 0, y: 0, w: natW, h: natH };
  }
  const sx = natW / dispW;
  const sy = natH / dispH;
  return clampNaturalRegion(
    {
      x: selDisp.x * sx,
      y: selDisp.y * sy,
      w: selDisp.w * sx,
      h: selDisp.h * sy,
    },
    natW,
    natH
  );
}

/** 原圖座標 → 顯示座標（供框線繪製） */
export function naturalRectToDisplayRect(
  nat: OcrRegionNatural,
  natW: number,
  natH: number,
  dispW: number,
  dispH: number
): { x: number; y: number; w: number; h: number } {
  if (natW <= 0 || natH <= 0 || dispW <= 0 || dispH <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const sx = dispW / natW;
  const sy = dispH / natH;
  return {
    x: nat.x * sx,
    y: nat.y * sy,
    w: nat.w * sx,
    h: nat.h * sy,
  };
}

/**
 * 自 blob URL 裁切原圖區域並輸出 PNG `File`（供瀏覽器 Tesseract）。
 */
export async function cropImageFromUrlToPngFile(imageUrl: string, rect: OcrRegionNatural): Promise<File> {
  const r = rect;
  const img = new Image();
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("區域裁切：圖片載入失敗"));
    img.src = imageUrl;
    if (img.complete && img.naturalWidth > 0) resolve();
  });

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const c = clampNaturalRegion(r, natW, natH);

  const canvas = document.createElement("canvas");
  canvas.width = c.w;
  canvas.height = c.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("區域裁切：無法建立 Canvas");

  ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("區域裁切：輸出失敗"))), "image/png");
  });
  return new File([blob], "ocr-region.png", { type: "image/png" });
}
