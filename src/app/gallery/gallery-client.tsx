"use client";

import React from "react";

import { deleteGalleryMedia } from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";

export type GalleryClientItem = {
  url: string;
  type: "image" | "video";
  label: string;
  fileName: string;
  requestId: string;
  docketNumber: string;
  company: string;
  uploadedById: string;
  uploadedByName: string;
  sizeLabel: string;
  uploadedAt: string;
};

export function GalleryClient({ items }: { items: GalleryClientItem[] }) {
  const [query, setQuery] = React.useState("");
  const filteredItems = React.useMemo(() => filterGalleryItems(items, query), [items, query]);
  const totalImages = items.filter((item) => item.type === "image").length;
  const totalVideos = items.length - totalImages;
  const companyCount = new Set(items.map((item) => item.company)).size;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-5 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-blue-500">Media Library</p>
            <h1 className="mt-2 text-2xl font-bold text-blue-950">Gallery</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Browse employee-uploaded service media with docket number, company, uploader, and upload date.
            </p>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Type employee name, docket, company, or file name"
              className="mt-4 min-h-11 w-full max-w-2xl rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
            />
          </div>
          <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 text-center">
            <GalleryStat label="Files" value={items.length} />
            <GalleryStat label="Dockets" value={new Set(items.map((item) => item.docketNumber)).size} />
            <GalleryStat label="Images" value={totalImages} />
            <GalleryStat label="Videos" value={totalVideos} />
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyGallery />
      ) : filteredItems.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
            <SearchIcon />
          </div>
          <p className="mt-4 text-lg font-semibold text-blue-950">No matching media found</p>
          <p className="mt-2 text-sm text-slate-600">Try another employee name, docket number, company, or file name.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-blue-950">
                {query.trim() ? `Matching media` : "All uploaded media"}
              </h2>
              <p className="mt-1 text-xs font-medium text-blue-600">
                Showing {filteredItems.length} of {items.length} files across {companyCount} companies.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredItems.map((item) => (
              <GalleryCard key={item.url} item={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function GalleryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[5.8rem] border-r border-blue-100 px-3 py-3 last:border-r-0">
      <p className="text-xl font-bold text-blue-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">{label}</p>
    </div>
  );
}

function GalleryCard({ item }: { item: GalleryClientItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
      <div className="border-b border-blue-100 bg-blue-50/70 px-3.5 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-500">Docket</p>
        <p className="mt-0.5 text-sm font-extrabold text-blue-950">{item.docketNumber}</p>
      </div>
      <a href={item.url} target="_blank" rel="noreferrer noopener" className="group block" title="Open full size">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-950 text-white">
          {item.type === "image" ? (
            <img src={item.url} alt={item.label} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
          ) : (
            <video className="h-full w-full object-cover" muted preload="metadata">
              <source src={item.url} />
            </video>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
              {item.type}
            </span>
          </div>
          {item.type === "video" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/15">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-slate-950/70 text-white">
                <PlayIcon />
              </div>
            </div>
          ) : null}
        </div>
      </a>
      <div className="p-3.5">
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label={`Open ${item.fileName}`}
            title="Open"
          >
            <OpenIcon />
          </a>
          <a
            href={item.url}
            download={item.fileName}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            aria-label={`Download ${item.fileName}`}
            title="Download"
          >
            <DownloadIcon />
          </a>
          <form action={deleteGalleryMedia} className="ml-auto">
            <input type="hidden" name="fileUrl" value={item.url} />
            <ConfirmSubmitButton
              confirmMessage={`Delete ${item.fileName}?`}
              detailText="This action permanently removes this media file."
              ariaLabel={`Delete ${item.fileName}`}
              title="Delete"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <TrashIcon />
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </article>
  );
}

function EmptyGallery() {
  return (
    <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
        <ImageIcon />
      </div>
      <p className="mt-4 text-lg font-semibold text-blue-950">No media available yet</p>
      <p className="mt-2 text-sm text-slate-600">Employees can upload images and videos from their dashboard.</p>
    </section>
  );
}

function filterGalleryItems(items: GalleryClientItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    [item.uploadedByName, item.docketNumber, item.company, item.fileName, item.requestId]
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 15-5-5L5 19" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
      <path d="M5 5v14h14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="7 4 19 12 7 20 7 4" />
    </svg>
  );
}
