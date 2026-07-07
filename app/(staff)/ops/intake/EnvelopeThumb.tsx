"use client";
import { useState } from "react";

export default function EnvelopeThumb({ url, serial }: { url: string | null; serial: number }) {
  const [open, setOpen] = useState(false);
  if (!url) return <span className="text-inkSubtle">—</span>;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`View envelope #${serial}`}
        className="block h-10 w-14 overflow-hidden rounded border border-border hover:ring-2 hover:ring-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Envelope #${serial}`} className="h-full w-full object-cover" />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Envelope #${serial}`} className="max-h-[85vh] w-auto rounded-theme shadow-lg" />
          <p className="mt-2 text-center text-sm text-white">#{serial} — click anywhere to close</p>
        </div>
      )}
    </>
  );
}
