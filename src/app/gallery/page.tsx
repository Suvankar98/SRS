import Image from "next/image";
import Link from "next/link";
import { getDashboardGalleryItemsByCompany } from "@/lib/gallery";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type DashboardGalleryItem = {
  url: string;
  type: "image" | "video";
  label: string;
};

type DashboardGalleryGroup = {
  company: string;
  items: DashboardGalleryItem[];
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-blue-500">Media</p>
          <h1 className="text-3xl font-semibold text-blue-950">Gallery</h1>
          <p className="mt-2 text-sm text-slate-600">Browse uploaded photos and videos from employee visits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <section className="rounded-[2rem] border border-blue-200 bg-white p-8 text-center shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <p className="text-lg font-semibold text-blue-950">No media available yet</p>
          <p className="mt-2 text-sm text-slate-600">Employees can upload images and videos from their dashboard.</p>
        </section>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.company} className="rounded-[2rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-blue-500">Company</p>
                  <h2 className="text-2xl font-semibold text-blue-950">{group.company}</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  {group.items.length} files
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <article key={item.url} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 shadow-sm">
                    <a href={item.url} target="_blank" rel="noreferrer noopener" className="group block">
                      <div className="relative h-36 overflow-hidden bg-slate-900 text-white">
                        {item.type === "image" ? (
                          <img src={item.url} alt={item.label} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                        ) : (
                          <video className="h-full w-full object-cover" muted preload="metadata">
                            <source src={item.url} />
                          </video>
                        )}
                        {item.type === "video" && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/25">
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-slate-900/70 text-white">
                              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </a>
                    <div className="space-y-2 p-3">
                      <p className="truncate text-sm font-semibold text-blue-950">{item.label}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Click to open full size</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
