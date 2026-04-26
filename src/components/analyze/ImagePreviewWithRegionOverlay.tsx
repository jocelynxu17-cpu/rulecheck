"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OcrRegionNatural } from "@/lib/ocr/crop-image-region";
import { displayRectToNaturalRect, naturalRectToDisplayRect } from "@/lib/ocr/crop-image-region";

type DispRect = { x: number; y: number; w: number; h: number };

function rectFromPoints(ax: number, ay: number, bx: number, by: number): DispRect {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return { x, y, w, h };
}

function clientToLocal(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const b = el.getBoundingClientRect();
  return { x: clientX - b.left, y: clientY - b.top };
}

type Props = {
  imageUrl: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  selectionNat: OcrRegionNatural | null;
  onSelectionNatChange: (r: OcrRegionNatural | null) => void;
};

/**
 * 預覽圖 + 可拖曳矩形框選（座標以原圖 natural 對齊）。
 */
export function ImagePreviewWithRegionOverlay(props: Props) {
  const { imageUrl, alt, className = "", imgClassName = "", selectionNat, onSelectionNatChange } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null);
  const [draft, setDraft] = useState<DispRect | null>(null);
  const anchorRef = useRef<{ ax: number; ay: number } | null>(null);

  const syncSize = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    setNat({ w: img.naturalWidth, h: img.naturalHeight });
    setDisp({ w: img.offsetWidth, h: img.offsetHeight });
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete) syncSize();
  }, [imageUrl, syncSize]);

  useEffect(() => {
    const ro = new ResizeObserver(() => syncSize());
    const w = wrapRef.current;
    if (w) ro.observe(w);
    return () => ro.disconnect();
  }, [imageUrl, syncSize]);

  const finalizeDraft = useCallback(
    (d: DispRect) => {
      anchorRef.current = null;
      if (!nat || !disp || d.w < 4 || d.h < 4) {
        setDraft(null);
        return;
      }
      const clamped: DispRect = {
        x: Math.max(0, Math.min(d.x, disp.w - 1)),
        y: Math.max(0, Math.min(d.y, disp.h - 1)),
        w: Math.min(d.w, disp.w - Math.max(0, d.x)),
        h: Math.min(d.h, disp.h - Math.max(0, d.y)),
      };
      if (clamped.w < 4 || clamped.h < 4) {
        setDraft(null);
        return;
      }
      const next = displayRectToNaturalRect(clamped, nat.w, nat.h, disp.w, disp.h);
      onSelectionNatChange(next);
      setDraft(null);
    },
    [disp, nat, onSelectionNatChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!nat || !disp || !layerRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      layerRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = clientToLocal(layerRef.current, e.clientX, e.clientY);
    anchorRef.current = { ax: x, ay: y };
    setDraft({ x, y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!anchorRef.current || !layerRef.current) return;
    const { x, y } = clientToLocal(layerRef.current, e.clientX, e.clientY);
    const { ax, ay } = anchorRef.current;
    setDraft(rectFromPoints(ax, ay, x, y));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!anchorRef.current || !layerRef.current) return;
    try {
      layerRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = clientToLocal(layerRef.current, e.clientX, e.clientY);
    const { ax, ay } = anchorRef.current;
    anchorRef.current = null;
    finalizeDraft(rectFromPoints(ax, ay, x, y));
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    anchorRef.current = null;
    setDraft(null);
    try {
      layerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const showRect = draft ?? (selectionNat && nat && disp ? naturalRectToDisplayRect(selectionNat, nat.w, nat.h, disp.w, disp.h) : null);

  return (
    <div ref={wrapRef} className={`relative inline-block max-w-full ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URLs */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt={alt}
        className={`block max-h-64 w-auto max-w-full object-contain object-top ${imgClassName}`}
        onLoad={syncSize}
        draggable={false}
      />
      {disp ? (
        <div
          ref={layerRef}
          className="absolute left-0 top-0 cursor-crosshair touch-none"
          style={{ width: disp.w, height: disp.h, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          role="presentation"
        >
          {showRect && showRect.w >= 2 && showRect.h >= 2 ? (
            <div
              className="pointer-events-none absolute border-2 border-brand-strong bg-brand-strong/15 shadow-sm"
              style={{
                left: showRect.x,
                top: showRect.y,
                width: showRect.w,
                height: showRect.h,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
