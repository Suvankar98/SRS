import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addTechManualYoutubeLink,
  deleteTechManualDocument,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/app/confirm-submit-button";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TechManualUploadForm } from "../tech-manual-upload-form";

export const dynamic = "force-dynamic";

const TECH_MANUAL_FOLDERS = {
  safety: "Safety",
  security: "Security",
  automation: "Automation",
} as const;

type TechManualFolderDetailPageProps = {
  params: Promise<{ folder: string; manualFolderId: string }>;
};

type TechManualDocument = {
  id: string;
  name: string;
  documentType: string;
  fileName: string | null;
  fileUrl: string | null;
  youtubeUrl: string | null;
};

export default async function TechManualFolderDetailPage({ params }: TechManualFolderDetailPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const { folder, manualFolderId } = await params;
  const categoryLabel = TECH_MANUAL_FOLDERS[folder as keyof typeof TECH_MANUAL_FOLDERS];

  if (!categoryLabel) {
    notFound();
  }

  const manualFolder = await prisma.techManualFolder.findUnique({
    where: { id: manualFolderId },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!manualFolder || manualFolder.category !== folder) {
    notFound();
  }

  const canManageManual = roleCanAssign(session.role);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href={`/tech-manual/${folder}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 transition hover:text-blue-900"
            >
              <BackIcon />
              {categoryLabel} folders
            </Link>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Folder</p>
            <h1 className="mt-2 break-words text-2xl font-bold text-blue-950">{manualFolder.name}</h1>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {manualFolder.documents.length} docs
          </span>
        </div>

        {canManageManual ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.8fr)]">
            <TechManualUploadForm folderId={manualFolder.id} />

            <form action={addTechManualYoutubeLink} className="grid gap-3 rounded-2xl border border-blue-100 bg-slate-50 p-4">
              <input type="hidden" name="folderId" value={manualFolder.id} />
              <p className="text-sm font-bold text-blue-950">Add YouTube Link</p>
              <input
                name="documentName"
                required
                maxLength={140}
                placeholder="Video display name"
                className="h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm font-medium text-blue-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <input
                name="youtubeUrl"
                required
                type="url"
                placeholder="https://youtube.com/..."
                className="h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm font-medium text-blue-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
              >
                <LinkIcon />
                Add Link
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.06)]">
        {manualFolder.documents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-8 text-center text-sm font-medium text-blue-600">
            No documents uploaded in this folder.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white">
            <div className="divide-y divide-blue-100">
              {manualFolder.documents.map((document) => (
                <DocumentRow key={document.id} document={document} canManage={canManageManual} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function DocumentRow({ document, canManage }: { document: TechManualDocument; canManage: boolean }) {
  const href = document.youtubeUrl ?? document.fileUrl ?? "";
  const canOpen = href !== "";

  return (
    <div className="grid gap-3 bg-white px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getDocumentIconClass(document.documentType)}`}>
          <DocumentTypeIcon type={document.documentType} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-blue-950">{document.fileName ?? document.name}</p>
          {document.fileName && document.name !== document.fileName ? (
            <p className="mt-0.5 truncate text-xs font-semibold text-blue-700">{document.name}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {canOpen ? (
          <Link
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-3 text-xs font-bold text-blue-800 transition hover:bg-blue-50"
          >
            <OpenIcon />
            Open
          </Link>
        ) : null}
        {canManage && document.fileUrl ? (
          <Link
            href={document.fileUrl}
            download
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            <DownloadIcon />
            Download
          </Link>
        ) : null}
        {canManage ? (
          <form action={deleteTechManualDocument}>
            <input type="hidden" name="documentId" value={document.id} />
            <ConfirmSubmitButton
              confirmMessage={`Delete "${document.name}"?`}
              ariaLabel={`Delete ${document.name}`}
              title="Delete document"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
            >
              <TrashIcon />
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function getDocumentIconClass(type: string) {
  switch (type) {
    case "youtube":
      return "bg-red-50 text-red-600 ring-1 ring-inset ring-red-100";
    case "pdf":
      return "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-100";
    case "image":
      return "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100";
    case "video":
      return "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100";
    case "word":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100";
    default:
      return "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200";
  }
}

function DocumentTypeIcon({ type }: { type: string }) {
  if (type === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1C22 15 22 12 22 12s0-3-.4-4.8ZM10 15.3V8.7l5.7 3.3L10 15.3Z" />
      </svg>
    );
  }

  if (type === "image") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m4 15 4-4 3 3 2-2 7 7" />
        <circle cx="15.5" cy="9.5" r="1.5" />
      </svg>
    );
  }

  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="6" width="13" height="12" rx="2" />
        <path d="m17 10 4-2.5v9L17 14" />
      </svg>
    );
  }

  if (type === "pdf" || type === "word") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
        <path d="M8 14h8M8 17h5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1l-.8.8" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1l.8-.8" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="m7 9 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="m9 7 .5-2h5l.5 2" />
      <path d="M6 7l1 14h10l1-14" />
    </svg>
  );
}
