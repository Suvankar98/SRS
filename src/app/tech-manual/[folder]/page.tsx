import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addTechManualYoutubeLink,
  createTechManualFolder,
  deleteTechManualDocument,
  deleteTechManualFolder,
  uploadTechManualDocument,
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/app/confirm-submit-button";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TECH_MANUAL_FOLDERS = {
  safety: {
    label: "Safety",
    description: "Safety manuals, procedures, site-readiness files, and training references.",
  },
  security: {
    label: "Security",
    description: "Security system manuals, setup notes, wiring references, and service documents.",
  },
  automation: {
    label: "Automation",
    description: "Automation manuals, product guides, installation files, and commissioning notes.",
  },
} as const;

type TechManualFolderPageProps = {
  params: Promise<{ folder: string }>;
};

type TechManualDocument = {
  id: string;
  name: string;
  documentType: string;
  fileName: string | null;
  fileUrl: string | null;
  youtubeUrl: string | null;
  uploadedByName: string | null;
  createdAt: Date;
};

export default async function TechManualFolderPage({ params }: TechManualFolderPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const { folder } = await params;
  const manualFolder = TECH_MANUAL_FOLDERS[folder as keyof typeof TECH_MANUAL_FOLDERS];

  if (!manualFolder) {
    notFound();
  }

  const canManageManual = roleCanAssign(session.role);
  const folders = await prisma.techManualFolder.findMany({
    where: { category: folder },
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const documentCount = folders.reduce((total, entry) => total + entry.documents.length, 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Tech Manual</p>
            <h1 className="mt-2 text-2xl font-bold text-blue-950">{manualFolder.label}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-700">{manualFolder.description}</p>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/70 text-center shadow-sm">
            <div className="border-r border-blue-100 px-4 py-4">
              <p className="text-2xl font-bold text-blue-950">{folders.length}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-500">Folders</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-2xl font-bold text-blue-950">{documentCount}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-500">Documents</p>
            </div>
          </div>
        </div>

        {canManageManual ? (
          <form action={createTechManualFolder} className="mt-6 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input type="hidden" name="category" value={folder} />
            <label className="min-w-0">
              <span className="sr-only">Folder name</span>
              <input
                name="name"
                required
                maxLength={120}
                placeholder={`Create ${manualFolder.label.toLowerCase()} folder`}
                className="h-11 w-full rounded-xl border border-blue-200 bg-white px-4 text-sm font-medium text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0b4fb3] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#083f90]"
            >
              <PlusIcon />
              Add Folder
            </button>
          </form>
        ) : null}
      </section>

      <section className="mt-5">
        {folders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-white px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
              <FolderIcon />
            </div>
            <p className="mt-4 text-base font-semibold text-blue-950">No folders yet</p>
            <p className="mt-1 text-sm text-blue-600">
              {canManageManual ? "Create the first folder above, then upload documents into it." : "No manuals have been uploaded in this section yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {folders.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-blue-200 bg-white shadow-[0_12px_38px_rgba(15,23,42,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-500">Folder</p>
                    <h2 className="mt-1 break-words text-xl font-bold text-blue-950">{entry.name}</h2>
                    <p className="mt-1 text-xs font-medium text-blue-600">
                      {entry.createdByName ?? "Admin / Manager"} / {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {entry.documents.length} docs
                    </span>
                    {canManageManual ? (
                      <form action={deleteTechManualFolder}>
                        <input type="hidden" name="folderId" value={entry.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Delete "${entry.name}" and all documents inside it?`}
                          ariaLabel={`Delete ${entry.name}`}
                          title="Delete folder"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        >
                          <TrashIcon />
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>

                {canManageManual ? (
                  <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.8fr)]">
                    <form action={uploadTechManualDocument} className="grid gap-3 rounded-2xl border border-blue-100 bg-slate-50 p-4">
                      <input type="hidden" name="folderId" value={entry.id} />
                      <p className="text-sm font-bold text-blue-950">Upload Document</p>
                      <input
                        name="documentName"
                        required
                        maxLength={140}
                        placeholder="Document display name"
                        className="h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm font-medium text-blue-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <input
                        name="file"
                        type="file"
                        required
                        accept="image/*,video/*,.pdf,.doc,.docx,.rtf"
                        className="block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-blue-950 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b4fb3] px-4 text-sm font-semibold text-white transition hover:bg-[#083f90]"
                      >
                        <UploadIcon />
                        Upload File
                      </button>
                    </form>

                    <form action={addTechManualYoutubeLink} className="grid gap-3 rounded-2xl border border-blue-100 bg-slate-50 p-4">
                      <input type="hidden" name="folderId" value={entry.id} />
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

                <div className="border-t border-blue-100 p-5">
                  {entry.documents.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-5 text-sm font-medium text-blue-600">
                      No documents uploaded in this folder.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {entry.documents.map((document) => (
                        <DocumentCard key={document.id} document={document} canManage={canManageManual} />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function DocumentCard({ document, canManage }: { document: TechManualDocument; canManage: boolean }) {
  const href = document.youtubeUrl ?? document.fileUrl ?? "";
  const canOpen = href !== "";

  return (
    <div className="rounded-2xl border border-blue-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold text-blue-950">{document.name}</p>
          <p className="mt-1 text-xs font-medium text-blue-600">
            {document.uploadedByName ?? "Admin / Manager"} / {formatDateTime(document.createdAt)}
          </p>
          {document.fileName ? <p className="mt-1 truncate text-xs text-blue-500">{document.fileName}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
          {formatDocumentType(document.documentType)}
        </span>
      </div>

      <DocumentPreview document={document} />

      <div className="mt-4 flex items-center gap-2">
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
          <form action={deleteTechManualDocument} className="ml-auto">
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

function DocumentPreview({ document }: { document: TechManualDocument }) {
  if (document.documentType === "image" && document.fileUrl) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-white">
        <img src={document.fileUrl} alt={document.name} className="h-48 w-full object-contain" />
      </div>
    );
  }

  if (document.documentType === "video" && document.fileUrl) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-black">
        <video src={document.fileUrl} className="h-48 w-full" controls controlsList="nodownload" disablePictureInPicture preload="metadata" />
      </div>
    );
  }

  if (document.documentType === "pdf" && document.fileUrl) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-white">
        <iframe src={`${document.fileUrl}#toolbar=0`} title={document.name} className="h-56 w-full" />
      </div>
    );
  }

  if (document.documentType === "youtube" && document.youtubeUrl) {
    const embedUrl = getYouTubeEmbedUrl(document.youtubeUrl);

    if (embedUrl) {
      return (
        <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-black">
          <iframe
            src={embedUrl}
            title={document.name}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      );
    }
  }

  return (
    <div className="mt-4 flex h-32 items-center justify-center rounded-xl border border-blue-100 bg-white px-4 text-center text-xs font-semibold text-blue-600">
      {formatDocumentType(document.documentType)} document
    </div>
  );
}

function getYouTubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      videoId = url.searchParams.get("v") ?? "";

      if (!videoId && url.pathname.startsWith("/shorts/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      }

      if (!videoId && url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
      }
    }

    return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}` : null;
  } catch {
    return null;
  }
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDocumentType(value: string) {
  if (value === "youtube") return "YouTube";
  if (value === "pdf") return "PDF";
  if (value === "word") return "Word";
  return value;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5h6l1.6 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z" />
      <path d="M4 9h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
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
