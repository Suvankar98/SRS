import { deleteGalleryMedia } from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { getDashboardGalleryItemsByCompany } from "@/lib/gallery";
import { getSession, roleCanAssign } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type DashboardGalleryItem = {
  url: string;
  type: "image" | "video";
  label: string;
  fileName: string;
  requestId: string;
  sizeLabel: string;
  uploadedAt: Date;
};

export default async function GalleryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const groups = await getDashboardGalleryItemsByCompany();
  const totalFiles = groups.reduce((total, group) => total + group.items.length, 0);
  const totalImages = groups.reduce(
    (total, group) => total + group.items.filter((item) => item.type === "image").length,
    0,
  );
  const totalVideos = totalFiles - totalImages;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mb-5 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-blue-500">Media Library</p>
            <h1 className="mt-2 text-2xl font-bold text-blue-950">Gallery</h1>
            <p className="mt-1 text-sm text-slate-600">
              Browse, download, and manage employee-uploaded service media by company.
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 text-center">
            <GalleryStat label="Companies" value={groups.length} />
            <GalleryStat label="Images" value={totalImages} />
            <GalleryStat label="Videos" value={totalVideos} />
          </div>
        </div>
      </section>

      {groups.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-white p-10 text-center shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
            <ImageIcon />
          </div>
          <p className="mt-4 text-lg font-semibold text-blue-950">No media available yet</p>
          <p className="mt-2 text-sm text-slate-600">Employees can upload images and videos from their dashboard.</p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.company}
              className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-white to-blue-50 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-500">Company</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-blue-950" title={group.company}>
                    {group.company}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">Latest upload {formatGalleryDate(group.items[0].uploadedAt)}</p>
                </div>
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm">
                  {group.items.length} files
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {group.items.map((item) => (
                  <GalleryCard key={item.url} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function GalleryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[6.5rem] border-r border-blue-100 px-4 py-3 last:border-r-0">
      <p className="text-xl font-bold text-blue-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">{label}</p>
    </div>
  );
}

function GalleryCard({ item }: { item: DashboardGalleryItem }) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
      <a href={item.url} target="_blank" rel="noreferrer noopener" className="group block" title="Open full size">
        <div className="relative aspect-[16/11] overflow-hidden bg-slate-950 text-white">
          {item.type === "image" ? (
            <img src={item.url} alt={item.label} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
          ) : (
            <video className="h-full w-full object-cover" muted preload="metadata">
              <source src={item.url} />
            </video>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-sm">
            {item.type}
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 pt-10 opacity-0 transition duration-200 group-hover:opacity-100">
            <p className="truncate text-xs font-semibold text-white">Open full size</p>
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
      <div className="space-y-3 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-blue-950" title={item.fileName}>
            {item.fileName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{item.sizeLabel}</span>
            <span>{formatGalleryDate(item.uploadedAt)}</span>
          </div>
          <p className="mt-2 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-500" title={item.requestId}>
            {item.requestId}
          </p>
        </div>
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

function formatGalleryDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
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
