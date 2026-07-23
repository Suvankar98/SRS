"use client";

import React from "react";

import type { DashboardRequestMediaItem } from "@/lib/gallery";

type DashboardMediaPopupProps = {
  docketNumber: string;
  mediaItems?: DashboardRequestMediaItem[];
};

export function DashboardMediaPopup({ docketNumber, mediaItems = [] }: DashboardMediaPopupProps) {
  const [open, setOpen] = React.useState(false);

  if (mediaItems.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex max-w-full items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        View media
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-blue-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-blue-950">Uploaded Media</h3>
                <p className="mt-1 text-xs font-medium text-blue-600">{docketNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label="Close uploaded media"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="max-h-[calc(88vh-5rem)] overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mediaItems.map((item) => (
                  <article key={`${item.url}-${item.fileName}`} className="overflow-hidden rounded-xl border border-blue-100 bg-blue-50/40">
                    <div className="aspect-video bg-slate-100">
                      {item.type === "video" ? (
                        <video src={item.url} className="h-full w-full bg-black object-contain" controls preload="metadata" />
                      ) : (
                        <img src={item.url} alt={item.fileName} className="h-full w-full object-contain" loading="lazy" />
                      )}
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <p className="truncate text-xs font-bold text-blue-950">{item.fileName}</p>
                      <p className="truncate text-[11px] font-medium text-blue-600">{item.label}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
