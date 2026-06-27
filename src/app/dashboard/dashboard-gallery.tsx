type DashboardGalleryItem = {
  url: string;
  type: "image" | "video";
  label: string;
};

export function DashboardGallery({ items }: { items: DashboardGalleryItem[] }) {
  if (items.length === 0) {
    return (
      <section className="mb-6 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-blue-950">Media Gallery</h2>
        <p className="mt-2 text-sm text-blue-600">No uploaded images or videos are available yet.</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">Media Gallery</h2>
          <p className="text-sm text-blue-600">Uploaded files from employees.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
          {items.length} files
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.url} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
            <div className="aspect-[4/3] bg-slate-900 text-white">
              {item.type === "image" ? (
                <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
              ) : (
                <video controls className="h-full w-full object-cover">
                  <source src={item.url} />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-semibold text-blue-950">{item.label}</p>
              <p className="text-xs text-blue-600">{item.type.toUpperCase()}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
