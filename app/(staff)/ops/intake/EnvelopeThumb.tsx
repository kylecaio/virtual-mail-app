"use client";
import { useEffect, useRef, useState } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN = 1, MAX = 8;

export default function EnvelopeThumb({ url, serial }: { url: string | null; serial: number }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function reset() { setScale(1); setTx(0); setTy(0); }
  function close() { setOpen(false); reset(); }

  // zoom keeping the point under (clientX,clientY) fixed
  function zoomAt(clientX: number, clientY: number, factor: number) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const mx = clientX - cx, my = clientY - cy;
    const ns = clamp(scale * factor, MIN, MAX);
    if (ns === scale) return;
    if (ns === 1) { reset(); return; }
    const k = ns / scale;
    setTx(mx - (mx - tx) * k);
    setTy(my - (my - ty) * k);
    setScale(ns);
  }
  function zoomButton(factor: number) {
    const el = wrapRef.current;
    if (!el) { setScale((s) => clamp(s * factor, MIN, MAX)); return; }
    const r = el.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  // native wheel listener so we can preventDefault (React onWheel is passive)
  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoomButton(1.25);
      else if (e.key === "-") zoomButton(1 / 1.25);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    setDrag({ x: e.clientX - tx, y: e.clientY - ty });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    setTx(e.clientX - drag.x);
    setTy(e.clientY - drag.y);
  }
  function onPointerUp() { setDrag(null); }

  if (!url) return <span className="text-inkSubtle">—</span>;

  const ctrlBtn = "flex h-8 w-8 items-center justify-center rounded-theme bg-white/15 text-white hover:bg-white/30";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`View envelope #${serial}`}
        className="inline-flex items-center gap-1.5 rounded-theme border border-border px-2 py-1 text-xs font-medium text-accent hover:bg-accentSubtle"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        View
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={close}>
          {/* Controls */}
          <div className="flex items-center justify-between p-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-sm">#{serial}</span>
            <div className="flex items-center gap-2">
              <button className={ctrlBtn} title="Zoom out (-)" onClick={() => zoomButton(1 / 1.25)}>−</button>
              <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
              <button className={ctrlBtn} title="Zoom in (+)" onClick={() => zoomButton(1.25)}>+</button>
              <button className={ctrlBtn} title="Reset (0)" onClick={reset}>⤢</button>
              <button className={ctrlBtn} title="Close (Esc)" onClick={close}>✕</button>
            </div>
          </div>

          {/* Stage */}
          <div
            ref={wrapRef}
            className="flex flex-1 items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={(e) => (scale > 1 ? reset() : zoomAt(e.clientX, e.clientY, 2.5))}
            style={{ cursor: drag ? "grabbing" : scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Envelope #${serial}`}
              draggable={false}
              className="max-h-[82vh] max-w-[92vw] select-none rounded shadow-lg"
              style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: drag ? "none" : "transform 60ms ease-out" }}
            />
          </div>
          <p className="pb-3 text-center text-xs text-white/70" onClick={(e) => e.stopPropagation()}>
            Scroll or use +/− to zoom · drag to move · double-click to toggle · Esc to close
          </p>
        </div>
      )}
    </>
  );
}
