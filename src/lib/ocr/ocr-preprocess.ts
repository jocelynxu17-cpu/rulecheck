"use client";

/**
 * 僅供瀏覽器 OCR：對送進 Tesseract 的影像做增強（不影響使用者所見之原始預覽）。
 * 流程：必要時縮放 → 灰階 → 對比拉伸 → 輕度銳化；低對比時可選 Otsu 二值化。
 */

const MIN_LONG_EDGE_UPSCALE = 1280;
const MAX_LONG_EDGE = 2800;
const MAX_SCALE_UP = 3;

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function boxBlurGray(gray: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        s += gray[y * w + xx]!;
        c++;
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        s += tmp[yy * w + x]!;
        c++;
      }
      out[y * w + x] = s / c;
    }
  }
  return out;
}

function stdDevGray(gray: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i]!;
  const mean = sum / gray.length;
  let v = 0;
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i]! - mean;
    v += d * d;
  }
  return Math.sqrt(v / gray.length);
}

function otsuThreshold(gray: Float32Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    hist[clampByte(gray[i]!)]++;
  }
  const n = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * 產生供 Tesseract 使用的 PNG（原始預覽仍應使用原檔）。
 */
export async function preprocessImageFileForOcr(file: File): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("preprocessImageFileForOcr 僅能在瀏覽器執行");
  }

  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    const longEdge = Math.max(w, h);
    let scale = 1;
    if (longEdge > MAX_LONG_EDGE) {
      scale = MAX_LONG_EDGE / longEdge;
    } else if (longEdge < MIN_LONG_EDGE_UPSCALE) {
      scale = Math.min(MAX_SCALE_UP, MIN_LONG_EDGE_UPSCALE / longEdge);
    }
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("無法建立 2D context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, cw, ch);

    const imageData = ctx.getImageData(0, 0, cw, ch);
    const d = imageData.data;
    const n = cw * ch;
    const gray = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      gray[i] = luminance(d[p]!, d[p + 1]!, d[p + 2]!);
    }

    const std = stdDevGray(gray);
    const useBinarize = std < 19;

    if (useBinarize) {
      const blur = boxBlurGray(gray, cw, ch);
      const thr = otsuThreshold(blur);
      for (let i = 0; i < n; i++) {
        gray[i] = blur[i]! >= thr ? 255 : 0;
      }
    } else {
      const sorted = Array.from(gray).sort((a, b) => a - b);
      const lo = sorted[Math.floor(n * 0.03)] ?? 0;
      const hi = sorted[Math.floor(n * 0.97)] ?? 255;
      const range = Math.max(18, hi - lo);
      for (let i = 0; i < n; i++) {
        const v = ((gray[i]! - lo) / range) * 255;
        gray[i] = Math.min(255, Math.max(0, v));
      }
      const blur = boxBlurGray(gray, cw, ch);
      const amount = 0.65;
      for (let i = 0; i < n; i++) {
        gray[i] = clampByte(gray[i]! + amount * (gray[i]! - blur[i]!));
      }
    }

    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const v = clampByte(gray[i]!);
      d[p] = v;
      d[p + 1] = v;
      d[p + 2] = v;
      d[p + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob 失敗"))), "image/png");
    });
    return blob;
  } finally {
    bitmap.close();
  }
}
