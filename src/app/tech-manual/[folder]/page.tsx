import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createTechManualFolder, deleteTechManualFolder } from "@/app/actions";
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
    select: {
      id: true,
      name: true,
      _count: { select: { documents: true } },
    },
  });
  const documentCount = folders.reduce((total, entry) => total + entry._count.documents, 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-500">Manual Library</p>
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
              {canManageManual ? "Create the first folder above, then open it to upload documents." : "No manuals have been uploaded in this section yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {folders.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                <Link
                  href={`/tech-manual/${folder}/${entry.id}`}
                  className="group flex min-w-0 items-start gap-3 rounded-xl transition hover:bg-blue-50/70"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                    <FolderIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-blue-950 group-hover:text-blue-700">{entry.name}</span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                    <ArrowRightIcon />
                  </span>
                </Link>

                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {entry._count.documents} docs
                  </span>
                  <Link
                    href={`/tech-manual/${folder}/${entry.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 text-xs font-bold text-blue-800 transition hover:bg-blue-50"
                  >
                    Open
                  </Link>
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
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
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

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
